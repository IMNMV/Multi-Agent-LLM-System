# api/health.py
"""
Health check endpoints for Railway monitoring.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import os
import time
from datetime import datetime

router = APIRouter()

@router.get("/health")
async def health_check():
    """Health check endpoint for Railway."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": os.getenv("ENVIRONMENT", "production"),
        "version": "1.0.0"
    }

@router.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with system information."""
    try:
        # Check environment variables
        required_env_vars = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "TOGETHER_API_KEY"]
        env_status = {}
        
        for var in required_env_vars:
            env_status[var] = bool(os.getenv(var))
        
        # Check API client status (would need to import from main)
        api_status = {
            "clients_initialized": True,  # Placeholder
            "available_providers": ["claude", "openai", "together", "gemini"]
        }
        
        # Check queue status
        queue_status = {
            "queue_running": True,  # Placeholder
            "pending_experiments": 0,
            "running_experiments": 0
        }
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "environment": {
                "ENVIRONMENT": os.getenv("ENVIRONMENT", "production"),
                "PORT": os.getenv("PORT", "8000"),
                "MAX_CONCURRENT_EXPERIMENTS": os.getenv("MAX_CONCURRENT_EXPERIMENTS", "3"),
                "env_vars": env_status
            },
            "services": {
                "api": api_status,
                "queue": queue_status
            },
            "system": {
                "uptime_seconds": time.time(),  # Placeholder
                "memory_usage": "N/A",  # Could add psutil for real monitoring
                "disk_usage": "N/A"
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@router.get("/ready")
async def readiness_check():
    """Readiness check for Railway deployment."""
    # Check if critical services are ready
    try:
        # Placeholder checks - would verify:
        # - API clients initialized
        # - Queue system running
        # - Database connections (if applicable)
        
        return {
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat(),
            "services_ready": True
        }
    
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"System not ready: {str(e)}")