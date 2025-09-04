# api/visualizations.py
"""
Visualization API endpoints.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/available-files")
async def get_available_files():
    """Get list of files available for visualization."""
    try:
        # Mock implementation - in production this would scan result files
        mock_files = [
            {
                "file_path": "/results/experiment_001/results.csv",
                "experiment_id": "001",
                "name": "Fake News Detection Results",
                "size": 15420,
                "created": "2025-01-15T10:30:00Z"
            },
            {
                "file_path": "/results/experiment_002/results.csv", 
                "experiment_id": "002",
                "name": "AI Text Detection Results",
                "size": 23150,
                "created": "2025-01-15T11:45:00Z"
            }
        ]
        
        return {
            "success": True,
            "data": {
                "files": mock_files,
                "count": len(mock_files)
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting available files: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auto-detect-type")
async def auto_detect_visualization_type(request: Dict[str, Any]):
    """Auto-detect the best visualization type for a file."""
    try:
        file_path = request.get("file_path", "")
        
        # Mock implementation - in production this would analyze the file
        mock_detection = {
            "condition_type": "experiment_comparison",
            "confidence": 0.95,
            "suggested_charts": ["bar_chart", "line_chart", "scatter_plot"],
            "data_summary": {
                "numeric_columns": ["accuracy", "precision", "recall", "f1_score"],
                "categorical_columns": ["model", "domain", "experiment_type"],
                "row_count": 150
            }
        }
        
        return {
            "success": True,
            "data": mock_detection
        }
    
    except Exception as e:
        logger.error(f"Error auto-detecting visualization type: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create")
async def create_visualizations(request: Dict[str, Any]):
    """Create publication-quality visualizations."""
    try:
        # Mock implementation - in production this would generate actual charts
        chart_type = request.get("chart_type", "bar_chart")
        file_path = request.get("file_path", "")
        
        mock_results = {
            "charts_created": [
                {
                    "type": chart_type,
                    "title": f"Model Performance Comparison ({chart_type.replace('_', ' ').title()})",
                    "file_path": f"/visualizations/{chart_type}_001.png",
                    "thumbnail": f"/visualizations/thumb_{chart_type}_001.png",
                    "data_points": 25
                }
            ],
            "summary": {
                "total_charts": 1,
                "processing_time": "2.3s",
                "output_format": "PNG",
                "resolution": "1920x1080"
            }
        }
        
        return {
            "success": True,
            "data": mock_results
        }
    
    except Exception as e:
        logger.error(f"Error creating visualizations: {e}")
        raise HTTPException(status_code=500, detail=str(e))