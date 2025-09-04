# main.py
"""
FastAPI application entry point for Railway deployment.
Multi-Agent Experiment System REST API.
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
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
from .api.uploads import router as uploads_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global variables
config_manager = None
experiment_queue = None

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
    
    # Initialize experiment queue
    try:
        # For now, we'll create a simple runner placeholder
        # This will be replaced with the actual UnifiedExperimentRunner
        class SimpleExperimentRunner:
            def run_experiment(self, config: Dict[str, Any], experiment_id: str) -> Dict[str, Any]:
                logger.info(f"Running experiment {experiment_id} with config: {config}")
                # Placeholder implementation
                return {"status": "completed", "output_files": []}
        
        runner = SimpleExperimentRunner()
        experiment_queue = initialize_queue(runner)
        logger.info("📋 Experiment queue initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize experiment queue: {e}")
    
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
        "https://yourusername.github.io"  # Replace with your GitHub Pages URL
    ]

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
app.include_router(uploads_router, prefix="/api", tags=["uploads"])

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