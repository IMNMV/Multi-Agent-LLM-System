# api/queue.py
"""
Queue management API endpoints.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any
import logging

from ..experiment_queue import get_queue
from ..models.experiment import BatchStatus

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/status")
async def get_queue_status():
    """Get current queue status."""
    try:
        queue = get_queue()
        status = queue.get_queue_status()
        
        return {
            "queue_status": status["queue_status"],
            "statistics": {
                "total_experiments": status["total_experiments"],
                "pending": status["pending"],
                "running": status["running"],
                "completed": status["completed"],
                "failed": status["failed"],
                "max_concurrent": status["max_concurrent"],
                "total_batches": status["batches"]
            },
            "running_experiments": status["running_experiments"],
            "next_up": status["next_up"]
        }
    
    except Exception as e:
        logger.error(f"Error getting queue status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start")
async def start_queue():
    """Start the experiment queue processing."""
    try:
        queue = get_queue()
        queue.start_queue()
        
        logger.info("Queue started via API")
        return {"message": "Queue started successfully"}
    
    except Exception as e:
        logger.error(f"Error starting queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop")
async def stop_queue():
    """Stop the experiment queue processing."""
    try:
        queue = get_queue()
        queue.stop_queue()
        
        logger.info("Queue stopped via API")
        return {"message": "Queue stopped successfully"}
    
    except Exception as e:
        logger.error(f"Error stopping queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pause")
async def pause_queue():
    """Pause the experiment queue processing."""
    try:
        queue = get_queue()
        queue.pause_queue()
        
        logger.info("Queue paused via API")
        return {"message": "Queue paused successfully"}
    
    except Exception as e:
        logger.error(f"Error pausing queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/resume")
async def resume_queue():
    """Resume the experiment queue processing."""
    try:
        queue = get_queue()
        queue.resume_queue()
        
        logger.info("Queue resumed via API")
        return {"message": "Queue resumed successfully"}
    
    except Exception as e:
        logger.error(f"Error resuming queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/batches")
async def list_batches():
    """List all experiment batches."""
    try:
        queue = get_queue()
        batches = queue.get_all_batches()
        
        return {"batches": batches}
    
    except Exception as e:
        logger.error(f"Error listing batches: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/batches/{batch_id}")
async def get_batch_status(batch_id: str):
    """Get status of a specific batch."""
    try:
        queue = get_queue()
        batch_status = queue.get_batch_status(batch_id)
        
        if not batch_status:
            raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")
        
        return batch_status
    
    except Exception as e:
        logger.error(f"Error getting batch status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/batches/{batch_id}")
async def cancel_batch(batch_id: str):
    """Cancel all experiments in a batch."""
    try:
        queue = get_queue()
        
        # Find batch
        if batch_id not in queue.batches:
            raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")
        
        batch = queue.batches[batch_id]
        cancelled_count = 0
        
        # Cancel all experiments in the batch
        for experiment in batch.experiments:
            if experiment.status.value in ["pending", "running"]:
                success = queue.remove_experiment(experiment.id)
                if success:
                    cancelled_count += 1
        
        logger.info(f"Cancelled {cancelled_count} experiments from batch {batch_id}")
        
        return {
            "message": f"Batch {batch_id} cancelled",
            "cancelled_experiments": cancelled_count
        }
    
    except Exception as e:
        logger.error(f"Error cancelling batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics")
async def get_queue_metrics():
    """Get detailed queue metrics and performance data."""
    try:
        queue = get_queue()
        status = queue.get_queue_status()
        
        # Calculate additional metrics
        total_experiments = status["total_experiments"]
        active_experiments = status["running"]
        utilization = (active_experiments / queue.max_concurrent) * 100 if queue.max_concurrent > 0 else 0
        
        # Get batch statistics
        batches = queue.get_all_batches()
        batch_stats = {
            "total_batches": len(batches),
            "active_batches": len([b for b in batches if b["status"] in ["pending", "running"]]),
            "completed_batches": len([b for b in batches if b["status"] == "completed"]),
            "failed_batches": len([b for b in batches if b["status"] == "completed_with_failures"])
        }
        
        return {
            "queue_metrics": {
                "utilization_percentage": round(utilization, 2),
                "max_concurrent": queue.max_concurrent,
                "current_running": active_experiments,
                "total_processed": status["completed"] + status["failed"],
                "success_rate": round((status["completed"] / max(1, status["completed"] + status["failed"])) * 100, 2)
            },
            "experiment_stats": {
                "total": total_experiments,
                "pending": status["pending"],
                "running": status["running"],
                "completed": status["completed"],
                "failed": status["failed"]
            },
            "batch_stats": batch_stats,
            "queue_status": status["queue_status"]
        }
    
    except Exception as e:
        logger.error(f"Error getting queue metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))