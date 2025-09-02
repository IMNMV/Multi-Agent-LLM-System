# Multi-Agent Experiment System

A sophisticated multi-agent AI experiment framework for collaborative and adversarial model evaluation across various domains.

## Architecture

- **Frontend**: Static web interface hosted on GitHub Pages with Three.js visualizations
- **Backend**: Python-based experiment runner deployed on Railway with REST API

## Features

- Single, Dual, and Consensus experiment types
- Equal knowledge sharing principle
- Multiple AI provider support (Claude, OpenAI, Gemini, Together, etc.)
- Batch experiment queue system
- Real-time monitoring and visualization
- Adversarial mode capabilities

## Quick Start

### Frontend (GitHub Pages)
```bash
# Serve locally for development
cd frontend
python -m http.server 8000
```

### Backend (Railway)
```bash
cd backend
pip install -r requirements.txt
python src/main.py
```

## Documentation

- [API Reference](docs/api-reference.md)
- [Deployment Guide](docs/deployment.md)
- [Development Setup](docs/development.md)

## License

MIT License