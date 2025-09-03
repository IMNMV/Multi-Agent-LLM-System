# models/session.py
"""
Session management models for user-provided API keys.
"""

from pydantic import BaseModel, Field, validator
from typing import Dict, Optional
from datetime import datetime, timedelta
import re

class APIKeySet(BaseModel):
    """User-provided API keys with validation."""
    anthropic_api_key: Optional[str] = Field(None, min_length=1, max_length=200)
    openai_api_key: Optional[str] = Field(None, min_length=1, max_length=200)
    google_api_key: Optional[str] = Field(None, min_length=1, max_length=200)
    together_api_key: Optional[str] = Field(None, min_length=1, max_length=200)
    
    @validator('anthropic_api_key', 'openai_api_key', 'google_api_key', 'together_api_key', pre=True)
    def sanitize_api_key(cls, value):
        """Sanitize API keys to prevent XSS and injection attacks."""
        if not value:
            return None
        
        # Convert to string and strip whitespace
        key = str(value).strip()
        
        # Remove any HTML tags
        key = re.sub(r'<[^>]*>', '', key)
        
        # Remove script tags and javascript
        key = re.sub(r'(?i)<script[^>]*>.*?</script>', '', key)
        key = re.sub(r'(?i)javascript:', '', key)
        key = re.sub(r'(?i)on\w+\s*=', '', key)
        
        # Remove SQL injection patterns
        key = re.sub(r'(?i)(union|select|insert|update|delete|drop|create|alter|exec|execute)', '', key)
        
        # Only allow alphanumeric, hyphens, underscores, and dots
        key = re.sub(r'[^a-zA-Z0-9\-_\.]', '', key)
        
        # Limit length
        if len(key) > 200:
            key = key[:200]
        
        return key if key else None
    
    def to_dict(self) -> Dict[str, Optional[str]]:
        """Convert to dictionary for API client initialization."""
        return {
            "claude": self.anthropic_api_key,
            "openai": self.openai_api_key,
            "gemini": self.google_api_key,
            "together": self.together_api_key,
            "deepseek": self.together_api_key  # DeepSeek uses Together API
        }

class SessionRequest(BaseModel):
    """Request to create a new user session."""
    api_keys: APIKeySet
    session_name: Optional[str] = Field(None, max_length=100)
    
    @validator('session_name', pre=True)
    def sanitize_session_name(cls, value):
        """Sanitize session name."""
        if not value:
            return None
        
        # Basic HTML/XSS sanitization
        name = str(value).strip()
        name = re.sub(r'<[^>]*>', '', name)
        name = re.sub(r'[<>&"\']', '', name)
        
        return name[:100] if name else None

class SessionInfo(BaseModel):
    """Session information returned to user."""
    session_id: str
    session_name: Optional[str]
    created_at: datetime
    expires_at: datetime
    available_providers: list[str]
    active_experiments: int = 0