# Development Guide

## Project Structure

```
multi-agent-experiment-system/
├── backend/                     # Railway backend
│   ├── src/
│   │   ├── main.py             # FastAPI entry point
│   │   ├── unified_config.py   # Configuration management
│   │   ├── unified_utils.py    # Utilities and API clients
│   │   ├── experiment_queue.py # Queue system
│   │   ├── api/                # API endpoints
│   │   │   ├── experiments.py  # Experiment management
│   │   │   ├── queue.py        # Queue management
│   │   │   └── health.py       # Health checks
│   │   ├── models/             # Pydantic models
│   │   └── utils/              # Additional utilities
│   ├── tests/                  # Test files
│   ├── data/                   # Sample data
│   ├── requirements.txt        # Python dependencies
│   ├── Procfile               # Railway startup
│   └── railway.toml           # Railway config
│
├── frontend/                   # GitHub Pages frontend
│   ├── index.html             # Main HTML
│   ├── css/styles.css         # Styling
│   └── js/app.js              # Three.js application
│
└── docs/                      # Documentation
    ├── deployment.md          # Deployment guide
    ├── api-reference.md       # API documentation
    └── development.md         # This file
```

## Local Development Setup

### Backend Setup

1. **Clone Repository**
   ```bash
   git clone <your-repo-url>
   cd multi-agent-experiment-system/backend
   ```

2. **Create Virtual Environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

5. **Run Development Server**
   ```bash
   python src/main.py
   ```

   Or with auto-reload:
   ```bash
   uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup

1. **Navigate to Frontend**
   ```bash
   cd frontend
   ```

2. **Update API URL**
   Edit `js/app.js` to point to local backend:
   ```javascript
   this.apiBaseUrl = 'http://localhost:8000/api';
   ```

3. **Serve Locally**
   ```bash
   python -m http.server 8000
   ```

4. **Open in Browser**
   Visit `http://localhost:8000`

## Key Components

### Configuration System (`unified_config.py`)

The configuration system is modular and supports multiple domains:

- **Domain Modules**: Each research domain (fake news, AI text detection) is a separate module
- **API Configurations**: Centralized AI provider settings
- **Environment Variables**: Railway-compatible environment variable support

### API Client Management (`unified_utils.py`)

Handles all AI provider interactions:

- **Unified Interface**: Single function `make_api_call()` for all providers
- **Rate Limiting**: Automatic rate limiting per provider
- **Thread Safety**: Safe for concurrent use
- **Error Handling**: Robust error handling and retries

### Experiment Queue (`experiment_queue.py`)

Manages batch experiment execution:

- **Priority Scheduling**: Priority-based experiment ordering
- **Concurrent Execution**: Multiple experiments run simultaneously
- **Persistence**: Results stored for Railway deployment
- **Progress Tracking**: Real-time progress updates

### FastAPI Application (`main.py`)

Main web application:

- **RESTful API**: Standard REST endpoints
- **CORS Support**: Configured for GitHub Pages
- **Health Checks**: Railway-compatible health monitoring
- **Error Handling**: Comprehensive error responses

## Adding New Features

### Adding a New Domain

1. **Create Domain Module**
   ```python
   class NewDomainModule(DomainModule):
       def __init__(self, enabled: bool = True):
           super().__init__("new_domain", enabled)
       
       def get_system_prompts(self) -> Dict[str, str]:
           return {
               "single": "Your system prompt...",
               "dual_base": "Your dual prompt..."
           }
       
       def get_parsing_function(self) -> str:
           return "parse_new_domain_response"
       
       def get_metrics(self) -> List[str]:
           return ["metric1", "metric2"]
   ```

2. **Register Domain**
   ```python
   # In ConfigurationManager._register_default_domains()
   self.register_domain(NewDomainModule())
   ```

3. **Add Parsing Function**
   ```python
   # In unified_utils.py
   def parse_new_domain_response(response_text: str) -> Dict[str, Any]:
       # Implementation
       pass
   ```

