# main.py
"""
FastAPI application entry point for Railway deployment.
Multi-Agent Experiment System REST API.
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer
from typing import Dict, List, Any, Optional
import uvicorn

# Import our modules
from .unified_config import get_config_manager, create_toggles
from .unified_utils import initialize_clients, validate_environment_variables
from .experiment_queue import get_queue, initialize_queue
from .models.experiment import ExperimentRequest, ExperimentResponse
from .api.experiments import router as experiments_router
from .api.queue import router as queue_router
from .api.health import router as health_router
from .api.downloads import router as downloads_router
from .api.sessions import router as sessions_router
# Disable uploads router completely - FastAPI file upload issue
# from .api.uploads_simple import router as uploads_router
# from .api.visualizations import router as visualizations_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global variables
config_manager = None
experiment_queue = None

# SESSION-ISOLATED IN-MEMORY DATASET STORAGE
# Each session gets its own isolated data space
SESSION_DATASETS = {}  # {session_id: {dataset_id: dataset_content}}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - startup and shutdown."""
    global config_manager, experiment_queue
    
    logger.info("🚀 Starting Multi-Agent Experiment System...")
    
    # Validate environment variables
    env_validation = validate_environment_variables()
    missing_keys = [key for key, valid in env_validation.items() if not valid]
    
    if missing_keys:
        logger.warning(f"⚠️  Missing API keys: {missing_keys}")
        logger.warning("Some AI providers may not be available")
    else:
        logger.info("✅ All API keys found")
    
    # Initialize configuration manager
    config_manager = get_config_manager()
    logger.info(f"📋 Loaded {len(config_manager.list_domains())} domains: {config_manager.list_domains()}")
    
    # Initialize API clients
    try:
        from .unified_config import API_KEYS
        initialize_clients(API_KEYS)
        logger.info("🔌 API clients initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize API clients: {e}")
    
    # Initialize experiment queue with production runner
    try:
        from .experiment_runner import UnifiedExperimentRunner
        
        # Create results directory
        results_dir = os.getenv("RESULTS_DIR", "/app/results")
        os.makedirs(results_dir, exist_ok=True)
        logger.info(f"📁 Results directory: {results_dir}")
        
        # Initialize production experiment runner
        runner = UnifiedExperimentRunner(results_dir=results_dir)
        experiment_queue = initialize_queue(runner)
        logger.info("🚀 Production experiment runner initialized")
        logger.info("📋 Experiment queue initialized")
    except Exception as e:
        logger.error(f"❌ CRITICAL: Failed to initialize experiment queue: {e}")
        # FAIL HARD - NO FALLBACK RUNNERS
        raise RuntimeError(f"PRODUCTION SYSTEM FAILED TO START: {e}")
    
    logger.info("✅ Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Multi-Agent Experiment System...")
    if experiment_queue:
        experiment_queue.stop_queue()
    logger.info("✅ Shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="Multi-Agent Experiment System",
    description="A sophisticated multi-agent AI experiment framework for collaborative and adversarial model evaluation",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
if not allowed_origins or allowed_origins == [""]:
    # Default origins for development
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:8000",
        "https://imnmv.github.io"  # Updated with actual GitHub Pages URL
    ]
else:
    # Clean up whitespace and ensure we have the correct domain
    allowed_origins = [origin.strip() for origin in allowed_origins if origin.strip()]
    if "https://imnmv.github.io" not in allowed_origins:
        allowed_origins.append("https://imnmv.github.io")

