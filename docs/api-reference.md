# API Reference

## Base URL
- **Production**: `https://your-app.railway.app/api`
- **Local Development**: `http://localhost:8000/api`

## Authentication
Currently, the API does not require authentication. In production, consider implementing API keys or OAuth.

## Health Endpoints

### GET /health
Basic health check for Railway monitoring.

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2025-01-15T10:30:00Z",
    "environment": "production",
    "version": "1.0.0"
}
```

### GET /health/detailed
Detailed system health information.

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2025-01-15T10:30:00Z",
    "environment": {
        "ENVIRONMENT": "production",
        "PORT": "8000",
        "MAX_CONCURRENT_EXPERIMENTS": "3",
        "env_vars": {
            "ANTHROPIC_API_KEY": true,
            "OPENAI_API_KEY": true,
            "TOGETHER_API_KEY": true
        }
    },
    "services": {
        "api": {
            "clients_initialized": true,
            "available_providers": ["claude", "openai", "together", "gemini"]
        },
        "queue": {
            "queue_running": true,
            "pending_experiments": 0,
            "running_experiments": 0
        }
    }
}
```

## Configuration Endpoints

### GET /config/domains
Get available domains and their configurations.

**Response:**
```json
{
    "domains": {
        "fake_news": {
            "name": "fake_news",
            "enabled": true,
            "metrics": ["confidence", "bias", "classification"],
            "experiment_types": ["dual", "consensus"]
        },
        "ai_text_detection": {
            "name": "ai_text_detection", 
            "enabled": true,
            "metrics": ["likelihood_of_ai", "confidence", "classification"],
            "experiment_types": ["dual", "consensus"]
        }
    }
}
```

### GET /config/toggles
Get frontend-ready toggle configuration.

**Response:**
```json
{
    "domains": [
        {
            "name": "fake_news",
            "enabled": true,
            "display_name": "Fake News"
        }
    ],
    "experiments": [
        {
            "name": "dual",
            "enabled": true,
            "display_name": "Dual"
        }
    ],
    "features": {
        "adversarial_mode": true,
        "visualization": true,
        "data_cleaning": true
    },
    "models": [
        {
            "name": "claude",
            "enabled": true,
            "display_name": "Claude"
        }
    ]
}
```

### POST /config/domains/{domain_name}/toggle
Toggle a domain on/off.

**Request Body:**
```json
{
    "enabled": true
}
```

## Experiment Endpoints

### POST /experiments/start
Start a new experiment.

**Request Body:**
```json
{
    "name": "Test Dual Experiment",
    "domain": "fake_news",
    "experiment_type": "dual",
    "models": ["claude", "openai"],
    "context_strategy": "first_turn_only",
    "adversarial": false,
    "temperature": 0.7,
    "num_articles": 10,
    "priority": 5
}
```

**Response:**
```json
{
    "experiment_id": "12345678-1234-5678-9abc-123456789abc",
    "status": "pending",
    "message": "Experiment 'Test Dual Experiment' queued successfully",
    "estimated_duration_minutes": 15
}
```

### POST /experiments/batch
Start a batch of experiments.

**Request Body:**
```json
{
    "name": "Model Comparison Batch",
    "description": "Compare different models on fake news detection",
    "experiments": [
        {
            "name": "Claude vs OpenAI",
            "domain": "fake_news",
            "experiment_type": "dual",
            "models": ["claude", "openai"]
        },
        {
            "name": "Three Model Consensus",
            "domain": "fake_news", 
            "experiment_type": "consensus",
            "models": ["claude", "openai", "together"]
        }
    ]
}
```

**Response:**
```json
{
    "batch_id": "batch-12345678-1234-5678-9abc-123456789abc",
    "name": "Model Comparison Batch",
    "total_experiments": 2,
    "status": "pending",
    "message": "Batch queued successfully with 2 experiments"
}
```

### GET /experiments/{experiment_id}/status
Get status of a specific experiment.

**Response:**
```json
{
    "id": "12345678-1234-5678-9abc-123456789abc",
    "name": "Test Dual Experiment",
    "status": "running",
    "progress": 45,
    "created_at": "2025-01-15T10:00:00Z",
    "started_at": "2025-01-15T10:05:00Z",
    "completed_at": null,
    "error_message": null,
    "result_files": [],
    "config": {
        "domain": "fake_news",
        "experiment_type": "dual",
        "models": ["claude", "openai"]
    }
}
```

### DELETE /experiments/{experiment_id}
Cancel a specific experiment.

**Response:**
```json
{
    "message": "Experiment 12345678-1234-5678-9abc-123456789abc cancelled successfully"
}
```

### GET /experiments/
List all experiments with their status.

