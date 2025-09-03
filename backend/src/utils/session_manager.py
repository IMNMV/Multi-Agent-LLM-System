# utils/session_manager.py
"""
Secure session manager for user-provided API keys.
"""

import uuid
import time
import threading
from datetime import datetime, timedelta
from typing import Dict, Optional, Set
import logging

from ..models.session import APIKeySet, SessionInfo

logger = logging.getLogger(__name__)

class SessionManager:
    """Manages user sessions with API keys."""
    
    def __init__(self, session_timeout_minutes: int = 60):
        self.session_timeout_minutes = session_timeout_minutes
        self.sessions: Dict[str, Dict] = {}
        self.session_experiments: Dict[str, Set[str]] = {}  # session_id -> set of experiment_ids
        self._lock = threading.Lock()
        
        # Start cleanup thread
        self._cleanup_thread = threading.Thread(target=self._cleanup_expired_sessions, daemon=True)
        self._cleanup_thread.start()
    
    def create_session(self, api_keys: APIKeySet, session_name: Optional[str] = None) -> SessionInfo:
        """Create a new user session with API keys."""
        session_id = str(uuid.uuid4())
        
        with self._lock:
            expires_at = datetime.now() + timedelta(minutes=self.session_timeout_minutes)
            
            # Test which providers are available
            available_providers = []
            key_dict = api_keys.to_dict()
            
            for provider, key in key_dict.items():
                if key and len(key.strip()) > 10:  # Basic validation
                    available_providers.append(provider)
            
            session_data = {
                'api_keys': key_dict,
                'session_name': session_name,
                'created_at': datetime.now(),
                'expires_at': expires_at,
                'last_accessed': datetime.now(),
                'available_providers': available_providers,
                'experiment_count': 0
            }
            
            self.sessions[session_id] = session_data
            self.session_experiments[session_id] = set()
            
            logger.info(f"Created session {session_id[:8]}... with {len(available_providers)} providers")
        
        return SessionInfo(
            session_id=session_id,
            session_name=session_name,
            created_at=session_data['created_at'],
            expires_at=expires_at,
            available_providers=available_providers
        )
    
    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get session data if valid."""
        with self._lock:
            if session_id not in self.sessions:
                return None
            
            session = self.sessions[session_id]
            
            # Check if expired
            if datetime.now() > session['expires_at']:
                self._delete_session_unsafe(session_id)
                return None
            
            # Update last accessed time
            session['last_accessed'] = datetime.now()
            return session
    
    def get_api_keys(self, session_id: str) -> Optional[Dict[str, str]]:
        """Get API keys for a session."""
        session = self.get_session(session_id)
        if session:
            return session['api_keys']
        return None
    
    def add_experiment_to_session(self, session_id: str, experiment_id: str) -> bool:
        """Associate an experiment with a session."""
        with self._lock:
            if session_id in self.session_experiments:
                self.session_experiments[session_id].add(experiment_id)
                if session_id in self.sessions:
                    self.sessions[session_id]['experiment_count'] = len(self.session_experiments[session_id])
                return True
            return False
    
    def get_session_experiments(self, session_id: str) -> Set[str]:
        """Get all experiment IDs for a session."""
        with self._lock:
            return self.session_experiments.get(session_id, set()).copy()
    
    def delete_session(self, session_id: str) -> bool:
        """Manually delete a session."""
        with self._lock:
            return self._delete_session_unsafe(session_id)
    
    def _delete_session_unsafe(self, session_id: str) -> bool:
        """Delete session without lock (internal use)."""
        if session_id in self.sessions:
            # Clear API keys from memory for security
            if 'api_keys' in self.sessions[session_id]:
                self.sessions[session_id]['api_keys'].clear()
            
            del self.sessions[session_id]
            
            if session_id in self.session_experiments:
                del self.session_experiments[session_id]
            
            logger.info(f"Deleted session {session_id[:8]}...")
            return True
        return False
    
    def extend_session(self, session_id: str, minutes: int = None) -> bool:
        """Extend session expiry time."""
        if minutes is None:
            minutes = self.session_timeout_minutes
        
        with self._lock:
            if session_id in self.sessions:
                self.sessions[session_id]['expires_at'] = datetime.now() + timedelta(minutes=minutes)
                return True
            return False
    
    def get_session_info(self, session_id: str) -> Optional[SessionInfo]:
        """Get session information without API keys."""
        session = self.get_session(session_id)
        if not session:
            return None
        
        with self._lock:
            experiment_count = len(self.session_experiments.get(session_id, set()))
        
        return SessionInfo(
            session_id=session_id,
            session_name=session.get('session_name'),
            created_at=session['created_at'],
            expires_at=session['expires_at'],
            available_providers=session['available_providers'],
            active_experiments=experiment_count
        )
    
    def list_active_sessions(self) -> list[SessionInfo]:
        """List all active sessions (admin function)."""
        active_sessions = []
        
        with self._lock:
            for session_id, session in self.sessions.items():
                if datetime.now() <= session['expires_at']:
                    experiment_count = len(self.session_experiments.get(session_id, set()))
                    
                    active_sessions.append(SessionInfo(
                        session_id=session_id,
                        session_name=session.get('session_name', f"Session {session_id[:8]}..."),
                        created_at=session['created_at'],
                        expires_at=session['expires_at'],
                        available_providers=session['available_providers'],
                        active_experiments=experiment_count
                    ))
        
        return active_sessions
    
    def _cleanup_expired_sessions(self):
        """Background thread to clean up expired sessions."""
        while True:
            try:
                current_time = datetime.now()
                expired_sessions = []
                
                with self._lock:
                    for session_id, session in list(self.sessions.items()):
                        if current_time > session['expires_at']:
                            expired_sessions.append(session_id)
                
                # Delete expired sessions
                for session_id in expired_sessions:
                    with self._lock:
                        self._delete_session_unsafe(session_id)
                
                if expired_sessions:
                    logger.info(f"Cleaned up {len(expired_sessions)} expired sessions")
                
                # Sleep for 5 minutes before next cleanup
                time.sleep(300)
                
            except Exception as e:
                logger.error(f"Error in session cleanup: {e}")
                time.sleep(60)  # Wait 1 minute on error

# Global session manager instance
_session_manager = None

def get_session_manager() -> SessionManager:
    """Get the global session manager instance."""
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager