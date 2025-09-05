# unified_utils.py
"""
Unified utilities for multi-agent experiments across domains.
Adapted for Railway deployment with environment variable support.
"""

import os
import csv
import re
import time
import pandas as pd
import httpx
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional, Callable
from pathlib import Path
import json
import logging
import threading

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to import AI libraries with fallbacks
try:
    import anthropic
except ImportError:
    anthropic = None
    logger.warning("Anthropic library not available")

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None
    logger.warning("OpenAI library not available")

try:
    import google.generativeai as genai
except ImportError:
    genai = None
    logger.warning("Google Generative AI library not available")

try:
    import together
except ImportError:
    together = None
    logger.warning("Together library not available")

# Handle pandas import for CSV processing
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    logger.warning("Pandas not available - CSV processing will be limited")

# Global state for API clients and rate limiting
_clients = {}
_api_call_timestamps = {}
_api_keys = {}
_client_lock = threading.Lock()

# ==============================================================================
# API CLIENT MANAGEMENT
# ==============================================================================

def initialize_clients(api_keys: Dict[str, str]):
    """Initialize API clients for all providers."""
    global _clients, _api_keys, _client_lock
    
    with _client_lock:
        _api_keys = api_keys
        logger.info("Initializing API clients...")
        
        # Claude
        if anthropic and "claude" in api_keys and api_keys["claude"]:
            try:
                _clients["claude"] = anthropic.Anthropic(api_key=api_keys["claude"])
                logger.info("✓ Claude client initialized")
            except Exception as e:
                logger.error(f"✗ Claude client failed: {e}")
        
        # OpenAI
        if OpenAI and "openai" in api_keys and api_keys["openai"]:
            try:
                _clients["openai"] = OpenAI(api_key=api_keys["openai"])
                logger.info("✓ OpenAI client initialized")
            except Exception as e:
                logger.error(f"✗ OpenAI client failed: {e}")
        
        # Together (Exaone)
        if together and "together" in api_keys and api_keys["together"]:
            try:
                _clients["together"] = together.Together(api_key=api_keys["together"])
                logger.info("✓ Together (Exaone) client initialized")
            except Exception as e:
                logger.error(f"✗ Together (Exaone) client failed: {e}")
        
        # DeepSeek (also uses Together API)
        if together and "deepseek" in api_keys and api_keys["deepseek"]:
            try:
                _clients["deepseek"] = together.Together(api_key=api_keys["deepseek"])
                logger.info("✓ DeepSeek (via Together) client initialized")
            except Exception as e:
                logger.error(f"✗ DeepSeek client failed: {e}")
        
        # GPT-OSS (Ollama) - disabled for Railway deployment
        # if OpenAI and "gpt-oss" in api_keys and api_keys["gpt-oss"]:
        #     try:
        #         _clients["gpt-oss"] = OpenAI(
        #             base_url="http://localhost:11434/v1",
        #             api_key=api_keys["gpt-oss"]
        #         )
        #         logger.info("✓ GPT-OSS (Ollama) client initialized")
        #     except Exception as e:
        #         logger.error(f"✗ GPT-OSS client failed: {e}")
        
        # Gemini
        if genai and "gemini" in api_keys and api_keys["gemini"]:
            try:
                genai.configure(api_key=api_keys["gemini"])
                _clients["gemini"] = genai.GenerativeModel("gemini-2.5-flash")
                logger.info("✓ Gemini client initialized")
            except Exception as e:
                logger.error(f"✗ Gemini client failed: {e}")
        
        logger.info(f"Initialized {len(_clients)} API clients")

def get_api_clients(api_keys: Dict[str, str]) -> Dict[str, Any]:
    """Get initialized API clients for the given API keys."""
    global _clients
    
    # Clear existing clients and reinitialize with new keys
    _clients.clear()
    initialize_clients(api_keys)
    
    return _clients.copy()

def test_api_key_validity(provider: str, api_key: str) -> tuple[bool, str]:
    """Test the validity of an API key by making a simple API call."""
    logger.info(f"Testing {provider} API key validity...")
    
    try:
        if provider == "claude" and anthropic:
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}]
            )
            return True, "Valid"
        
        elif provider == "openai" and OpenAI:
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=10
            )
            return True, "Valid"
        
        elif provider == "gemini" and genai:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-pro")
            response = model.generate_content("Hi")
            return True, "Valid"
        
        elif provider in ["together", "deepseek"] and together:
            client = together.Together(api_key=api_key)
            # Use YOUR specified models
            if provider == "together":
                test_model = "lgai/exaone-3-5-32b-instruct"
            else:  # deepseek
                test_model = "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free"
            
            response = client.chat.completions.create(
                model=test_model,
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=10
            )
            return True, "Valid"
        
        else:
            return False, f"Provider {provider} not supported or library not available"
    
    except Exception as e:
        return False, str(e)

# ==============================================================================
# RATE LIMITING
# ==============================================================================

def _apply_rate_limit(provider: str, rpm_limit: int):
    """Apply rate limiting for API calls."""
    global _api_call_timestamps
    
    current_time = time.time()
    
    if provider not in _api_call_timestamps:
        _api_call_timestamps[provider] = []
    
    timestamps = _api_call_timestamps[provider]
    
    # Remove timestamps older than 1 minute
    timestamps[:] = [ts for ts in timestamps if current_time - ts < 60]
    
    # Check if we need to wait
    if len(timestamps) >= rpm_limit:
        oldest_call_time = timestamps[0]
        wait_time = (oldest_call_time + 60.0) - current_time
        if wait_time > 0:
            logger.info(f"Rate limiting {provider}: waiting {wait_time:.1f}s")
            time.sleep(wait_time)
    
    # Record this call
    timestamps.append(current_time)

# ==============================================================================
# UNIFIED API CALLING
# ==============================================================================

def make_api_call(provider: str, model: str, messages: List[Dict[str, str]], 
                 temperature: float = 0.7, max_tokens: int = 2000, rpm_limit: int = 20) -> str:
    """Make a unified API call across different providers."""
    global _clients, _client_lock
    
    with _client_lock:
        if provider not in _clients:
            raise ValueError(f"Provider '{provider}' not initialized")
        
        client = _clients[provider]
    
    # Apply rate limiting
    _apply_rate_limit(provider, rpm_limit)
    
    try:
        if provider == "claude":
            # Convert messages format for Claude
            claude_messages = []
            for msg in messages:
                claude_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
            
            response = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=claude_messages
            )
            return response.content[0].text
        
        elif provider == "openai":
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        
        elif provider in ["together", "deepseek"]:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        
        elif provider == "gemini":
            # Convert messages to Gemini format
            if len(messages) == 1 and messages[0]["role"] == "user":
                prompt = messages[0]["content"]
            else:
                # For multi-turn conversations, we need to format differently
                prompt = "\n".join([f"{msg['role']}: {msg['content']}" for msg in messages])
            
            response = client.generate_content(prompt)
            return response.text
        
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    
    except Exception as e:
        logger.error(f"API call failed for {provider}: {e}")
        raise

# ==============================================================================
# DATA PROCESSING AND PARSING
# ==============================================================================

def extract_metric_from_text(text: str, metric_name: str) -> Any:
    """Extract a specific metric from text using regex patterns."""
    text = text.strip()
    
    # Define patterns for different metrics
    patterns = {
        "classification": [
            rf"{metric_name}:\s*([01])\b",
            rf"{metric_name}:\s*(\d+)\b",
            rf"Classification:\s*([01])\b",
            rf"Final Classification:\s*([01])\b"
        ],
        "confidence": [
            rf"{metric_name}:\s*(\d+(?:\.\d+)?)",
            rf"Confidence:\s*(\d+(?:\.\d+)?)"
        ],
        "likelihood_of_ai": [
            rf"Likelihood of AI Generation:\s*(\d+(?:\.\d+)?)",
            rf"AI Likelihood:\s*(\d+(?:\.\d+)?)",
            rf"Likelihood of AI:\s*(\d+(?:\.\d+)?)"
        ],
        "agreement_score": [
            rf"Agreement Score:\s*(\d+(?:\.\d+)?)",
            rf"Agreement:\s*(\d+(?:\.\d+)?)"
        ]
    }
    
    # Use metric-specific patterns if available, otherwise use generic
    metric_patterns = patterns.get(metric_name.lower(), [
        rf"{metric_name}:\s*(\d+(?:\.\d+)?)",
        rf"{metric_name}:\s*([01])\b"
    ])
    
    for pattern in metric_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
        if matches:
            try:
                value = matches[0]
                # Try to convert to appropriate type
                if metric_name.lower() == "classification":
                    return int(value)
                elif value.replace(".", "").isdigit():
                    return float(value) if "." in value else int(value)
                return value
            except (ValueError, IndexError):
                continue
    
    return None

def parse_fake_news_response(response_text: str) -> Dict[str, Any]:
    """Parse fake news detection response."""
    parsed = {}
    
    # Extract all metrics
    metrics = [
        "bias", "manipulative_framing", "reason", "confidence", 
        "classification", "reliability", "agreement_score"
    ]
    
    for metric in metrics:
        value = extract_metric_from_text(response_text, metric)
        parsed[metric] = value
    
    # Store raw response
    parsed["raw_response"] = response_text.strip()
    
    return parsed

def parse_ai_detection_response(response_text: str) -> Dict[str, Any]:
    """Parse AI text detection response."""
    parsed = {}
    
    # Extract all metrics
    metrics = [
        "likelihood_of_ai", "reason", "confidence", "classification", "agreement_score"
    ]
    
    for metric in metrics:
        value = extract_metric_from_text(response_text, metric)
        parsed[metric] = value
    
    # Store raw response
    parsed["raw_response"] = response_text.strip()
    
    return parsed

# ==============================================================================
# DATA CLEANING AND VALIDATION
# ==============================================================================

def clean_and_validate_classification(parsed_dict: Dict[str, Any], raw_response: str) -> Dict[str, Any]:
    """Clean and validate classification data based on R statistical methods."""
    # Clean classification (most critical)
    classification = parsed_dict.get('classification')
    if classification is None or (isinstance(classification, (int, float)) and classification not in [0, 1]):
        # Try to extract from raw_response
        extracted_class = extract_metric_from_text(raw_response, "Classification")
        if extracted_class is not None and extracted_class in [0, 1]:
            parsed_dict['classification'] = extracted_class
        else:
            # Set to None if we can't extract valid classification
            parsed_dict['classification'] = None
    
    # Clean confidence (ensure 0-100 range)
    confidence = parsed_dict.get('confidence')
    if confidence is not None:
        try:
            confidence = float(confidence)
            if confidence < 0:
                confidence = 0
            elif confidence > 100:
                confidence = 100
            parsed_dict['confidence'] = confidence
        except (ValueError, TypeError):
            parsed_dict['confidence'] = None
    
    # Clean agreement_score (ensure 0-100 range)
    agreement = parsed_dict.get('agreement_score')
    if agreement is not None:
        try:
            agreement = float(agreement)
            if agreement < 0:
                agreement = 0
            elif agreement > 100:
                agreement = 100
            parsed_dict['agreement_score'] = agreement
        except (ValueError, TypeError):
            parsed_dict['agreement_score'] = None
    
    return parsed_dict

# ==============================================================================
# FILE I/O AND DATA MANAGEMENT
# ==============================================================================

def save_results_incrementally(results: List[Dict], filename: str, fieldnames: List[str]):
    """Save results incrementally to prevent data loss."""
    file_exists = os.path.exists(filename)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    with open(filename, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerows(results)

def load_dataset(dataset_path: str, text_column: str = "text", 
                id_column: str = "article_id", target_column: str = "target",
                num_articles: Optional[int] = None):
    """Load and prepare dataset for experiments."""
    try:
        if not os.path.exists(dataset_path):
            raise FileNotFoundError(f"Dataset not found: {dataset_path}")
        
        if not HAS_PANDAS:
            raise ImportError("Pandas is required for dataset loading but not installed")
        
        df = pd.read_csv(dataset_path)
        
        # Validate required columns
        required_columns = [text_column, id_column]
        if target_column:
            required_columns.append(target_column)
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing columns in dataset: {missing_columns}")
        
        # Limit number of articles if specified
        if num_articles and num_articles > 0:
            df = df.head(num_articles)
        
        logger.info(f"Loaded dataset with {len(df)} articles from {dataset_path}")
        return df
    
    except Exception as e:
        logger.error(f"Failed to load dataset {dataset_path}: {e}")
        raise

# ==============================================================================
# CONVERSATION HISTORY FORMATTING
# ==============================================================================

def format_conversation_history(conversation_history: List[Dict[str, Any]], 
                               current_model: str, api_configs: Dict[str, Any]) -> str:
    """Format conversation history for display to models."""
    if not conversation_history:
        return "No previous conversation."
    
    formatted_history = []
    
    for entry in conversation_history:
        model_name = api_configs.get(entry["model"], {}).get("display_name", entry["model"])
        role = entry.get("model_role", "Unknown")
        
        # Mark the current model's own responses
        if entry["model"] == current_model:
            model_name = f"{model_name} (You)"
        
        formatted_entry = f"{role} ({model_name}): {entry['raw_response']}"
        formatted_history.append(formatted_entry)
    
    return "\n\n".join(formatted_history)

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

def generate_timestamp() -> str:
    """Generate timestamp for file naming."""
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def ensure_directory_exists(directory_path: str):
    """Ensure a directory exists, create if it doesn't."""
    Path(directory_path).mkdir(parents=True, exist_ok=True)

def get_parsing_function_by_name(function_name: str) -> Callable:
    """Get parsing function by name."""
    functions = {
        "parse_fake_news_response": parse_fake_news_response,
        "parse_ai_detection_response": parse_ai_detection_response
    }
    
    if function_name not in functions:
        raise ValueError(f"Unknown parsing function: {function_name}")
    
    return functions[function_name]

def validate_environment_variables() -> Dict[str, bool]:
    """Validate that required environment variables are set."""
    required_vars = [
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY", 
        "GOOGLE_API_KEY",
        "TOGETHER_API_KEY"
    ]
    
    validation_results = {}
    for var in required_vars:
        validation_results[var] = bool(os.getenv(var))
    
    return validation_results