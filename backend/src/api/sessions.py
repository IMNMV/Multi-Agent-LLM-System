# api/sessions.py
"""
Session management API endpoints for user-provided API keys.
"""

from fastapi import APIRouter, HTTPException, Header, Depends
from fastapi.security import HTTPBearer
from typing import Optional, List
import logging

from ..models.session import SessionRequest, SessionInfo, APIKeySet
from ..utils.session_manager import get_session_manager
from ..unified_utils import test_api_key_validity, initialize_clients

router = APIRouter()
security = HTTPBearer()
logger = logging.getLogger(__name__)

@router.post("/create", response_model=SessionInfo)
async def create_session(session_request: SessionRequest):
    """Create a new session with user-provided API keys."""
    try:
        session_manager = get_session_manager()
        
        # Validate at least one API key is provided
        key_dict = session_request.api_keys.to_dict()
        valid_keys = {k: v for k, v in key_dict.items() if v and len(str(v).strip()) > 10}
        
        if not valid_keys:
            raise HTTPException(status_code=400, detail="At least one valid API key is required")
        
        # Test API key validity (optional - can be slow)
        # validated_providers = []
        # for provider, key in valid_keys.items():
        #     if key:
        #         is_valid, message = test_api_key_validity(provider, key)
        #         if is_valid:
        #             validated_providers.append(provider)
        #         else:
        #             logger.warning(f"Invalid {provider} API key: {message}")
        
        # Create session
        session_info = session_manager.create_session(
            api_keys=session_request.api_keys,
            session_name=session_request.session_name
        )
        
        logger.info(f"Created new session with {len(session_info.available_providers)} providers")
        
        return session_info
    
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/info", response_model=SessionInfo)
async def get_session_info(session_id: str):
    """Get session information."""
    try:
        session_manager = get_session_manager()
        session_info = session_manager.get_session_info(session_id)
        
        if not session_info:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        return session_info
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{session_id}/extend")
async def extend_session(session_id: str, minutes: int = 60):
    """Extend session expiry time."""
    try:
        if minutes < 1 or minutes > 240:  # Max 4 hours
            raise HTTPException(status_code=400, detail="Minutes must be between 1 and 240")
        
        session_manager = get_session_manager()
        success = session_manager.extend_session(session_id, minutes)
        
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"message": f"Session extended by {minutes} minutes"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extending session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and clear API keys from memory."""
    try:
        session_manager = get_session_manager()
        success = session_manager.delete_session(session_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"message": "Session deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/experiments")
async def get_session_experiments(session_id: str):
    """Get all experiments associated with this session."""
    try:
        session_manager = get_session_manager()
        
        # Verify session exists
        session_info = session_manager.get_session_info(session_id)
        if not session_info:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        
        experiment_ids = session_manager.get_session_experiments(session_id)
        
        return {
            "session_id": session_id,
            "experiment_count": len(experiment_ids),
            "experiment_ids": list(experiment_ids)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session experiments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[SessionInfo])
async def list_active_sessions():
    """List all active sessions (for admin/debugging)."""
    try:
        session_manager = get_session_manager()
        sessions = session_manager.list_active_sessions()
        
        # Remove sensitive info for public endpoint
        for session in sessions:
            session.session_id = session.session_id[:8] + "..." if len(session.session_id) > 8 else session.session_id
        
        return sessions
    
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test-keys")
async def test_api_keys(api_keys: APIKeySet):
    """Test API key validity without creating a session."""
    try:
        results = {}
        key_dict = api_keys.to_dict()
        
        for provider, key in key_dict.items():
            if key and len(str(key).strip()) > 10:
                try:
                    is_valid, message = test_api_key_validity(provider, key)
                    results[provider] = {
                        "valid": is_valid,
                        "message": message
                    }
                except Exception as e:
                    results[provider] = {
                        "valid": False,
                        "message": f"Test failed: {str(e)}"
                    }
            else:
                results[provider] = {
                    "valid": False,
                    "message": "No key provided or too short"
                }
        
        return {"test_results": results}
    
    except Exception as e:
        logger.error(f"Error testing API keys: {e}")
        raise HTTPException(status_code=500, detail=str(e))