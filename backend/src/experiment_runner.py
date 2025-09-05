# experiment_runner.py
"""
Production-ready unified experiment runner.
Processes datasets through AI models and generates comprehensive results.
"""

import csv
import json
import os
import uuid
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging

logger = logging.getLogger(__name__)

try:
    from .utils.session_manager import get_session_manager
except ImportError:
    logger.error("Failed to import session_manager")
    get_session_manager = None

try:
    from .unified_utils import get_api_clients
except ImportError:
    logger.error("Failed to import unified_utils")
    get_api_clients = None

try:
    from .unified_config import get_config_manager
except ImportError:
    logger.error("Failed to import unified_config")
    get_config_manager = None

# REMOVED MOCKCLIENT - NO FAKE DATA ALLOWED

class UnifiedExperimentRunner:
    """Production experiment runner with real AI processing."""
    
    def __init__(self, results_dir: str = "/app/results"):
        self.results_dir = Path(results_dir)
        self.results_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize managers with fallback handling
        try:
            self.session_manager = get_session_manager() if get_session_manager else None
            self.config_manager = get_config_manager() if get_config_manager else None
            
            if not self.session_manager:
                logger.warning("⚠️ Session manager not available - API keys may not work")
            if not self.config_manager:
                logger.warning("⚠️ Config manager not available - using fallback config")
                
        except Exception as e:
            logger.error(f"Failed to initialize managers: {e}")
            self.session_manager = None
            self.config_manager = None
        
    def run_experiment(self, config: Dict[str, Any], experiment_id: str, progress_callback=None) -> Dict[str, Any]:
        """Run a complete experiment with real AI processing."""
        logger.info(f"🚀 Starting experiment {experiment_id}: {config.get('name', 'Unnamed')}")
        
        # Set progress callback for real-time updates
        self.progress_callback = progress_callback
        
        try:
            # Extract experiment configuration
            domain = config.get('domain')
            experiment_type = config.get('experiment_type')
            models = config.get('models', [])
            dataset_path = config.get('dataset_path')
            session_id = config.get('session_id')  # For API keys
            dataset_session_id = config.get('dataset_session_id')  # For dataset access
            
            # Validate required configuration (dataset_path is optional)
            if not all([domain, experiment_type, models]):
                raise ValueError(f"Missing required configuration: domain={domain}, type={experiment_type}, models={models}")
            
            # Use default dataset if none provided
            if not dataset_path:
                logger.info(f"No dataset provided for experiment {experiment_id}, using domain defaults")
                dataset_path = None  # Will use domain's default dataset
            
            # Get domain configuration with fallback
            domain_config = None
            if self.config_manager:
                try:
                    domain_config = self.config_manager.get_domain_config(domain)
                    if not domain_config or not domain_config.get('enabled'):
                        raise ValueError(f"Domain '{domain}' not found or disabled")
                except Exception as e:
                    logger.warning(f"Failed to get domain config for {domain}: {e}")
                    domain_config = None
            
            # FAIL if no domain config - NO FALLBACKS
            if not domain_config:
                raise ValueError(f"FAILED: Domain '{domain}' configuration not found. Check domain setup.")
            
            # Get API keys from session (if provided)
            api_keys = None
            logger.info(f"🔧 DEBUG: Session ID received: {session_id}")
            logger.info(f"🔧 DEBUG: Session manager available: {self.session_manager is not None}")
            
            if session_id and self.session_manager:
                try:
                    api_keys = self.session_manager.get_api_keys(session_id)
                    logger.info(f"📋 Retrieved API keys from session {session_id[:8]}...")
                    logger.info(f"🔧 DEBUG: API keys type: {type(api_keys)}")
                    logger.info(f"🔧 DEBUG: API keys keys: {list(api_keys.keys()) if api_keys else 'None'}")
                    if api_keys:
                        # Show which keys have values (without showing the actual keys)
                        key_status = {k: "✓ present" if v else "✗ empty" for k, v in api_keys.items()}
                        logger.info(f"🔧 DEBUG: API keys status: {key_status}")
                except Exception as e:
                    logger.warning(f"Failed to get API keys from session: {e}")
                    logger.error(f"🔧 DEBUG: Session lookup error: {e}")
            else:
                logger.warning(f"🔧 DEBUG: No session_id ({session_id}) or session_manager ({self.session_manager})")
            
            # Initialize API clients with fallback
            clients = {}
            logger.info(f"🔧 DEBUG: About to call get_api_clients with: {type(api_keys or {})}")
            if get_api_clients:
                try:
                    clients = get_api_clients(api_keys or {})
                    logger.info(f"🔧 DEBUG: get_api_clients returned {len(clients)} clients: {list(clients.keys())}")
                except Exception as e:
                    logger.warning(f"Failed to initialize API clients: {e}")
                    logger.error(f"🔧 DEBUG: get_api_clients error: {e}")
            else:
                logger.error(f"🔧 DEBUG: get_api_clients function not available!")
            
            # FAIL if no real API clients available - NO MOCK FALLBACKS
            if not clients:
                raise ValueError("FAILED: No API clients available. Provide working API keys.")
            
            available_models = [model for model in models if model in clients]
            if not available_models:
                raise ValueError(f"FAILED: No API clients available for models {models}. Check your API keys.")
            
            logger.info(f"🔧 Processing with models: {available_models}")
            
            # Load dataset with Railway container isolation fix
            dataset = []
            if dataset_path:
                logger.info(f"🔍 Attempting to load dataset: {dataset_path}")
                try:
                    # PRIORITY 1: Check if dataset content was passed directly in config (Railway fix)
                    dataset_content = config.get('dataset_content')
                    if dataset_content:
                        logger.info(f"🚀 Using dataset content passed directly through config ({len(dataset_content)} chars)")
                        dataset = self._parse_csv_content(dataset_content)
                        logger.info(f"📊 Successfully parsed dataset with {len(dataset)} rows from direct content")
                    else:
                        # FALLBACK: Try filesystem resolution (may not work in Railway)
                        logger.info(f"⚠️ No dataset content in config, trying filesystem resolution")
                        if not os.path.exists(dataset_path):
                            logger.info(f"Dataset path doesn't exist directly, resolving: {dataset_path}")
                            actual_path = self._resolve_dataset_path(dataset_path)
                            logger.info(f"🔍 Resolved path result: {actual_path}")
                            if actual_path and os.path.exists(actual_path):
                                dataset_path = actual_path
                                logger.info(f"✅ Found resolved dataset at: {dataset_path}")
                                # Load from filesystem
                                with open(dataset_path, 'r', encoding='utf-8') as f:
                                    file_content = f.read()
                                dataset = self._parse_csv_content(file_content)
                            else:
                                logger.error(f"❌ Dataset file not found after resolution: {dataset_path} -> {actual_path}")
                                raise ValueError(f"FAILED: Dataset {dataset_path} not found and no content passed through config.")
                        else:
                            logger.info(f"✅ Dataset exists at original path: {dataset_path}")
                            with open(dataset_path, 'r', encoding='utf-8') as f:
                                file_content = f.read()
                            dataset = self._parse_csv_content(file_content)
                except Exception as e:
                    logger.error(f"Failed to load dataset {dataset_path}: {e}")
                    # Re-raise the exception instead of silently setting dataset_path to None
                    # This will trigger the proper error handling in the calling code
                    raise e
            
            # FAIL if no dataset loaded - NO FAKE DATA FALLBACKS
            if not dataset:
                # Check if we have dataset content in config that failed to parse
                dataset_content = config.get('dataset_content')
                if dataset_content:
                    raise ValueError(f"FAILED: Dataset content was provided but failed to parse. Check CSV format.")
                else:
                    raise ValueError(f"FAILED: No dataset content provided in experiment configuration.")
            
            # Process dataset through AI models with progress tracking
            results = self._process_dataset(
                dataset=dataset,
                domain_config=domain_config,
                experiment_type=experiment_type,
                models=available_models,
                clients=clients,
                config=config,
                progress_callback=self.progress_callback
            )
            
            # Generate metadata and metrics (no file generation)
            metadata = self._generate_metadata(
                experiment_id=experiment_id,
                config=config,
                domain_config=domain_config,
                total_rows=len(dataset),
                processed_rows=len(results)
            )
            
            metrics = self._generate_metrics(
                results=results,
                models=available_models,
                domain_config=domain_config
            )
            
            logger.info(f"✅ Experiment {experiment_id} completed successfully")
            logger.info(f"📊 Generated results for {len(results)} rows in memory")
            
            return {
                "status": "completed",
                "results_data": results,  # Store actual results in memory
                "metadata": metadata,
                "metrics": metrics,
                "output_files": []  # No files generated
            }
            
        except Exception as e:
            logger.error(f"❌ Experiment {experiment_id} failed: {e}")
            raise
    
    def _resolve_dataset_path(self, dataset_path: str) -> Optional[str]:
        """Resolve dataset paths to actual file locations."""
        # If it's already an absolute path, check if it exists
        if os.path.isabs(dataset_path) and os.path.exists(dataset_path):
            return dataset_path
        
        # Handle virtual /uploads/filename paths (legacy format)
        if dataset_path.startswith('/uploads/'):
            filename = dataset_path.replace('/uploads/', '')
            uploads_dir = Path(os.getenv('UPLOADS_DIR', '/app/uploads'))
            
            # Look for timestamped files (new format)
            if uploads_dir.exists():
                for file_path in uploads_dir.glob(f"*_{filename}"):
                    if file_path.is_file():
                        logger.info(f"Found timestamped file: {file_path}")
                        return str(file_path)
                
                # Fallback to exact filename match
                exact_path = uploads_dir / filename
                if exact_path.exists():
                    return str(exact_path)
            
            # Check project directory as fallback
            project_uploads = Path(__file__).parent.parent.parent / 'uploads'
            if project_uploads.exists():
                for file_path in project_uploads.glob(f"*_{filename}"):
                    if file_path.is_file():
                        return str(file_path)
                exact_path = project_uploads / filename
                if exact_path.exists():
                    return str(exact_path)
            
            return None
        
        # Handle relative paths
        if not os.path.exists(dataset_path):
            # Try uploads directory
            uploads_dir = Path(os.getenv('UPLOADS_DIR', '/app/uploads'))
            possible_path = uploads_dir / dataset_path
            if possible_path.exists():
                return str(possible_path)
        
        return dataset_path if os.path.exists(dataset_path) else None
    
