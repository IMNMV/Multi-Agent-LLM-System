# api/uploads_simple.py
"""
Simple file upload API endpoint for testing.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), domain: str = Form(...)):
    """Simple file upload endpoint."""
    try:
        # Basic validation
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Read file content
        content = await file.read()
        
        return {
            "success": True,
            "message": "File uploaded successfully",
            "filename": file.filename,
            "size": len(content),
            "domain": domain
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))