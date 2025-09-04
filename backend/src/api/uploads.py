# api/uploads.py
"""
File upload API endpoints.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Dict, Any
import logging
import os
import tempfile
import csv
import json
from pathlib import Path

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), domain: str = Form(...)):
    """Upload and validate experiment data file."""
    try:
        # Validate file type
        if not file.filename.endswith(('.csv', '.tsv', '.txt', '.json')):
            raise HTTPException(status_code=400, detail="Only CSV, TSV, TXT, and JSON files are supported")
        
        # Read file content
        content = await file.read()
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            # Validate file content based on type
            validation_results = validate_file_content(tmp_path, file.filename, domain)
            
            # Store file info for experiments (in production, you'd save this to database)
            file_info = {
                "filename": file.filename,
                "domain": domain,
                "size": len(content),
                "temp_path": tmp_path,
                "validation": validation_results
            }
            
            return {
                "success": True,
                "message": "File uploaded and validated successfully",
                "file_info": file_info,
                "validation": validation_results
            }
            
        except Exception as validation_error:
            # Clean up temp file on validation error
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise HTTPException(status_code=400, detail=f"File validation failed: {str(validation_error)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def validate_file_content(file_path: str, filename: str, domain: str) -> Dict[str, Any]:
    """Validate uploaded file content."""
    try:
        validation_results = {
            "valid": True,
            "message": "File validation passed",
            "row_count": 0,
            "columns": [],
            "sample_data": []
        }
        
        if filename.endswith('.csv') or filename.endswith('.tsv'):
            delimiter = '\t' if filename.endswith('.tsv') else ','
            
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.reader(f, delimiter=delimiter)
                headers = next(reader, None)
                
                if not headers:
                    raise ValueError("File appears to be empty or has no headers")
                
                validation_results["columns"] = headers
                
                # Count rows and get sample data
                rows = list(reader)
                validation_results["row_count"] = len(rows)
                validation_results["sample_data"] = rows[:3]  # First 3 rows as sample
                
                # Domain-specific validation
                if domain == "fake_news":
                    required_columns = ["text", "label"]
                    missing = [col for col in required_columns if col not in headers]
                    if missing:
                        raise ValueError(f"Missing required columns for fake news detection: {missing}")
                
                elif domain == "ai_text_detection":
                    required_columns = ["text", "label"]
                    missing = [col for col in required_columns if col not in headers]
                    if missing:
                        raise ValueError(f"Missing required columns for AI text detection: {missing}")
                
                elif domain == "sentiment_analysis":
                    required_columns = ["text", "sentiment"]
                    missing = [col for col in required_columns if col not in headers]
                    if missing:
                        raise ValueError(f"Missing required columns for sentiment analysis: {missing}")
                
        elif filename.endswith('.json'):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                if isinstance(data, list):
                    validation_results["row_count"] = len(data)
                    if data:
                        validation_results["columns"] = list(data[0].keys()) if isinstance(data[0], dict) else []
                        validation_results["sample_data"] = data[:3]
                else:
                    validation_results["columns"] = list(data.keys()) if isinstance(data, dict) else []
                    validation_results["sample_data"] = [data]
        
        else:
            # Plain text file
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                validation_results["row_count"] = len(lines)
                validation_results["sample_data"] = lines[:3]
        
        return validation_results
        
    except Exception as e:
        return {
            "valid": False,
            "message": f"Validation error: {str(e)}",
            "row_count": 0,
            "columns": [],
            "sample_data": []
        }