# Deployment Guide

## Railway Deployment

### Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Push your code to GitHub
3. **API Keys**: Obtain API keys for AI providers

### Environment Variables

Set these environment variables in your Railway project:

#### Required API Keys
```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
GOOGLE_API_KEY=your_google_api_key
TOGETHER_API_KEY=your_together_api_key
```

#### Optional Configuration
```bash
# Environment
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO

# CORS (replace with your GitHub Pages URL)
ALLOWED_ORIGINS=https://yourusername.github.io,http://localhost:3000

# Experiment Settings
MAX_CONCURRENT_EXPERIMENTS=3
DEFAULT_TEMPERATURE=0.7

# Storage
RESULTS_STORAGE_PATH=/app/results
```

### Deployment Steps

1. **Connect Repository**
   - Log into Railway dashboard
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Configure Environment Variables**
   - Go to Variables tab in Railway dashboard
   - Add all required environment variables
   - Save changes

3. **Deploy**
   - Railway will automatically detect Python and use the `requirements.txt`
   - The `Procfile` defines the startup command
   - Monitor deployment logs for any issues

4. **Custom Domain (Optional)**
   - Go to Settings tab
   - Add custom domain or use Railway's generated domain

### Railway Configuration Files

#### `railway.toml`
```toml
[build]
builder = "NIXPACKS"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

#### `Procfile`
```
web: uvicorn src.main:app --host 0.0.0.0 --port $PORT
```

### Monitoring

- Health check endpoint: `https://your-app.railway.app/api/health`
- Detailed health: `https://your-app.railway.app/api/health/detailed`
- API documentation: `https://your-app.railway.app/docs`

### Troubleshooting

1. **Deployment Fails**
   - Check Railway build logs
   - Verify all dependencies in `requirements.txt`
   - Ensure Python version compatibility

2. **API Keys Invalid**
   - Check environment variables are set correctly
   - Verify API keys haven't expired
   - Test individual keys using the health endpoint

3. **CORS Issues**
   - Update `ALLOWED_ORIGINS` environment variable
   - Include your GitHub Pages domain
   - Check browser console for CORS errors

## GitHub Pages Frontend Deployment

### Steps

1. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Select source: Deploy from a branch
   - Choose `main` branch, `/frontend` folder

2. **Update API URL**
   - Edit `frontend/js/app.js`
   - Replace `apiBaseUrl` with your Railway URL
   ```javascript
   this.apiBaseUrl = 'https://your-app.railway.app/api';
   ```

3. **Test Connection**
   - Open your GitHub Pages URL
   - Check browser console for API connection status
   - Verify CORS is working

### Domain Setup

If using a custom domain:

1. **Add CNAME File**
   ```bash
   echo "your-domain.com" > frontend/CNAME
   ```

2. **Update CORS Settings**
   - Add your custom domain to Railway's `ALLOWED_ORIGINS`

## Local Development

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
python src/main.py
```

### Frontend Setup
```bash
cd frontend
python -m http.server 8000
# Open http://localhost:8000
```

## Production Considerations

1. **Security**
   - Never commit API keys to Git
   - Use Railway's environment variables
   - Enable HTTPS (automatic on Railway)

2. **Scaling**
   - Monitor Railway resource usage
   - Adjust `MAX_CONCURRENT_EXPERIMENTS` based on performance
   - Consider database for persistent storage

3. **Monitoring**
   - Set up Railway notifications
   - Monitor health endpoints
   - Check experiment logs regularly

4. **Backup**
   - Regularly backup experiment results
   - Consider external storage for large datasets
   - Export queue state if needed