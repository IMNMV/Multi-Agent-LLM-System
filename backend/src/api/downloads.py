# api/downloads.py
"""
In-Memory Result Access endpoints for experiment results.
Results are stored in memory and returned as JSON for frontend CSV generation.
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
import logging

from ..experiment_queue import get_queue

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/experiments/{experiment_id}/results")
async def get_experiment_results(experiment_id: str):
    """Get experiment results from in-memory storage as JSON."""
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
        
        if experiment.status.value != "completed":
            raise HTTPException(status_code=400, detail=f"Experiment {experiment_id} is not completed yet. Status: {experiment.status.value}")
        
        # Check if we have in-memory results
        if not experiment.results_data:
            raise HTTPException(status_code=404, detail=f"No results data found for experiment {experiment_id}")
        
        # Return results data for frontend to convert to CSV
        return {
            "success": True,
            "data": {
                "experiment_id": experiment_id,
                "results": experiment.results_data,
                "metadata": experiment.metadata or {},
                "metrics": experiment.metrics or {},
                "status": experiment.status.value,
                "total_results": len(experiment.results_data),
                "completed_at": experiment.completed_at.isoformat() if experiment.completed_at else None,
                "name": experiment.name
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting experiment results: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/experiments/{experiment_id}/metadata")
async def get_experiment_metadata(experiment_id: str):
    """Get experiment metadata from in-memory storage."""
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
        
        return {
            "success": True,
            "data": {
                "experiment_id": experiment.id,
                "name": experiment.name,
                "status": experiment.status.value,
                "progress": experiment.progress,
                "created_at": experiment.created_at.isoformat() if experiment.created_at else None,
                "started_at": experiment.started_at.isoformat() if experiment.started_at else None,
                "completed_at": experiment.completed_at.isoformat() if experiment.completed_at else None,
                "config": experiment.config,
                "metadata": experiment.metadata or {},
                "metrics": experiment.metrics or {},
                "error_message": experiment.error_message,
                "has_results": bool(experiment.results_data),
                "total_results": len(experiment.results_data) if experiment.results_data else 0
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting experiment metadata: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/experiments/{experiment_id}/preview")
async def preview_experiment_results(experiment_id: str, lines: int = 10):
    """Preview the first few results from in-memory storage."""
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
        
        if not experiment.results_data:
            raise HTTPException(status_code=404, detail="No results data available")
        
        # Return preview of first N results
        preview_results = experiment.results_data[:lines]
        
        return {
            "experiment_id": experiment_id,
            "total_results": len(experiment.results_data),
            "preview_count": len(preview_results),
            "preview": preview_results
        }
    
    except Exception as e:
        logger.error(f"Error previewing results: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/experiments/{experiment_id}/download-info")
async def get_download_info(experiment_id: str):
    """Get download information for an experiment (in-memory storage)."""
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
        
        if experiment.status.value != "completed":
            return {
                "available": False,
                "reason": f"Experiment is {experiment.status.value}, not completed"
            }
        
        if not experiment.results_data:
            return {
                "available": False,
                "reason": "No results data available"
            }
        
        return {
            "available": True,
            "experiment_id": experiment_id,
            "name": experiment.name,
            "total_results": len(experiment.results_data),
            "formats_available": ["csv", "json"],
            "size_estimate": f"{len(str(experiment.results_data))} characters",
            "completed_at": experiment.completed_at.isoformat() if experiment.completed_at else None
        }
    
    except Exception as e:
        logger.error(f"Error getting download info: {e}")
        raise HTTPException(status_code=500, detail=str(e))