**Response:**
```json
{
    "experiments": [
        {
            "id": "12345678-1234-5678-9abc-123456789abc",
            "name": "Test Dual Experiment",
            "status": "completed",
            "progress": 100,
            "created_at": "2025-01-15T10:00:00Z",
            "domain": "fake_news",
            "experiment_type": "dual"
        }
    ]
}
```

## Queue Management Endpoints

### GET /queue/status
Get current queue status.

**Response:**
```json
{
    "queue_status": "running",
    "statistics": {
        "total_experiments": 10,
        "pending": 3,
        "running": 2,
        "completed": 4,
        "failed": 1,
        "max_concurrent": 3,
        "total_batches": 2
    },
    "running_experiments": [
        {
            "id": "exp-1",
            "name": "Running Experiment 1",
            "status": "running",
            "progress": 60
        }
    ],
    "next_up": [
        {
            "id": "exp-2",
            "name": "Pending Experiment 1",
            "status": "pending",
            "priority": 1
        }
    ]
}
```

### POST /queue/start
Start the experiment queue processing.

### POST /queue/stop
Stop the experiment queue processing.

### POST /queue/pause
Pause the experiment queue processing.

### POST /queue/resume
Resume the experiment queue processing.

### GET /queue/batches
List all experiment batches.

**Response:**
```json
{
    "batches": [
        {
            "id": "batch-123",
            "name": "Test Batch",
            "status": "running",
            "progress": 0.6,
            "total_experiments": 5,
            "completed_experiments": 3,
            "failed_experiments": 0,
            "created_at": "2025-01-15T10:00:00Z"
        }
    ]
}
```

### GET /queue/batches/{batch_id}
Get status of a specific batch.

### DELETE /queue/batches/{batch_id}
Cancel all experiments in a batch.

### GET /queue/metrics
Get detailed queue metrics and performance data.

**Response:**
```json
{
    "queue_metrics": {
        "utilization_percentage": 66.67,
        "max_concurrent": 3,
        "current_running": 2,
        "total_processed": 15,
        "success_rate": 93.33
    },
    "experiment_stats": {
        "total": 20,
        "pending": 3,
        "running": 2,
        "completed": 14,
        "failed": 1
    },
    "batch_stats": {
        "total_batches": 5,
        "active_batches": 2,
        "completed_batches": 2,
        "failed_batches": 1
    },
    "queue_status": "running"
}
```

## Error Responses

All endpoints return standard HTTP status codes:

- **200**: Success
- **400**: Bad Request (invalid parameters)
- **404**: Not Found (resource doesn't exist)
- **500**: Internal Server Error

**Error Format:**
```json
{
    "detail": "Error message describing what went wrong"
}
```

## Rate Limits

Currently, no rate limits are imposed on API endpoints. Consider implementing rate limiting for production use.

## Download Endpoints

### GET /downloads/experiments/{experiment_id}/results?format={format}
Download experiment results in different formats.

**Parameters:**
- `experiment_id`: Experiment ID
- `format`: `csv` or `json`

**Response:**
Downloads the file directly as attachment.

### GET /downloads/experiments/{experiment_id}/files
Download all experiment files as ZIP archive.

**Response:**
Downloads a ZIP file containing all experiment results and metadata.

### GET /downloads/batches/{batch_id}/results
Download all results from a batch as ZIP archive.

**Response:**
Downloads a ZIP file containing all experiments from the batch.

### GET /downloads/experiments/{experiment_id}/preview?lines={lines}
Preview the first few lines of experiment results.

**Parameters:**
- `lines`: Number of lines to preview (default: 10)

**Response:**
```json
{
    "experiment_id": "12345",
    "file_path": "results.csv",
    "total_lines": 10,
    "preview": [
        "header,line,here",
        "data,line,1",
        "data,line,2"
    ]
}
```

### GET /downloads/experiments/{experiment_id}/stats
Get statistics about experiment results.

**Response:**
```json
{
    "experiment_id": "12345",
    "file_size_bytes": 1024000,
    "file_size_mb": 1.02,
    "total_lines": 1000,
    "data_rows": 999,
    "available_formats": ["csv", "json", "zip"]
}
```

## Data Models

### Experiment Types
- `single`: Single model analysis
- `dual`: Two model collaboration
- `consensus`: Three model collaboration

### Context Strategies
- `first_turn_only`: Show article only in first turn
- `all_turns`: Show article in all turns
- `first_and_last_turn`: Show article in first and last turns

### Experiment Status
- `pending`: Waiting to start
- `running`: Currently executing
- `completed`: Successfully finished
- `failed`: Error occurred
- `cancelled`: Manually cancelled