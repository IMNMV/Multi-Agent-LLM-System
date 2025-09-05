# experiment_queue.py
"""
Batch Experiment Queue System - Adapted for Railway deployment
Manages automated execution of multiple experiments with different configurations.
"""

import uuid
import threading
import time
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class ExperimentStatus(Enum):
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class QueueStatus(Enum):
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"

@dataclass
class QueuedExperiment:
    """Individual experiment in the queue."""
    id: str
    batch_id: str
    name: str
    config: Dict[str, Any]
    priority: int = 5  # 1=highest, 10=lowest
    status: ExperimentStatus = ExperimentStatus.PENDING
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: int = 0
    error_message: Optional[str] = None
    result_files: List[str] = None
    estimated_duration_minutes: int = 15
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.result_files is None:
            self.result_files = []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        # Convert datetime objects to ISO strings
        for field in ['created_at', 'started_at', 'completed_at']:
            if data[field]:
                data[field] = data[field].isoformat()
        # Convert enums to strings
        data['status'] = self.status.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'QueuedExperiment':
        """Create from dictionary."""
        # Convert datetime strings back to datetime objects
        for field in ['created_at', 'started_at', 'completed_at']:
            if data.get(field):
                data[field] = datetime.fromisoformat(data[field])
        # Convert status string to enum
        if 'status' in data:
            data['status'] = ExperimentStatus(data['status'])
        return cls(**data)

@dataclass
class ExperimentBatch:
    """Batch of related experiments."""
    id: str
    name: str
    description: str
    template_name: Optional[str] = None
    created_at: datetime = None
    experiments: List[QueuedExperiment] = None
    total_experiments: int = 0
    completed_experiments: int = 0
    failed_experiments: int = 0
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.experiments is None:
            self.experiments = []
    
    def get_progress(self) -> float:
        """Get overall batch progress (0-1)."""
        if self.total_experiments == 0:
            return 0.0
        return (self.completed_experiments + self.failed_experiments) / self.total_experiments
    
    def get_status(self) -> str:
        """Get overall batch status."""
        if self.failed_experiments > 0 and self.completed_experiments + self.failed_experiments == self.total_experiments:
            return "completed_with_failures"
        elif self.completed_experiments == self.total_experiments:
            return "completed"
        elif any(exp.status == ExperimentStatus.RUNNING for exp in self.experiments):
            return "running"
        elif any(exp.status == ExperimentStatus.PENDING for exp in self.experiments):
            return "pending"
        else:
            return "unknown"

