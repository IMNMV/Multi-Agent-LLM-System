# api/downloads.py
"""
File download endpoints for experiment results.
"""

import os
import zipfile
import csv
import json
import tempfile
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse, StreamingResponse
from typing import List, Optional
import logging
from pathlib import Path

from ..experiment_queue import get_queue

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/experiments/{experiment_id}/results")
async def get_experiment_results(experiment_id: str, download: bool = False, format: str = "csv"):
    """Download results for a specific experiment."""
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
            raise HTTPException(status_code=400, detail=f"Experiment {experiment_id} is not completed yet")
        
        if not experiment.result_files:
            raise HTTPException(status_code=404, detail=f"No result files found for experiment {experiment_id}")
        
        # Find the main CSV file
        csv_files = [f for f in experiment.result_files if f.endswith('.csv')]
        if not csv_files:
            raise HTTPException(status_code=404, detail="No CSV files found for this experiment")
        
        main_csv = csv_files[0]  # Take the first CSV file
        
        if not os.path.exists(main_csv):
            raise HTTPException(status_code=404, detail="Result file not found on disk")
        
        # If download=True, return file for download
        if download:
            if format.lower() == "csv":
                return FileResponse(
                    path=main_csv,
                    filename=f"experiment_{experiment_id}_results.csv",
                    media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=experiment_{experiment_id}_results.csv"}
                )
            
            elif format.lower() == "json":
                # Convert CSV to JSON for download
                try:
                    import pandas as pd
                    df = pd.read_csv(main_csv)
                    json_data = df.to_json(orient='records', indent=2)
                except ImportError:
                    # Fallback: simple CSV to JSON conversion without pandas
                    import csv
                    data = []
                    with open(main_csv, 'r', encoding='utf-8') as f:
                        reader = csv.DictReader(f)
                        data = list(reader)
                    json_data = json.dumps(data, indent=2)
                
                return Response(
                    content=json_data,
                    media_type="application/json",
                    headers={"Content-Disposition": f"attachment; filename=experiment_{experiment_id}_results.json"}
                )
        
        else:
            # Return JSON data for display in frontend
            try:
                import pandas as pd
                df = pd.read_csv(main_csv)
                data = df.to_dict('records')
            except ImportError:
                # Fallback: simple CSV reading without pandas
                import csv
                data = []
                with open(main_csv, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    data = list(reader)
            
            return {
                "success": True,
                "data": {
                    "experiment_id": experiment_id,
                    "results": data,
                    "file_count": len(experiment.result_files),
                    "status": experiment.status.value
                }
            }
        
        if download and format.lower() not in ["csv", "json"]:
            raise HTTPException(status_code=400, detail="Unsupported format. Use 'csv' or 'json'")
    
    except Exception as e:
        logger.error(f"Error downloading experiment results: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/experiments/{experiment_id}/files")
async def download_all_experiment_files(experiment_id: str):
    """Download all files for an experiment as a ZIP archive."""
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
        
        if not experiment.result_files:
            raise HTTPException(status_code=404, detail=f"No result files found for experiment {experiment_id}")
        
        # Create temporary ZIP file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp_file:
            zip_path = tmp_file.name
        
        try:
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for file_path in experiment.result_files:
                    if os.path.exists(file_path):
                        # Add file to zip with a clean name
                        file_name = os.path.basename(file_path)
                        zip_file.write(file_path, file_name)
                
                # Add experiment metadata as JSON
                metadata = {
                    "experiment_id": experiment.id,
                    "name": experiment.name,
                    "status": experiment.status.value,
                    "created_at": experiment.created_at.isoformat() if experiment.created_at else None,
                    "started_at": experiment.started_at.isoformat() if experiment.started_at else None,
                    "completed_at": experiment.completed_at.isoformat() if experiment.completed_at else None,
                    "config": experiment.config
                }
                
                zip_file.writestr("experiment_metadata.json", json.dumps(metadata, indent=2))
            
            return FileResponse(
                path=zip_path,
                filename=f"experiment_{experiment_id}_complete.zip",
                media_type="application/zip",
                headers={"Content-Disposition": f"attachment; filename=experiment_{experiment_id}_complete.zip"}
            )
        
        finally:
            # Clean up temporary file after response
            def cleanup():
                try:
                    os.unlink(zip_path)
                except:
                    pass
            
            # Note: In production, you might want to use a background task for cleanup
    
    except Exception as e:
        logger.error(f"Error creating ZIP download: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/batches/{batch_id}/results")
async def download_batch_results(batch_id: str, format: str = "zip"):
    """Download results for an entire batch."""
    try:
        queue = get_queue()
        
        if batch_id not in queue.batches:
            raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")
        
        batch = queue.batches[batch_id]
        
        # Check if batch is completed
        if batch.get_status() not in ["completed", "completed_with_failures"]:
            raise HTTPException(status_code=400, detail=f"Batch {batch_id} is not completed yet")
        
        # Create temporary ZIP file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp_file:
            zip_path = tmp_file.name
        
        try:
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                # Add each experiment's results
                for experiment in batch.experiments:
                    if experiment.result_files:
                        # Create a folder for each experiment
                        exp_folder = f"experiment_{experiment.id}_{experiment.name}/"
                        
                        for file_path in experiment.result_files:
                            if os.path.exists(file_path):
                                file_name = os.path.basename(file_path)
                                zip_file.write(file_path, exp_folder + file_name)
                        
                        # Add experiment metadata
                        exp_metadata = {
                            "experiment_id": experiment.id,
                            "name": experiment.name,
                            "status": experiment.status.value,
                            "created_at": experiment.created_at.isoformat() if experiment.created_at else None,
                            "completed_at": experiment.completed_at.isoformat() if experiment.completed_at else None,
                            "config": experiment.config,
                            "error_message": experiment.error_message
                        }
                        zip_file.writestr(exp_folder + "metadata.json", json.dumps(exp_metadata, indent=2))
                
                # Add batch summary
                batch_summary = {
                    "batch_id": batch.id,
                    "name": batch.name,
                    "description": batch.description,
                    "status": batch.get_status(),
                    "progress": batch.get_progress(),
                    "total_experiments": batch.total_experiments,
                    "completed_experiments": batch.completed_experiments,
                    "failed_experiments": batch.failed_experiments,
                    "created_at": batch.created_at.isoformat(),
                    "experiments": [exp.id for exp in batch.experiments]
                }
                zip_file.writestr("batch_summary.json", json.dumps(batch_summary, indent=2))
            
            return FileResponse(
                path=zip_path,
                filename=f"batch_{batch_id}_results.zip",
                media_type="application/zip",
                headers={"Content-Disposition": f"attachment; filename=batch_{batch_id}_results.zip"}
            )
        
        finally:
            # Clean up temporary file
            def cleanup():
                try:
                    os.unlink(zip_path)
                except:
                    pass
    
    except Exception as e:
        logger.error(f"Error downloading batch results: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/experiments/{experiment_id}/preview")
async def preview_experiment_results(experiment_id: str, lines: int = 10):
    """Preview the first few lines of experiment results."""
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
        
        if not experiment.result_files:
            raise HTTPException(status_code=404, detail=f"No result files found for experiment {experiment_id}")
        
        # Find CSV file
        csv_files = [f for f in experiment.result_files if f.endswith('.csv')]
        if not csv_files:
            raise HTTPException(status_code=404, detail="No CSV files found")
        
        main_csv = csv_files[0]
        
        if not os.path.exists(main_csv):
            raise HTTPException(status_code=404, detail="Result file not found")
        
        # Read first few lines
        preview_lines = []
        with open(main_csv, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i >= lines:
                    break
                preview_lines.append(line.strip())
        
        return {
            "experiment_id": experiment_id,
            "file_path": os.path.basename(main_csv),
            "total_lines": len(preview_lines),
            "preview": preview_lines
        }
    
    except Exception as e:
        logger.error(f"Error previewing results: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/experiments/{experiment_id}/stats")
async def get_experiment_statistics(experiment_id: str):
    """Get basic statistics about experiment results."""
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
        
        if not experiment.result_files:
            return {"message": "No result files available"}
        
        # Find CSV file
        csv_files = [f for f in experiment.result_files if f.endswith('.csv')]
        if not csv_files:
            return {"message": "No CSV files found"}
        
        main_csv = csv_files[0]
        
        if not os.path.exists(main_csv):
            return {"message": "Result file not found"}
        
        # Get basic file stats
        file_stats = os.stat(main_csv)
        
        # Count lines
        line_count = 0
        with open(main_csv, 'r', encoding='utf-8') as f:
            line_count = sum(1 for line in f)
        
        return {
            "experiment_id": experiment_id,
            "file_size_bytes": file_stats.st_size,
            "file_size_mb": round(file_stats.st_size / (1024 * 1024), 2),
            "total_lines": line_count,
            "data_rows": line_count - 1,  # Assuming header row
            "created": file_stats.st_ctime,
            "modified": file_stats.st_mtime,
            "available_formats": ["csv", "json", "zip"]
        }
    
    except Exception as e:
        logger.error(f"Error getting experiment stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))