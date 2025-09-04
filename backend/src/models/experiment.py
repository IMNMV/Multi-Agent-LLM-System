# models/experiment.py
"""
Pydantic models for experiment API requests and responses.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime
from enum import Enum

class ExperimentType(str, Enum):
    SINGLE = "single"
    DUAL = "dual"
    CONSENSUS = "consensus"

class ContextStrategy(str, Enum):
    FIRST_TURN_ONLY = "first_turn_only"
    ALL_TURNS = "all_turns"
    FIRST_AND_LAST_TURN = "first_and_last_turn"

class ExperimentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ExperimentRequest(BaseModel):
    """Request model for creating experiments."""
    name: str = Field(..., description="Human-readable name for the experiment")
    domain: str = Field(..., description="Domain to run experiment in (e.g., 'fake_news', 'ai_text_detection')")
    experiment_type: ExperimentType = Field(..., description="Type of experiment to run")
    models: List[str] = Field(..., description="List of model names to use", min_items=1)
    context_strategy: ContextStrategy = Field(default=ContextStrategy.FIRST_TURN_ONLY, description="Context injection strategy")
    adversarial: bool = Field(default=False, description="Whether to enable adversarial mode")
    temperature: float = Field(default=0.7, description="Temperature for model responses", ge=0.0, le=2.0)
    num_articles: Optional[int] = Field(default=None, description="Number of articles to process (None for all)")
    priority: int = Field(default=5, description="Experiment priority (1=highest, 10=lowest)", ge=1, le=10)
    batch_id: Optional[str] = Field(default=None, description="Optional batch ID to group experiments")
    session_id: Optional[str] = Field(default=None, description="Session ID for user-provided API keys")
    dataset_path: Optional[str] = Field(default=None, description="Path to uploaded dataset file")

class ExperimentResponse(BaseModel):
    """Response model for experiment creation."""
    experiment_id: str
    status: ExperimentStatus
    message: str
    estimated_duration_minutes: Optional[int] = None

class ExperimentStatus(BaseModel):
    """Model for experiment status information."""
    id: str
    name: str
    status: ExperimentStatus
    progress: int = Field(..., description="Progress percentage (0-100)")
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result_files: List[str] = []
    config: Dict[str, Any] = {}

class BatchRequest(BaseModel):
    """Request model for creating experiment batches."""
    name: str = Field(..., description="Human-readable name for the batch")
    description: str = Field(..., description="Description of the batch purpose")
    experiments: List[ExperimentRequest] = Field(..., description="List of experiments in the batch", min_items=1)
    template_name: Optional[str] = Field(default=None, description="Template name for the batch")

class BatchResponse(BaseModel):
    """Response model for batch creation."""
    batch_id: str
    name: str
    total_experiments: int
    status: str
    message: str

class BatchStatus(BaseModel):
    """Model for batch status information."""
    id: str
    name: str
    description: str
    status: str
    progress: float = Field(..., description="Overall batch progress (0.0-1.0)")
    total_experiments: int
    completed_experiments: int
    failed_experiments: int
    created_at: datetime
    experiments: List[ExperimentStatus] = []