class ExperimentQueue:
    """Main queue management system - adapted for Railway deployment."""
    
    def __init__(self, max_concurrent: int = None):
        # Use environment variable for max concurrent experiments
        self.max_concurrent = max_concurrent or int(os.getenv("MAX_CONCURRENT_EXPERIMENTS", "3"))
        self.experiments: List[QueuedExperiment] = []
        self.batches: Dict[str, ExperimentBatch] = {}
        self.running_experiments: Dict[str, QueuedExperiment] = {}
        self.status = QueueStatus.STOPPED
        self.worker_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        
        # Initialize experiment runner (will be injected)
        self.experiment_runner = None
        
        # Results directory for Railway
        self.results_dir = Path(os.getenv("RESULTS_STORAGE_PATH", "/app/results"))
        self.results_dir.mkdir(parents=True, exist_ok=True)
    
    def set_experiment_runner(self, runner):
        """Inject the experiment runner dependency."""
        self.experiment_runner = runner
    
    def add_experiment(self, experiment: QueuedExperiment) -> str:
        """Add a single experiment to the queue."""
        with self._lock:
            self.experiments.append(experiment)
            
            # Add to batch if it exists
            if experiment.batch_id in self.batches:
                self.batches[experiment.batch_id].experiments.append(experiment)
                self.batches[experiment.batch_id].total_experiments += 1
        
        logger.info(f"Added experiment {experiment.id} to queue")
        return experiment.id
    
    def add_batch(self, batch: ExperimentBatch) -> str:
        """Add a batch of experiments to the queue."""
        with self._lock:
            # Store the batch
            self.batches[batch.id] = batch
            
            # Add all experiments from the batch
            for experiment in batch.experiments:
                experiment.batch_id = batch.id
                self.experiments.append(experiment)
            
            # Update batch totals
            batch.total_experiments = len(batch.experiments)
        
        logger.info(f"Added batch {batch.id} with {len(batch.experiments)} experiments")
        return batch.id
    
    def remove_experiment(self, experiment_id: str) -> bool:
        """Remove/cancel an experiment."""
        with self._lock:
            # Find and remove from main list
            experiment = None
            for i, exp in enumerate(self.experiments):
                if exp.id == experiment_id:
                    experiment = self.experiments.pop(i)
                    break
            
            if not experiment:
                return False
            
            # Cancel if running
            if experiment_id in self.running_experiments:
                del self.running_experiments[experiment_id]
                experiment.status = ExperimentStatus.CANCELLED
            
            # Remove from batch
            if experiment.batch_id in self.batches:
                batch = self.batches[experiment.batch_id]
                batch.experiments = [e for e in batch.experiments if e.id != experiment_id]
                batch.total_experiments -= 1
        
        logger.info(f"Removed experiment {experiment_id}")
        return True
    
    def get_next_pending_experiment(self) -> Optional[QueuedExperiment]:
        """Get the next experiment to run (highest priority first)."""
        with self._lock:
            pending = [exp for exp in self.experiments if exp.status == ExperimentStatus.PENDING]
            if not pending:
                return None
            
            # Sort by priority (lower number = higher priority), then by creation time
            pending.sort(key=lambda x: (x.priority, x.created_at))
            return pending[0]
    
    def start_queue(self):
        """Start the queue processing."""
        if self.status == QueueStatus.RUNNING:
            logger.warning("Queue is already running")
            return
        
        # Kill any existing worker thread
        if self.worker_thread and self.worker_thread.is_alive():
            logger.info("Stopping existing queue worker")
            self.status = QueueStatus.STOPPED
            self.worker_thread.join(timeout=3.0)
        
        self.status = QueueStatus.RUNNING
        self.worker_thread = threading.Thread(target=self._queue_worker, daemon=True)
        self.worker_thread.start()
        logger.info(f"🚀 Queue started - status: {self.status.value}")
    
    def stop_queue(self):
        """Stop the queue processing."""
        self.status = QueueStatus.STOPPED
        if self.worker_thread:
            self.worker_thread.join(timeout=5.0)
        logger.info("Queue stopped")
    
    def pause_queue(self):
        """Pause queue processing (finish current experiments but don't start new ones)."""
        self.status = QueueStatus.PAUSED
        logger.info("Queue paused")
    
    def resume_queue(self):
        """Resume queue processing."""
        if self.status == QueueStatus.PAUSED:
            self.status = QueueStatus.RUNNING
            logger.info("Queue resumed")
    
    def _queue_worker(self):
        """Main queue processing loop (runs in background thread)."""
        logger.info(f"🔄 Queue worker started - status: {self.status.value}")
        
        while self.status in [QueueStatus.RUNNING, QueueStatus.PAUSED]:
            try:
                # Only start new experiments if not paused
                if (self.status == QueueStatus.RUNNING and 
                    len(self.running_experiments) < self.max_concurrent):
                    
                    next_experiment = self.get_next_pending_experiment()
                    if next_experiment:
                        logger.info(f"🎯 Queue worker starting experiment: {next_experiment.id}")
                        self._start_experiment(next_experiment)
                    # Log when no experiments are pending
                    elif len(self.experiments) == 0:
                        logger.debug("Queue worker: no experiments in queue")
                    else:
                        logger.debug(f"Queue worker: {len([e for e in self.experiments if e.status == ExperimentStatus.PENDING])} pending experiments")
                
                # Check for completed experiments (currently no-op but keeping for future)
                self._check_completed_experiments()
                
                # Wait before next iteration
                time.sleep(5)
                
            except Exception as e:
                logger.error(f"❌ Queue worker error: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(10)  # Wait longer on error
        
        logger.info(f"🛑 Queue worker stopped - final status: {self.status.value}")
    
    def _start_experiment(self, experiment: QueuedExperiment):
        """Start running an experiment."""
        if not self.experiment_runner:
            logger.error("No experiment runner configured")
            return
        
        with self._lock:
            experiment.status = ExperimentStatus.RUNNING
            experiment.started_at = datetime.now()
            self.running_experiments[experiment.id] = experiment
        
        logger.info(f"Starting experiment {experiment.id}: {experiment.name}")
        
        # Create progress callback for real-time updates
        def update_progress(progress_percent: int):
            """Update experiment progress in real-time."""
            with self._lock:
                experiment.progress = min(100, max(0, progress_percent))
                logger.info(f"📊 Experiment {experiment.id} progress: {experiment.progress}%")
        
        # Start experiment in separate thread
        def run_experiment():
            try:
                # Run the actual experiment with progress callback
                result = self.experiment_runner.run_experiment(experiment.config, experiment.id, progress_callback=update_progress)
                
                with self._lock:
                    experiment.status = ExperimentStatus.COMPLETED
                    experiment.completed_at = datetime.now()
                    experiment.progress = 100
                    if result and 'output_files' in result:
                        experiment.result_files = result['output_files']
                    
                    # Update batch counters
                    if experiment.batch_id in self.batches:
                        self.batches[experiment.batch_id].completed_experiments += 1
                        
                        # Check if batch is complete and generate summary
                        batch = self.batches[experiment.batch_id]
                        if (batch.completed_experiments + batch.failed_experiments) >= batch.total_experiments:
                            self._generate_batch_summary(batch)
                    
                    # Remove from running
                    if experiment.id in self.running_experiments:
                        del self.running_experiments[experiment.id]
                
                logger.info(f"Experiment {experiment.id} completed successfully")
                
            except Exception as e:
                with self._lock:
                    experiment.status = ExperimentStatus.FAILED
                    experiment.completed_at = datetime.now()
                    experiment.error_message = str(e)
                    
                    # Update batch counters
                    if experiment.batch_id in self.batches:
                        self.batches[experiment.batch_id].failed_experiments += 1
                        
                        # Check if batch is complete (including failed experiments)
                        batch = self.batches[experiment.batch_id]
                        if (batch.completed_experiments + batch.failed_experiments) >= batch.total_experiments:
                            self._generate_batch_summary(batch)
                    
                    # Remove from running
                    if experiment.id in self.running_experiments:
                        del self.running_experiments[experiment.id]
                
                logger.error(f"Experiment {experiment.id} failed: {e}")
        
        experiment_thread = threading.Thread(target=run_experiment, daemon=True)
        experiment_thread.start()
    
    def _check_completed_experiments(self):
        """Check for experiments that have finished and clean up."""
        # This is handled in the experiment threads themselves
        pass
    
    def _generate_batch_summary(self, batch: 'ExperimentBatch'):
        """Generate a comprehensive summary for completed batch."""
        try:
            logger.info(f"Generating batch summary for {batch.id}")
            
            # Create batch directory path
            batch_dir = self.results_dir / 'batch_results' / batch.id
            batch_dir.mkdir(parents=True, exist_ok=True)
            
            # Collect all result files
            csv_files = []
            metrics_files = []
            
            for experiment in batch.experiments:
                if experiment.result_files:
                    for file_path in experiment.result_files:
                        if file_path and os.path.exists(file_path):
                            if file_path.endswith('.csv'):
                                csv_files.append(file_path)
                            elif file_path.endswith('_metrics.json'):
                                metrics_files.append(file_path)
            
            # Generate batch summary data
            summary_data = {
                'batch_info': {
                    'id': batch.id,
                    'name': batch.name,
                    'description': batch.description,
                    'template_name': batch.template_name,
                    'created_at': batch.created_at.isoformat(),
                    'completed_at': datetime.now().isoformat()
                },
                'statistics': {
                    'total_experiments': batch.total_experiments,
                    'completed_experiments': batch.completed_experiments,
                    'failed_experiments': batch.failed_experiments,
                    'success_rate': (batch.completed_experiments / batch.total_experiments * 100) if batch.total_experiments > 0 else 0
                },
                'experiments': [],
                'result_files': {
                    'csv_files': csv_files,
                    'metrics_files': metrics_files
                }
            }
            
            # Add individual experiment details
            for experiment in batch.experiments:
                exp_data = {
                    'id': experiment.id,
                    'name': experiment.name,
                    'status': experiment.status.value,
                    'experiment_type': experiment.config.get('experiment_type', 'unknown'),
                    'adversarial': experiment.config.get('adversarial', False),
                    'context_strategy': experiment.config.get('context_injection_strategy'),
                    'models': experiment.config.get('models', []),
                    'created_at': experiment.created_at.isoformat() if experiment.created_at else None,
                    'started_at': experiment.started_at.isoformat() if experiment.started_at else None,
                    'completed_at': experiment.completed_at.isoformat() if experiment.completed_at else None,
                    'duration_seconds': None,
                    'result_files': experiment.result_files or [],
                    'error_message': experiment.error_message
                }
                
                # Calculate duration if both start and end times exist
                if experiment.started_at and experiment.completed_at:
                    duration = experiment.completed_at - experiment.started_at
                    exp_data['duration_seconds'] = duration.total_seconds()
                
                summary_data['experiments'].append(exp_data)
            
            # Calculate total batch duration
            start_times = [exp.started_at for exp in batch.experiments if exp.started_at]
            end_times = [exp.completed_at for exp in batch.experiments if exp.completed_at]
            
            if start_times and end_times:
                batch_start = min(start_times)
                batch_end = max(end_times)
                summary_data['statistics']['total_duration_seconds'] = (batch_end - batch_start).total_seconds()
                summary_data['statistics']['total_duration_minutes'] = summary_data['statistics']['total_duration_seconds'] / 60
            
            # Save batch summary
            summary_file = batch_dir / 'batch_summary.json'
            with open(summary_file, 'w') as f:
                json.dump(summary_data, f, indent=2, default=str)
            
            logger.info(f"✅ Batch summary generated: {summary_file}")
            
        except Exception as e:
            logger.error(f"Failed to generate batch summary for {batch.id}: {e}")
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status."""
        with self._lock:
            pending = [exp for exp in self.experiments if exp.status == ExperimentStatus.PENDING]
            running = [exp for exp in self.experiments if exp.status == ExperimentStatus.RUNNING]
            completed = [exp for exp in self.experiments if exp.status == ExperimentStatus.COMPLETED]
            failed = [exp for exp in self.experiments if exp.status == ExperimentStatus.FAILED]
            
            return {
                'queue_status': self.status.value,
                'total_experiments': len(self.experiments),
                'pending': len(pending),
                'running': len(running),
                'completed': len(completed),
                'failed': len(failed),
                'max_concurrent': self.max_concurrent,
                'batches': len(self.batches),
                'running_experiments': [exp.to_dict() for exp in running],
                'next_up': [exp.to_dict() for exp in pending[:3]]  # Next 3 in queue
            }
    
    def get_batch_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific batch."""
        if batch_id not in self.batches:
            return None
        
        batch = self.batches[batch_id]
        return {
            'id': batch.id,
            'name': batch.name,
            'description': batch.description,
            'template_name': batch.template_name,
            'created_at': batch.created_at.isoformat(),
            'status': batch.get_status(),
            'progress': batch.get_progress(),
            'total_experiments': batch.total_experiments,
            'completed_experiments': batch.completed_experiments,
            'failed_experiments': batch.failed_experiments,
            'experiments': [exp.to_dict() for exp in batch.experiments]
        }
    
    def get_all_batches(self) -> List[Dict[str, Any]]:
        """Get status of all batches."""
        return [self.get_batch_status(batch_id) for batch_id in self.batches.keys()]

# Global queue instance
_queue_instance = None

def get_queue() -> ExperimentQueue:
    """Get the global queue instance."""
    global _queue_instance
    if _queue_instance is None:
        _queue_instance = ExperimentQueue()
    return _queue_instance

def initialize_queue(experiment_runner, max_concurrent: int = None) -> ExperimentQueue:
    """Initialize the global queue with dependencies."""
    global _queue_instance
    max_concurrent = max_concurrent or int(os.getenv("MAX_CONCURRENT_EXPERIMENTS", "3"))
    _queue_instance = ExperimentQueue(max_concurrent)
    _queue_instance.set_experiment_runner(experiment_runner)
    return _queue_instance