logger.info(f"🌐 CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Security middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    
    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https:; "
        "font-src 'self' https:; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    
    # Additional security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    return response

# Include routers
app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(sessions_router, prefix="/api/sessions", tags=["sessions"])
app.include_router(experiments_router, prefix="/api/experiments", tags=["experiments"])
app.include_router(queue_router, prefix="/api/queue", tags=["queue"])
app.include_router(downloads_router, prefix="/api/downloads", tags=["downloads"])
# Disable uploads router completely - FastAPI file upload issue  
# app.include_router(uploads_router, prefix="/api", tags=["uploads"])
# app.include_router(visualizations_router, prefix="/api/visualizations", tags=["visualizations"])

# DEBUG ENDPOINT TO CHECK SESSION_DATASETS MEMORY STATE
@app.get("/api/debug/sessions")
async def debug_sessions():
    """Debug endpoint to check SESSION_DATASETS memory state."""
    try:
        sessions_info = {}
        for session_id, datasets in SESSION_DATASETS.items():
            sessions_info[session_id] = {
                "dataset_count": len(datasets),
                "dataset_ids": list(datasets.keys()),
                "total_size": sum(len(str(content)) for content in datasets.values())
            }
        
        return {
            "total_sessions": len(SESSION_DATASETS),
            "sessions": sessions_info,
            "memory_usage": f"{sum(len(str(datasets)) for datasets in SESSION_DATASETS.values())} chars"
        }
    except Exception as e:
        logger.error(f"Debug endpoint error: {e}")
        return {"error": str(e)}

# Add working file upload endpoint with python-multipart support
@app.post("/api/upload")
async def upload_file(request: Request):
    """File upload endpoint - SESSION-ISOLATED IN-MEMORY STORAGE."""
    try:
        # Get or create session ID for privacy isolation
        session_id = request.headers.get('x-session-id') 
        if not session_id:
            import uuid
            session_id = str(uuid.uuid4())
            logger.info(f"🆔 Created new session: {session_id[:8]}...")
        else:
            logger.info(f"🆔 Using session: {session_id[:8]}...")
        
        # Initialize session dataset storage if needed
        global SESSION_DATASETS
        if session_id not in SESSION_DATASETS:
            SESSION_DATASETS[session_id] = {}
        # Check content type
        content_type = request.headers.get("content-type", "")
        logger.info(f"Upload request content-type: {content_type}")
        
        if not content_type.startswith("multipart/form-data"):
            raise HTTPException(status_code=400, detail="Must be multipart/form-data")
        
        # Use FastAPI's internal form parsing
        from fastapi import Form
        from starlette.datastructures import FormData
        
        # Parse form data manually
        form = await request.form()
        logger.info(f"Form keys: {list(form.keys())}")
        
        # Get file from form
        file = form.get("file")
        domain = form.get("domain", "unknown")
        
        if not file or not hasattr(file, 'filename'):
            raise HTTPException(status_code=400, detail="No file uploaded")
        
        filename = file.filename
        if not filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        # Read file content
        content = await file.read()
        if isinstance(content, bytes):
            file_content = content.decode('utf-8', errors='ignore')
        else:
            file_content = str(content)
        
        logger.info(f"Uploaded file: {filename}, size: {len(file_content)}, domain: {domain}")
        
        # Validate file type
        valid_extensions = ['.csv', '.tsv', '.txt', '.json']
        if not any(filename.lower().endswith(ext) for ext in valid_extensions):
            raise HTTPException(status_code=400, detail=f"Invalid file type. Supported: {', '.join(valid_extensions)}")
        
        # STORE IN SESSION-ISOLATED MEMORY - NO FILE SYSTEM
        import time
        dataset_id = f"dataset_{session_id[:8]}_{int(time.time())}"
        
        # Store dataset content in session-isolated memory
        SESSION_DATASETS[session_id][dataset_id] = file_content
        
        logger.info(f"💾 Dataset stored in memory - Session: {session_id[:8]}..., Dataset: {dataset_id}")
        logger.info(f"📊 Dataset size: {len(file_content)} characters, {len(file_content.split('\\n'))} lines")
        
        # Basic content validation
        lines = file_content.split('\n')
        row_count = len([line for line in lines if line.strip()])
        
        # Frontend expects specific validation format
        validation_result = {
            "is_valid": True,
            "message": "File uploaded and validated successfully",
            "errors": [],  # Frontend expects this array - always present
            "statistics": {
                "total_rows": row_count,
                "columns": [],
                "sample_data": lines[:3] if lines else []
            }
        }
        
        if filename.lower().endswith('.csv'):
            if lines:
                # Try to get headers
                first_line = lines[0].strip()
                if first_line:
                    validation_result["statistics"]["columns"] = first_line.split(',')
        
        return {
            "success": True,
            "message": "File uploaded and stored in secure session memory",
            "data": {
                "file_path": dataset_id,  # MEMORY DATASET ID
                "session_id": session_id,  # SESSION FOR PRIVACY
                "original_filename": filename,
                "domain": domain,
                "size": len(file_content),
                "validation": validation_result
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/api/visualizations/available-files")
async def get_viz_files():
    """Placeholder visualization files endpoint."""
    return {"success": True, "data": {"files": [], "count": 0}}

@app.post("/api/visualizations/auto-detect-type")
async def auto_detect_viz():
    """Placeholder auto-detect endpoint."""
    return {"success": False, "error": "Auto-detection not implemented yet"}

@app.post("/api/visualizations/create")
async def create_viz():
    """Placeholder create visualizations endpoint."""
    return {"success": False, "error": "Visualization creation not implemented yet"}

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Multi-Agent Experiment System API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }

# Debug endpoint
@app.get("/api/debug/runner-status")
async def get_runner_status():
    """Get current experiment runner status for debugging."""
    try:
        global experiment_queue
        if not experiment_queue:
            return {"error": "No experiment queue initialized"}
        
        runner_info = {
            "queue_initialized": experiment_queue is not None,
            "queue_status": experiment_queue.status.value if experiment_queue else "none",
            "runner_type": type(experiment_queue.experiment_runner).__name__ if experiment_queue.experiment_runner else "none",
            "max_concurrent": experiment_queue.max_concurrent if experiment_queue else 0,
            "current_experiments": len(experiment_queue.experiments) if experiment_queue else 0,
            "running_experiments": len(experiment_queue.running_experiments) if experiment_queue else 0,
        }
        
        # Check if it's the production runner
        if hasattr(experiment_queue.experiment_runner, 'results_dir'):
            runner_info["is_production_runner"] = True
            runner_info["results_directory"] = str(experiment_queue.experiment_runner.results_dir)
        else:
            runner_info["is_production_runner"] = False
        
        return {"runner_info": runner_info}
        
    except Exception as e:
        logger.error(f"Error getting runner status: {e}")
        return {"error": str(e)}

# API Keys endpoint
@app.post("/api/keys")
async def save_api_keys(request: dict):
    """Save API keys (placeholder - just acknowledge receipt)."""
    try:
        # In a production system, you might validate and temporarily store these
        # For now, just acknowledge receipt since the frontend handles storage
        logger.info("API keys received and acknowledged")
        
        return {
            "success": True,
            "message": "API keys received successfully"
        }
    
    except Exception as e:
        logger.error(f"Error receiving API keys: {e}")
        return {
            "success": False,
            "error": str(e)
        }

# Configuration endpoints
@app.get("/api/config/domains")
async def get_domains():
    """Get available domains and their configurations."""
    if not config_manager:
        raise HTTPException(status_code=500, detail="Configuration manager not initialized")
    
    try:
        domains = config_manager.list_domains()
        domain_configs = {}
        
        for domain_name in domains:
            try:
                config = config_manager.get_domain_config(domain_name)
                # Remove sensitive information
                safe_config = {
                    "name": config.get("name"),
                    "enabled": config.get("enabled"),
                    "system_prompts": bool(config.get("system_prompts")),
                    "metrics": config.get("metrics", []),
                    "experiment_types": config.get("run_config", {}).get("experiment_types", [])
                }
                domain_configs[domain_name] = safe_config
            except Exception as e:
                logger.error(f"Error getting config for domain {domain_name}: {e}")
                domain_configs[domain_name] = {"enabled": False, "error": str(e)}
        
        return {"domains": domain_configs}
    
    except Exception as e:
        logger.error(f"Error getting domains: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config/toggles")
async def get_toggles():
    """Get frontend-ready toggle configuration."""
    if not config_manager:
        raise HTTPException(status_code=500, detail="Configuration manager not initialized")
    
    try:
        toggles = create_toggles()
        return toggles.get_toggles_for_frontend()
    
    except Exception as e:
        logger.error(f"Error getting toggles: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/config/domains/{domain_name}/toggle")
async def toggle_domain(domain_name: str, enabled: bool):
    """Toggle a domain on/off."""
    if not config_manager:
        raise HTTPException(status_code=500, detail="Configuration manager not initialized")
    
    try:
        if domain_name not in config_manager.list_domains():
            raise HTTPException(status_code=404, detail=f"Domain '{domain_name}' not found")
        
        if enabled:
            config_manager.enable_domain(domain_name)
        else:
            config_manager.disable_domain(domain_name)
        
        return {"domain": domain_name, "enabled": enabled}
    
    except Exception as e:
        logger.error(f"Error toggling domain {domain_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)}
    )

# Development server
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENVIRONMENT", "production") == "development"
    )