# REMOVED _create_fallback_dataset - NO FAKE DATA ALLOWED
    
    def _load_dataset(self, dataset_path: str, session_id: str = None) -> List[Dict[str, Any]]:
        """Load dataset from memory or file."""
        dataset = []
        
        # TRY MEMORY FIRST (session-isolated)
        if session_id and dataset_path.startswith('dataset_'):
            try:
                # Import at runtime to avoid circular import
                import importlib
                import sys
                
                # Try different import paths for Railway environment
                main_module = None
                for module_path in ['backend.src.main', 'src.main', 'main']:
                    try:
                        main_module = importlib.import_module(module_path)
                        break
                    except ImportError:
                        continue
                
                if not main_module:
                    raise ImportError("Could not import main module")
                
                SESSION_DATASETS = main_module.SESSION_DATASETS
                logger.info(f"🔍 Checking session memory for {session_id} and {dataset_path}")
                logger.info(f"🔍 Available sessions: {list(SESSION_DATASETS.keys())}")
                
                if session_id in SESSION_DATASETS:
                    logger.info(f"🔍 Available datasets in session: {list(SESSION_DATASETS[session_id].keys())}")
                    if dataset_path in SESSION_DATASETS[session_id]:
                        logger.info(f"🧠 Loading dataset from session memory: {dataset_path}")
                        file_content = SESSION_DATASETS[session_id][dataset_path]
                        return self._parse_csv_content(file_content)
                    else:
                        logger.error(f"Dataset {dataset_path} not found in session {session_id}")
                else:
                    logger.error(f"Session {session_id} not found in memory")
                    
            except Exception as e:
                logger.error(f"Failed to load from memory: {e}")
                import traceback
                traceback.print_exc()
        
        # FALLBACK TO FILE SYSTEM (if path is real file path)
        if os.path.exists(dataset_path):
            logger.info(f"📁 Loading dataset from file: {dataset_path}")
            try:
                with open(dataset_path, 'r', encoding='utf-8', errors='ignore') as f:
                    file_content = f.read()
                    return self._parse_csv_content(file_content)
            except Exception as e:
                raise ValueError(f"Failed to load dataset from file {dataset_path}: {e}")
        
        # NEITHER MEMORY NOR FILE FOUND
        raise ValueError(f"Dataset not found: {dataset_path} (session: {session_id})")
    
    def _parse_csv_content(self, file_content: str) -> List[Dict[str, Any]]:
        """Parse CSV content from string."""
        dataset = []
        
        try:
            # Detect delimiter by sampling first few lines
            sample_lines = file_content.split('\n')[:5]  # Sample first 5 lines
            sample = '\n'.join(sample_lines)
            delimiter = ','
            if sample.count('\t') > sample.count(','):
                delimiter = '\t'
            
            # Parse CSV from string content
            import io
            csv_reader = csv.DictReader(io.StringIO(file_content), delimiter=delimiter)
                
            for row_idx, row in enumerate(csv_reader):
                if row_idx >= 1000:  # Limit for safety
                    logger.warning(f"⚠️ Dataset truncated to 1000 rows for processing")
                    break
                    
                # Clean and validate row
                clean_row = {}
                for key, value in row.items():
                    if key and value is not None:
                        clean_row[key.strip()] = str(value).strip()
                
                if clean_row:  # Only add non-empty rows
                    clean_row['_row_id'] = row_idx
                    dataset.append(clean_row)
                        
        except Exception as e:
            raise ValueError(f"Failed to parse CSV content: {e}")
        
        if not dataset:
            raise ValueError("Dataset is empty or could not be parsed")
        
        return dataset
    
    def _process_dataset(self, dataset: List[Dict], domain_config: Dict, 
                        experiment_type: str, models: List[str], 
                        clients: Dict, config: Dict, progress_callback=None) -> List[Dict]:
        """Process each row through AI models with real-time progress updates."""
        results = []
        total_rows = len(dataset)
        
        # Initialize progress
        if progress_callback:
            progress_callback(0)
        
        # Get system prompts for the domain
        system_prompts = domain_config.get('system_prompts', {})
        base_prompt = system_prompts.get('base', '')
        
        logger.info(f"🔄 Processing {total_rows} rows with {len(models)} models")
        
        for row_idx, row in enumerate(dataset):
            try:
                # Create content for AI processing
                content = self._extract_content_from_row(row, domain_config)
                if not content:
                    logger.warning(f"⚠️ Skipping row {row_idx}: no content extracted")
                    continue
                
                # Process with each model
                row_result = {
                    **row,  # Original row data
                    '_experiment_id': config.get('experiment_id', 'unknown'),
                    '_processed_at': datetime.now().isoformat(),
                    '_experiment_type': experiment_type
                }
                
                for model in models:
                    try:
                        # Generate AI response
                        ai_response = self._query_ai_model(
                            model=model,
                            client=clients[model],
                            prompt=base_prompt,
                            content=content,
                            config=config
                        )
                        
                        # Extract metrics and analysis
                        analysis = self._analyze_ai_response(
                            response=ai_response,
                            model=model,
                            domain_config=domain_config,
                            original_row=row
                        )
                        
                        # Store results
                        row_result[f'{model}_response'] = ai_response
                        row_result[f'{model}_confidence'] = analysis.get('confidence', 0.0)
                        row_result[f'{model}_classification'] = analysis.get('classification', 'unknown')
                        row_result[f'{model}_reasoning'] = analysis.get('reasoning', '')
                        
                        # Domain-specific metrics
                        if domain_config.get('name') == 'fake_news':
                            row_result[f'{model}_is_fake'] = analysis.get('is_fake', None)
                            row_result[f'{model}_bias_score'] = analysis.get('bias_score', 0.0)
                            row_result[f'{model}_manipulation_detected'] = analysis.get('manipulation_detected', False)
                        
                        logger.debug(f"✓ Processed row {row_idx+1}/{total_rows} with {model}")
                        
                    except Exception as e:
                        logger.error(f"❌ Failed to process row {row_idx} with {model}: {e}")
                        row_result[f'{model}_response'] = f"ERROR: {str(e)}"
                        row_result[f'{model}_confidence'] = 0.0
                        row_result[f'{model}_classification'] = 'error'
                        continue
                
                results.append(row_result)
                
                # Real-time progress updates
                current_progress = int(((row_idx + 1) / total_rows) * 100)
                if progress_callback:
                    progress_callback(current_progress)
                
                # Progress logging (less frequent for large datasets)
                if (row_idx + 1) % max(1, total_rows // 20) == 0:  # Update every 5% for large datasets
                    logger.info(f"📊 Progress: {current_progress}% ({row_idx + 1}/{total_rows} rows)")
                
                # Rate limiting
                time.sleep(0.1)  # Prevent API rate limiting
                
            except Exception as e:
                logger.error(f"❌ Failed to process row {row_idx}: {e}")
                continue
        
        # Final progress update
        if progress_callback:
            progress_callback(100)
        
        logger.info(f"✅ Processed {len(results)}/{total_rows} rows successfully")
        return results
    
    def _extract_content_from_row(self, row: Dict, domain_config: Dict) -> Optional[str]:
        """Extract content for AI analysis from dataset row."""
        # Common content fields to check
        content_fields = ['text', 'content', 'article', 'title', 'description', 'message']
        
        # Domain-specific field preferences
        domain_name = domain_config.get('name', '')
        if domain_name == 'fake_news':
            content_fields = ['text', 'title', 'content', 'article'] + content_fields
        elif domain_name == 'ai_text_detection':
            content_fields = ['text', 'content', 'generated_text'] + content_fields
        
        # Find the best content field
        for field in content_fields:
            if field in row and row[field] and len(str(row[field]).strip()) > 10:
                content = str(row[field]).strip()
                
                # Combine title and text if both exist
                if field == 'text' and 'title' in row and row['title']:
                    title = str(row['title']).strip()
                    content = f"Title: {title}\n\nContent: {content}"
                
                return content
        
        return None
    
    def _query_ai_model(self, model: str, client: Any, prompt: str, 
                       content: str, config: Dict) -> str:
        """Query AI model with content."""
        try:
            temperature = config.get('temperature', 0.7)
            max_tokens = 500  # Reasonable limit for analysis
            
            # Construct full prompt
            full_prompt = f"{prompt}\n\nContent to analyze:\n{content}\n\nProvide your analysis:"
            
# REMOVED MOCKCLIENT HANDLING - REAL APIS ONLY
            
            # Model-specific API calls
            if model == 'claude' and hasattr(client, 'messages'):
                response = client.messages.create(
                    model="claude-3-haiku-20240307",  # Use faster model for batch processing
                    max_tokens=max_tokens,
                    temperature=temperature,
                    messages=[{"role": "user", "content": full_prompt}]
                )
                return response.content[0].text
                
            elif model == 'openai' and hasattr(client, 'chat'):
                response = client.chat.completions.create(
                    model="gpt-4o-mini",  # Use cost-effective model
                    max_tokens=max_tokens,
                    temperature=temperature,
                    messages=[{"role": "user", "content": full_prompt}]
                )
                return response.choices[0].message.content
                
            elif model in ['together', 'deepseek'] and hasattr(client, 'chat'):
                # Get model name from config
                model_configs = {
                    'together': "lgai/exaone-3-5-32b-instruct",
                    'deepseek': "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free"
                }
                model_name = model_configs.get(model)
                
                response = client.chat.completions.create(
                    model=model_name,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    messages=[{"role": "user", "content": full_prompt}]
                )
                return response.choices[0].message.content
                
            elif model == 'gemini':
                # For Gemini, we'd need to adapt based on the client type
                import google.generativeai as genai
                if hasattr(client, 'generate_content'):
                    response = client.generate_content(
                        contents=full_prompt,
                        generation_config={
                            'temperature': temperature,
                            'max_output_tokens': max_tokens
                        }
                    )
                    return response.text
            
            raise ValueError(f"Unsupported model type: {model}")
            
        except Exception as e:
            logger.error(f"AI model query failed for {model}: {e}")
            raise
    
    def _analyze_ai_response(self, response: str, model: str, 
                           domain_config: Dict, original_row: Dict) -> Dict[str, Any]:
        """Analyze AI response and extract metrics."""
        analysis = {
            'confidence': 0.0,
            'classification': 'unknown',
            'reasoning': response[:200] + '...' if len(response) > 200 else response
        }
        
        try:
            response_lower = response.lower()
            
            # Extract confidence score (look for percentages or confidence indicators)
            import re
            confidence_patterns = [
                r'confidence[:\s]+(\d+\.?\d*)%?',
                r'(\d+\.?\d*)%\s*confident',
                r'certainty[:\s]+(\d+\.?\d*)%?'
            ]
            
            for pattern in confidence_patterns:
                match = re.search(pattern, response_lower)
                if match:
                    conf_value = float(match.group(1))
                    analysis['confidence'] = conf_value / 100 if conf_value > 1 else conf_value
                    break
            
            # Domain-specific analysis
            domain_name = domain_config.get('name', '')
            
            if domain_name == 'fake_news':
                # Fake news detection analysis
                fake_indicators = ['fake', 'false', 'misinformation', 'misleading', 'fabricated']
                real_indicators = ['real', 'true', 'factual', 'accurate', 'legitimate']
                
                fake_score = sum(1 for word in fake_indicators if word in response_lower)
                real_score = sum(1 for word in real_indicators if word in response_lower)
                
                if fake_score > real_score:
                    analysis['classification'] = 'fake'
                    analysis['is_fake'] = True
                elif real_score > fake_score:
                    analysis['classification'] = 'real'
                    analysis['is_fake'] = False
                else:
                    analysis['classification'] = 'uncertain'
                    analysis['is_fake'] = None
                
                # Bias detection
                bias_indicators = ['biased', 'partisan', 'slanted', 'propaganda']
                analysis['bias_score'] = min(1.0, sum(0.25 for word in bias_indicators if word in response_lower))
                
                # Manipulation detection  
                manip_indicators = ['manipulative', 'deceptive', 'misleading', 'sensationalized']
                analysis['manipulation_detected'] = any(word in response_lower for word in manip_indicators)
                
            elif domain_name == 'ai_text_detection':
                # AI-generated text detection
                ai_indicators = ['ai-generated', 'artificial', 'generated', 'synthetic', 'automated']
                human_indicators = ['human-written', 'authentic', 'original', 'natural']
                
                ai_score = sum(1 for word in ai_indicators if word in response_lower)
                human_score = sum(1 for word in human_indicators if word in response_lower)
                
                if ai_score > human_score:
                    analysis['classification'] = 'ai_generated'
                elif human_score > ai_score:
                    analysis['classification'] = 'human_written'
                else:
                    analysis['classification'] = 'uncertain'
            
            # If no confidence was extracted, provide a basic estimate
            if analysis['confidence'] == 0.0:
                # Basic confidence based on classification certainty
                if analysis['classification'] in ['fake', 'real', 'ai_generated', 'human_written']:
                    analysis['confidence'] = 0.7  # Moderate confidence
                else:
                    analysis['confidence'] = 0.3  # Low confidence for uncertain
            
        except Exception as e:
            logger.error(f"Failed to analyze response: {e}")
            analysis['reasoning'] = f"Analysis failed: {str(e)}"
        
        return analysis
    
    def _generate_metadata(self, experiment_id: str, config: Dict, domain_config: Dict, 
                          total_rows: int, processed_rows: int) -> Dict[str, Any]:
        """Generate experiment metadata (in-memory)."""
        return {
            'experiment_id': experiment_id,
            'config': config,
            'domain_config': {
                'name': domain_config.get('name'),
                'enabled': domain_config.get('enabled')
            },
            'generated_at': datetime.now().isoformat(),
            'total_results': processed_rows,
            'total_rows_in_dataset': total_rows,
            'models_used': config.get('models', []),
            'experiment_type': config.get('experiment_type'),
            'domain': config.get('domain')
        }
    
    def _generate_metrics(self, results: List[Dict], models: List[str], 
                         domain_config: Dict) -> Dict[str, Any]:
        """Generate experiment metrics (in-memory)."""
        try:
            return self._calculate_summary_metrics(results, {'models': models})
        except Exception as e:
            logger.warning(f"Failed to calculate metrics: {e}")
            return {
                'total_results': len(results),
                'models_used': models,
                'error': str(e)
            }
    
    # _write_results_csv method removed - using in-memory storage instead
    
    def _calculate_summary_metrics(self, results: List[Dict], config: Dict) -> Dict[str, Any]:
        """Calculate summary metrics from results."""
        if not results:
            return {}
        
        models = config.get('models', [])
        metrics = {
            'overview': {
                'total_rows': len(results),
                'models_used': models,
                'processed_at': datetime.now().isoformat()
            },
            'model_metrics': {}
        }
        
        # Calculate per-model metrics
        for model in models:
            model_results = []
            confidence_scores = []
            
            for result in results:
                confidence_field = f'{model}_confidence'
                classification_field = f'{model}_classification'
                
                if confidence_field in result:
                    try:
                        confidence = float(result[confidence_field])
                        confidence_scores.append(confidence)
                    except (ValueError, TypeError):
                        pass
                
                if classification_field in result:
                    classification = result[classification_field]
                    if classification != 'error':
                        model_results.append(classification)
            
            # Calculate metrics
            model_metrics = {
                'total_processed': len(model_results),
                'success_rate': len(model_results) / len(results) if results else 0,
                'avg_confidence': sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0,
                'min_confidence': min(confidence_scores) if confidence_scores else 0,
                'max_confidence': max(confidence_scores) if confidence_scores else 0,
                'classifications': {}
            }
            
            # Count classifications
            for classification in model_results:
                model_metrics['classifications'][classification] = model_metrics['classifications'].get(classification, 0) + 1
            
            metrics['model_metrics'][model] = model_metrics
        
        return metrics