### Adding a New AI Provider

1. **Install Client Library**
   ```bash
   pip install new-provider-sdk
   ```

2. **Add to API Configs**
   ```python
   # In unified_config.py
   API_CONFIGS["new_provider"] = {
       "model": "new-provider-model",
       "provider_name": "NewProvider",
       "display_name": "New Provider",
       "rpm_limit": 60
   }
   ```

3. **Add Client Initialization**
   ```python
   # In unified_utils.py initialize_clients()
   if "new_provider" in api_keys:
       _clients["new_provider"] = NewProviderClient(api_key=api_keys["new_provider"])
   ```

4. **Add API Call Handler**
   ```python
   # In make_api_call()
   elif provider == "new_provider":
       response = client.generate(
           model=model,
           messages=messages,
           temperature=temperature
       )
       return response.text
   ```

### Adding New API Endpoints

1. **Create Router**
   ```python
   # In api/new_feature.py
   from fastapi import APIRouter
   
   router = APIRouter()
   
   @router.get("/endpoint")
   async def new_endpoint():
       return {"message": "Hello World"}
   ```

2. **Include Router**
   ```python
   # In main.py
   from .api.new_feature import router as new_feature_router
   app.include_router(new_feature_router, prefix="/api/new", tags=["new"])
   ```

## Testing

### Unit Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_api.py

# Run with coverage
pytest --cov=src tests/
```

### API Testing

Use the built-in FastAPI documentation:
- Visit `http://localhost:8000/docs` (Swagger UI)
- Visit `http://localhost:8000/redoc` (ReDoc)

### Manual Testing

```bash
# Test health endpoint
curl http://localhost:8000/api/health

# Test experiment creation
curl -X POST http://localhost:8000/api/experiments/start \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "domain": "fake_news", "experiment_type": "single", "models": ["claude"]}'
```

## Code Style and Standards

### Python Style Guide

- Follow PEP 8
- Use type hints
- Document functions with docstrings
- Keep functions focused and small

### API Design Principles

- RESTful URLs
- Consistent response format
- Proper HTTP status codes
- Clear error messages

### Configuration Management

- Use environment variables for sensitive data
- Provide sensible defaults
- Document all configuration options
- Make configuration testable

## Debugging

### Logging

```python
import logging
logger = logging.getLogger(__name__)

# Different log levels
logger.debug("Debug information")
logger.info("General information")
logger.warning("Warning message")
logger.error("Error occurred")
```

### Environment Variables

```bash
# Enable debug mode
export DEBUG=true
export LOG_LEVEL=DEBUG

# Test with verbose logging
python src/main.py
```

### Common Issues

1. **Import Errors**
   - Check Python path
   - Verify virtual environment is activated
   - Ensure all dependencies installed

2. **API Key Issues**
   - Verify environment variables are set
   - Check API key validity
   - Test with health endpoints

3. **CORS Issues**
   - Check `ALLOWED_ORIGINS` setting
   - Verify frontend URL is included
   - Test with browser dev tools

## Performance Considerations

### API Rate Limiting

- Monitor rate limits for each provider
- Implement backoff strategies
- Cache responses where appropriate

### Memory Usage

- Monitor experiment queue size
- Clean up completed experiments
- Use streaming for large datasets

### Database Considerations

For production use, consider adding:
- PostgreSQL for persistent storage
- Redis for caching
- Database migrations

## Security Best Practices

1. **API Keys**
   - Never commit keys to version control
   - Use environment variables
   - Rotate keys regularly

2. **CORS**
   - Limit allowed origins
   - Don't use wildcards in production
   - Validate origin headers

3. **Input Validation**
   - Use Pydantic models
   - Validate all user input
   - Sanitize file paths

4. **Error Handling**
   - Don't expose internal details
   - Log security events
   - Rate limit API endpoints

## Deployment Checklist

Before deploying:

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] API keys valid
- [ ] CORS origins updated
- [ ] Health endpoints working
- [ ] Documentation updated
- [ ] Security review completed