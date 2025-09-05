# api/experiments.py
"""
Experiment management API endpoints.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, List, Any, Optional
import uuid
from datetime import datetime
import logging

from ..models.experiment import (
    ExperimentRequest, ExperimentResponse, ExperimentStatus,
    BatchRequest, BatchResponse, BatchStatus
)
from ..experiment_queue import get_queue, QueuedExperiment, ExperimentBatch
from ..unified_config import get_config_manager

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/start", response_model=ExperimentResponse)
async def start_experiment(request: ExperimentRequest, background_tasks: BackgroundTasks):
    """Start a new experiment."""
    try:
        config_manager = get_config_manager()
        queue = get_queue()
        
        # Validate domain
        if request.domain not in config_manager.list_domains():
            raise HTTPException(status_code=400, detail=f"Domain '{request.domain}' not found")
        
        # Get domain configuration
        domain_config = config_manager.get_domain_config(request.domain)
        if not domain_config.get("enabled"):
            raise HTTPException(status_code=400, detail=f"Domain '{request.domain}' is disabled")
        
        # Validate models
        available_models = list(domain_config["api_configs"].keys())
        invalid_models = [model for model in request.models if model not in available_models]
        if invalid_models:
            raise HTTPException(status_code=400, detail=f"Invalid models: {invalid_models}")
        
        # Retrieve dataset content from SESSION_DATASETS in same process and pass it through config
        dataset_content = None
        if request.dataset_session_id and request.dataset_path:
            try:
                # Access SESSION_DATASETS directly from main module (same process)
                from ..main import SESSION_DATASETS
                
                logger.info(f"🔍 Accessing SESSION_DATASETS with {len(SESSION_DATASETS)} sessions")
                logger.info(f"🔍 Looking for session: {request.dataset_session_id[:8]}...")
                logger.info(f"🔍 Looking for dataset: {request.dataset_path}")
                
                if request.dataset_session_id in SESSION_DATASETS:
                    session_datasets = SESSION_DATASETS[request.dataset_session_id]
                    logger.info(f"🔍 Available datasets in session: {list(session_datasets.keys())}")
                    
                    if request.dataset_path in session_datasets:
                        dataset_content = session_datasets[request.dataset_path]
                        logger.info(f"✅ Retrieved dataset content ({len(dataset_content)} chars)")
                    else:
                        logger.error(f"❌ Dataset {request.dataset_path} not found in session")
                        raise HTTPException(status_code=400, detail=f"Dataset {request.dataset_path} not found in uploaded files")
                else:
                    logger.error(f"❌ Session {request.dataset_session_id[:8]}... not found")
                    logger.error(f"Available sessions: {list(SESSION_DATASETS.keys())}")
                    raise HTTPException(status_code=400, detail=f"Upload session not found. Please upload dataset first.")
                    
            except ImportError as e:
                logger.error(f"❌ Failed to import SESSION_DATASETS: {e}")
                raise HTTPException(status_code=500, detail="Internal server error accessing uploaded datasets")
            except HTTPException:
                raise  # Re-raise HTTP exceptions
            except Exception as e:
                logger.error(f"❌ Unexpected error retrieving dataset: {e}")
                raise HTTPException(status_code=500, detail=f"Error accessing dataset: {str(e)}")
        
        if request.dataset_path and not dataset_content:
            raise HTTPException(status_code=400, detail="Dataset content could not be retrieved. Please re-upload your dataset.")
        
        # Create experiment configuration
        experiment_config = {
            "domain": request.domain,
            "experiment_type": request.experiment_type.value,
            "models": request.models,
            "context_injection_strategy": request.context_strategy.value,
            "adversarial": request.adversarial,
            "temperature": request.temperature,
            "num_articles": request.num_articles,
            "session_id": request.session_id,  # Pass session ID for API keys
            "dataset_session_id": request.dataset_session_id,  # Pass dataset session ID for data access
            "dataset_path": request.dataset_path,  # Pass dataset path
            "dataset_content": dataset_content,  # Pass actual dataset content directly
            "domain_config": domain_config
        }
        
        # Create queued experiment
        experiment_id = str(uuid.uuid4())
        batch_id = request.batch_id or str(uuid.uuid4())
        
        queued_experiment = QueuedExperiment(
            id=experiment_id,
            batch_id=batch_id,
            name=request.name,
            config=experiment_config,
            priority=request.priority,
            estimated_duration_minutes=15  # Default estimate
        )
        
        # Add to queue
        queue.add_experiment(queued_experiment)
        
        # Start queue if not running
        if queue.status.value == "stopped":
            queue.start_queue()
        
        logger.info(f"Started experiment {experiment_id}: {request.name}")
        
        return ExperimentResponse(
            experiment_id=experiment_id,
            status="pending",
            message=f"Experiment '{request.name}' queued successfully",
            estimated_duration_minutes=15
        )
    
    except Exception as e:
        logger.error(f"Error starting experiment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch", response_model=BatchResponse)
async def start_batch(request: BatchRequest, background_tasks: BackgroundTasks):
    """Start a batch of experiments."""
    try:
        queue = get_queue()
        
        # Create batch
        batch_id = str(uuid.uuid4())
        experiments = []
        
        for exp_request in request.experiments:
            # Create experiment configuration (similar to single experiment)
            config_manager = get_config_manager()
            
            # Validate domain
            if exp_request.domain not in config_manager.list_domains():
                raise HTTPException(status_code=400, detail=f"Domain '{exp_request.domain}' not found")
            
            domain_config = config_manager.get_domain_config(exp_request.domain)
            if not domain_config.get("enabled"):
                raise HTTPException(status_code=400, detail=f"Domain '{exp_request.domain}' is disabled")
            
            experiment_config = {
                "domain": exp_request.domain,
                "experiment_type": exp_request.experiment_type.value,
                "models": exp_request.models,
                "context_injection_strategy": exp_request.context_strategy.value,
                "adversarial": exp_request.adversarial,
                "temperature": exp_request.temperature,
                "num_articles": exp_request.num_articles,
                "domain_config": domain_config
            }
            
            experiment_id = str(uuid.uuid4())
            queued_experiment = QueuedExperiment(
                id=experiment_id,
                batch_id=batch_id,
                name=exp_request.name,
                config=experiment_config,
                priority=exp_request.priority,
                estimated_duration_minutes=15
            )
            
            experiments.append(queued_experiment)
        
        # Create batch
        batch = ExperimentBatch(
            id=batch_id,
            name=request.name,
            description=request.description,
            template_name=request.template_name,
            experiments=experiments
        )
        
        # Add batch to queue
        queue.add_batch(batch)
        
        # Start queue if not running
        if queue.status.value == "stopped":
            queue.start_queue()
        
        logger.info(f"Started batch {batch_id} with {len(experiments)} experiments")
        
        return BatchResponse(
            batch_id=batch_id,
            name=request.name,
            total_experiments=len(experiments),
            status="pending",
            message=f"Batch '{request.name}' queued successfully with {len(experiments)} experiments"
        )
    
    except Exception as e:
        logger.error(f"Error starting batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{experiment_id}/status", response_model=ExperimentStatus)
async def get_experiment_status(experiment_id: str):
    """Get status of a specific experiment."""
    try:
        queue = get_queue()
        
        # Find experiment
        experiment = None
        for exp in queue.experiments:
            if exp.id == experiment_id:
                experiment = exp
                break
        
        if not experiment:
            raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
        
        return ExperimentStatus(
            id=experiment.id,
            name=experiment.name,
            status=experiment.status.value,
            progress=experiment.progress,
            created_at=experiment.created_at,
            started_at=experiment.started_at,
            completed_at=experiment.completed_at,
            error_message=experiment.error_message,
            result_files=experiment.result_files or [],
            config=experiment.config
        )
    
    except Exception as e:
        logger.error(f"Error getting experiment status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{experiment_id}")
async def cancel_experiment(experiment_id: str):
    """Cancel a specific experiment."""
    try:
        queue = get_queue()
        
        success = queue.remove_experiment(experiment_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Experiment {experiment_id} not found")
        
        logger.info(f"Cancelled experiment {experiment_id}")
        
        return {"message": f"Experiment {experiment_id} cancelled successfully"}
    
    except Exception as e:
        logger.error(f"Error cancelling experiment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def list_experiments():
    """List all experiments with their status."""
    try:
        queue = get_queue()
        
        experiments = []
        for exp in queue.experiments:
            experiments.append({
                "id": exp.id,
                "name": exp.name,
                "status": exp.status.value,
                "progress": exp.progress,
                "created_at": exp.created_at.isoformat(),
                "domain": exp.config.get("domain"),
                "experiment_type": exp.config.get("experiment_type")
            })
        
        return {"experiments": experiments}
    
    except Exception as e:
        logger.error(f"Error listing experiments: {e}")
        raise HTTPException(status_code=500, detail=str(e))