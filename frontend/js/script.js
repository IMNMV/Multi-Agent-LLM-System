// API Configuration
const API_BASE_URL = 'https://multi-agent-llm-system-production.up.railway.app/api';

// Global State
let currentExperiments = {};
let currentConfig = {};
let queueConfig = {}; // Separate configuration for queue system
let sessionManager = null; // Session manager for API keys

// DOM Elements
let elements = {};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeEventListeners();
    
    // Initialize session manager for API keys
    if (typeof SessionManager !== 'undefined') {
        sessionManager = new SessionManager(API_BASE_URL);
        console.log('✅ Session manager initialized');
    } else {
        console.warn('⚠️ SessionManager not available - experiments may not work with API keys');
    }
    
    loadSavedApiKeys(); // Load API keys from session storage
    loadConfiguration();
    updateTemperatureDisplay();
    startPollingExperiments();
    
    // Initialize queue system
    setTimeout(() => {
        initializeQueue();
        restoreQueueState(); // Restore queue progress on page refresh
    }, 1000); // Delay to ensure all DOM elements are ready
});

// Initialize DOM element references
function initializeElements() {
    elements = {
        // Navigation
        navButtons: document.querySelectorAll('.nav-btn'),
        sections: document.querySelectorAll('.section'),
        
        // File upload (Setup)
        uploadZone: document.getElementById('uploadZone'),
        fileInput: document.getElementById('fileInput'),
        uploadStatus: document.getElementById('uploadStatus'),
        fileName: document.getElementById('fileName'),
        fileStatus: document.getElementById('fileStatus'),
        validationResults: document.getElementById('validationResults'),
        
        // Queue file upload (Independent)
        queueUploadZone: document.getElementById('queueUploadZone'),
        queueFileInput: document.getElementById('queueFileInput'),
        queueUploadStatus: document.getElementById('queueUploadStatus'),
        queueFileName: document.getElementById('queueFileName'),
        queueFileStatus: document.getElementById('queueFileStatus'),
        queueValidationResults: document.getElementById('queueValidationResults'),
        queueDomainSelect: document.getElementById('queueDomainSelect'),
        
        // Configuration
        domainSelect: document.getElementById('domainSelect'),
        experimentTypes: document.querySelectorAll('input[name="experimentTypes"]'),
        models: document.querySelectorAll('input[name="models"]'),
        adversarialToggle: document.getElementById('adversarialToggle'),
        adversarySelection: document.getElementById('adversarySelection'),
        adversaryModel: document.getElementById('adversaryModel'),
        metrics: document.querySelectorAll('input[name="metrics"]'),
        advMetrics: document.querySelectorAll('input[name="advMetrics"]'),
        customPrompt: document.getElementById('customPrompt'),
        temperature: document.getElementById('temperature'),
        tempValue: document.getElementById('tempValue'),
        maxTurns: document.getElementById('maxTurns'),
        contextStrategy: document.getElementById('contextStrategy'),
        numArticles: document.getElementById('numArticles'),
        
        // Buttons
        startExperiment: document.getElementById('startExperiment'),
        resetConfig: document.getElementById('resetConfig'),
        presetButtons: document.querySelectorAll('.preset-btn'),
        
        // Containers
        experimentsContainer: document.getElementById('experimentsContainer'),
        resultsContainer: document.getElementById('resultsContainer'),
        resultsExperimentSelect: document.getElementById('resultsExperimentSelect'),
        
        // Overlay and notifications
        loadingOverlay: document.getElementById('loadingOverlay'),
        loadingText: document.getElementById('loadingText'),
        toastContainer: document.getElementById('toastContainer'),
        
        // Configuration summary
        configSummary: document.getElementById('configSummary'),
        
        // API Keys
        claudeApiKey: document.getElementById('claudeApiKey'),
        openaiApiKey: document.getElementById('openaiApiKey'),
        geminiApiKey: document.getElementById('geminiApiKey'),
        togetherApiKey: document.getElementById('togetherApiKey'),
        saveApiKeys: document.getElementById('saveApiKeys'),
        clearApiKeys: document.getElementById('clearApiKeys'),
        toggleVisibilityButtons: document.querySelectorAll('.toggle-visibility'),
        testKeyButtons: document.querySelectorAll('.test-key'),
        
        // Analytics Modal
        analyticsModal: document.getElementById('analyticsModal'),
        analyticsSummary: document.getElementById('analyticsSummary'),
        apiCallsBreakdown: document.getElementById('apiCallsBreakdown'),
        totalEstimate: document.getElementById('totalEstimate'),
        confirmExperiment: document.getElementById('confirmExperiment'),
        cancelExperiment: document.getElementById('cancelExperiment'),
        closeAnalyticsModal: document.getElementById('closeAnalyticsModal')
    };
}

// Initialize Event Listeners
function initializeEventListeners() {
    // Data Requirements Modal - Debug version
    console.log('🔧 DEBUG: Initializing Data Requirements listeners...');
    
    const dataReqBtn = document.getElementById('dataRequirementsBtn');
    const queueDataReqBtn = document.getElementById('queueDataRequirementsBtn');
    const closeDataReqBtn = document.getElementById('closeDataRequirementsBtn');
    const dataReqModal = document.getElementById('dataRequirementsModal');
    
    console.log('🔧 DEBUG: Elements found:', {
        setupButton: !!dataReqBtn,
        queueButton: !!queueDataReqBtn,
        closeBtn: !!closeDataReqBtn,
        modal: !!dataReqModal
    });
    
    // Setup tab Data Requirements button
    if (dataReqBtn) {
        console.log('🔧 DEBUG: Adding click listener to Setup Data Requirements button');
        dataReqBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔧 DEBUG: Setup Data Requirements button clicked!');
            if (dataReqModal) {
                dataReqModal.style.display = 'flex';
                console.log('🔧 DEBUG: Modal should now be visible');
            } else {
                console.error('❌ DEBUG: Modal element not found!');
            }
        });
    } else {
        console.error('❌ DEBUG: Setup Data Requirements button not found!');
    }
    
    // Queue tab Data Requirements button
    if (queueDataReqBtn) {
        console.log('🔧 DEBUG: Adding click listener to Queue Data Requirements button');
        queueDataReqBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🔧 DEBUG: Queue Data Requirements button clicked!');
            if (dataReqModal) {
                dataReqModal.style.display = 'flex';
                console.log('🔧 DEBUG: Modal should now be visible');
            } else {
                console.error('❌ DEBUG: Modal element not found!');
            }
        });
    } else {
        console.error('❌ DEBUG: Queue Data Requirements button not found!');
    }
    
    if (closeDataReqBtn) {
        closeDataReqBtn.addEventListener('click', function() {
            dataReqModal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside
    if (dataReqModal) {
        dataReqModal.addEventListener('click', function(e) {
            if (e.target === dataReqModal) {
                dataReqModal.style.display = 'none';
            }
        });
    }

    // Navigation
    elements.navButtons.forEach(btn => {
        btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });
    
    // File upload (Setup)
    elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
    elements.uploadZone.addEventListener('dragover', handleDragOver);
    elements.uploadZone.addEventListener('drop', handleFileDrop);
    elements.uploadZone.addEventListener('dragleave', handleDragLeave);
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // Queue file upload (Independent)
    if (elements.queueUploadZone) {
        elements.queueUploadZone.addEventListener('click', () => elements.queueFileInput.click());
        elements.queueUploadZone.addEventListener('dragover', handleQueueDragOver);
        elements.queueUploadZone.addEventListener('drop', handleQueueFileDrop);
        elements.queueUploadZone.addEventListener('dragleave', handleQueueDragLeave);
        elements.queueFileInput.addEventListener('change', handleQueueFileSelect);
    }
    
    // Configuration
    elements.temperature.addEventListener('input', updateTemperatureDisplay);
    elements.adversarialToggle.addEventListener('change', toggleAdversarySelection);
    elements.startExperiment.addEventListener('click', startExperiment);
    elements.resetConfig.addEventListener('click', resetConfiguration);
    
    // Preset configurations
    elements.presetButtons.forEach(btn => {
        btn.addEventListener('click', () => loadPresetConfiguration(btn.dataset.preset));
    });
    
    // Results experiment selection
    elements.resultsExperimentSelect.addEventListener('change', loadExperimentResults);
    
    // API Keys
    elements.saveApiKeys.addEventListener('click', saveApiKeys);
    elements.clearApiKeys.addEventListener('click', clearApiKeys);
    elements.toggleVisibilityButtons.forEach(btn => {
        btn.addEventListener('click', togglePasswordVisibility);
    });
    elements.testKeyButtons.forEach(btn => {
        btn.addEventListener('click', testApiKey);
    });
    
    // Analytics Modal
    elements.confirmExperiment.addEventListener('click', confirmAndStartExperiment);
    elements.cancelExperiment.addEventListener('click', closeAnalyticsModal);
    elements.closeAnalyticsModal.addEventListener('click', closeAnalyticsModal);
    
    // Configuration validation
    elements.domainSelect.addEventListener('change', validateConfiguration);
    elements.experimentTypes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Uncheck other experiment type checkboxes (only one allowed in Setup)
            if (this.checked) {
                elements.experimentTypes.forEach(otherCheckbox => {
                    if (otherCheckbox !== this) {
                        otherCheckbox.checked = false;
                    }
                });
                
                // If single is selected, disable adversarial mode
                if (this.value === 'single') {
                    elements.adversarialToggle.checked = false;
                    elements.adversarialToggle.disabled = true;
                    // Hide adversarial metrics
                    elements.advMetrics.forEach(cb => cb.checked = false);
                    console.log('🔧 DEBUG: Single selected - disabled adversarial mode');
                } else {
                    // Re-enable adversarial toggle for multi-model experiments
                    elements.adversarialToggle.disabled = false;
                    console.log('🔧 DEBUG: Multi-model experiment selected - enabled adversarial toggle');
                }
            } else {
                // If no experiment type is selected, re-enable adversarial toggle
                const anyChecked = Array.from(elements.experimentTypes).some(cb => cb.checked);
                if (!anyChecked) {
                    elements.adversarialToggle.disabled = false;
                }
            }
            
            toggleAdversarySelection();
            validateConfiguration();
        });
    });
    elements.models.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            console.log("🔧 DEBUG: Model selection changed");
            validateConfiguration();
            toggleAdversarySelection(); // Update adversary selection when models change
        });
    });
}

// API Communication Functions
async function apiCall(endpoint, method = 'GET', data = null) {
    console.log(`🔧 DEBUG: Making API call to ${method} ${API_BASE_URL}${endpoint}`);
    if (data) {
        console.log("🔧 DEBUG: Request data:", data);
    }
    
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (data && method !== 'GET') {
        console.log('🔧 DEBUG: About to stringify data:', data);
        console.log('🔧 DEBUG: Data type:', typeof data);
        console.log('🔧 DEBUG: Method:', method);
        
        try {
            options.body = JSON.stringify(data);
            console.log('🔧 DEBUG: JSON body being sent:', options.body);
            console.log('🔧 DEBUG: JSON body length:', options.body.length);
        } catch (error) {
            console.error('❌ ERROR: Failed to stringify request data:', error);
            console.error('❌ ERROR: Problematic data:', data);
            throw error;
        }
    } else {
        console.log('🔧 DEBUG: No body set because:', {
            hasData: !!data,
            method: method,
            condition: data && method !== 'GET'
        });
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        console.log(`🔧 DEBUG: Response status: ${response.status}`);
        
        const result = await response.json();
        console.log("🔧 DEBUG: Response data:", result);
        
        return result;
    } catch (error) {
        console.error('❌ ERROR: API call failed:', error);
        showToast('API connection failed', 'error');
        return { success: false, error: 'Connection failed' };
    }
}

async function uploadFile(file, domain) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('domain', domain);
    
    try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    } catch (error) {
        console.error('File upload failed:', error);
        showToast('File upload failed', 'error');
        return { success: false, error: 'Upload failed' };
    }
}

// Queue File Upload (Independent)
async function uploadQueueFile(file, domain) {
    console.log('🔧 DEBUG: Uploading queue file:', file.name, 'domain:', domain);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('domain', domain);
    formData.append('queue_upload', 'true'); // Flag to identify queue uploads
    
    try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    } catch (error) {
        console.error('Queue file upload failed:', error);
        showToast('Queue file upload failed', 'error');
        return { success: false, error: 'Queue upload failed' };
    }
}

// Configuration Management
async function loadConfiguration() {
    // Configuration will be loaded from local presets instead of API
    // The backend doesn't have a /config endpoint yet
    console.log('📋 Using local configuration presets');
}

function updateConfigurationOptions(config) {
    // Update domain options
    const domainSelect = elements.domainSelect;
    domainSelect.innerHTML = '<option value="">Select Domain...</option>';
    
    config.domains.forEach(domain => {
        const option = document.createElement('option');
        option.value = domain;
        option.textContent = domain.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        domainSelect.appendChild(option);
    });
}

function validateConfiguration() {
    const domain = elements.domainSelect.value;
    const selectedExperiments = Array.from(elements.experimentTypes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    const selectedModels = Array.from(elements.models)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    const isValid = domain && selectedExperiments.length > 0 && selectedModels.length > 0;
    elements.startExperiment.disabled = !isValid;
    
    // Handle context injection strategy constraints
    updateContextInjectionConstraints(selectedExperiments);
    
    // Update configuration summary
    updateConfigurationSummary();
    
    return isValid;
}

function updateContextInjectionConstraints(selectedExperiments) {
    const contextStrategySelect = elements.contextStrategy;
    const maxTurnsInput = elements.maxTurns;
    const isSingleModelOnly = selectedExperiments.length === 1 && selectedExperiments.includes('single');
    
    if (isSingleModelOnly) {
        // For single model experiments, only "first_turn_only" makes sense
        contextStrategySelect.value = 'first_turn_only';
        contextStrategySelect.disabled = true;
        
        // Disable other options
        Array.from(contextStrategySelect.options).forEach(option => {
            if (option.value !== 'first_turn_only') {
                option.disabled = true;
            } else {
                option.disabled = false;
            }
        });
        
        // Disable max turns for single model (not relevant)
        maxTurnsInput.disabled = true;
        maxTurnsInput.style.opacity = '0.6';
        
        console.log("🔧 DEBUG: Context injection strategy locked to 'first_turn_only' for single model experiments");
        console.log("🔧 DEBUG: Max turns disabled for single model experiments");
    } else {
        // Enable all options for multi-turn experiments
        contextStrategySelect.disabled = false;
        Array.from(contextStrategySelect.options).forEach(option => {
            option.disabled = false;
        });
        
        // Enable max turns for multi-agent experiments
        maxTurnsInput.disabled = false;
        maxTurnsInput.style.opacity = '1';
        
        console.log("🔧 DEBUG: Context injection strategy enabled for multi-turn experiments");
        console.log("🔧 DEBUG: Max turns enabled for multi-turn experiments");
    }
}

function updateConfigurationSummary() {
    const domain = elements.domainSelect.value;
    const selectedExperiments = Array.from(elements.experimentTypes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    const selectedModels = Array.from(elements.models)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    const adversarial = elements.adversarialToggle.checked;
    const temperature = elements.temperature.value;
    const maxTurns = elements.maxTurns.value;
    const strategy = elements.contextStrategy.value;
    const numArticles = elements.numArticles.value;
    
    if (!domain || selectedExperiments.length === 0 || selectedModels.length === 0) {
        elements.configSummary.style.display = 'none';
        return;
    }
    
    elements.configSummary.style.display = 'block';
    
    const isSingleModelOnly = selectedExperiments.length === 1 && selectedExperiments.includes('single');
    
    const summaryItems = [
        { label: 'Domain', value: domain.replace('_', ' ').toUpperCase(), type: 'info' },
        { label: 'Single Experiment', value: selectedExperiments.includes('single') ? 'YES' : 'NO', type: selectedExperiments.includes('single') ? 'yes' : 'no' },
        { label: 'Dual Experiment', value: selectedExperiments.includes('dual') ? 'YES' : 'NO', type: selectedExperiments.includes('dual') ? 'yes' : 'no' },
        { label: 'Consensus Experiment', value: selectedExperiments.includes('consensus') ? 'YES' : 'NO', type: selectedExperiments.includes('consensus') ? 'yes' : 'no' },
        { label: 'Adversarial Mode', value: adversarial ? 'YES' : 'NO', type: adversarial ? 'yes' : 'no' },
        { label: 'Models Selected', value: selectedModels.length.toString(), type: 'info' },
        { label: 'Temperature', value: temperature, type: 'info' },
        { label: 'Max Turns', value: isSingleModelOnly ? 'N/A' : maxTurns, type: 'info' },
        { label: 'Context Strategy', value: isSingleModelOnly ? 'N/A' : strategy.replace(/_/g, ' ').toUpperCase(), type: 'info' },
        { label: 'Article Limit', value: numArticles || 'ALL', type: 'info' }
    ];
    
    const summaryGrid = document.getElementById('summaryGrid');
    summaryGrid.innerHTML = '';
    
    summaryItems.forEach(item => {
        const summaryItem = document.createElement('div');
        summaryItem.className = 'summary-item';
        
        summaryItem.innerHTML = `
            <span class="summary-label">${item.label}:</span>
            <span class="summary-value summary-${item.type}">${item.value}</span>
        `;
        
        summaryGrid.appendChild(summaryItem);
    });
}

function resetConfiguration() {
    elements.domainSelect.value = '';
    elements.experimentTypes.forEach(cb => cb.checked = false);
    elements.models.forEach(cb => cb.checked = false);
    elements.adversarialToggle.checked = false;
    elements.adversaryModel.value = 'random';
    elements.metrics.forEach(cb => cb.checked = cb.hasAttribute('checked')); // Reset to defaults
    elements.advMetrics.forEach(cb => cb.checked = false);
    elements.customPrompt.value = '';
    elements.temperature.value = 0.7;
    elements.maxTurns.value = 3;
    elements.contextStrategy.value = 'first_turn_only';
    elements.numArticles.value = '';
    
    elements.adversarySelection.style.display = 'none';
    updateTemperatureDisplay();
    validateConfiguration();
}

function loadPresetConfiguration(presetName) {
    console.log(`🔧 DEBUG: Loading preset configuration: ${presetName}`);
    showLoading('Loading preset configuration...');
    
    // Use setTimeout to prevent UI blocking
    setTimeout(() => {
    
    // Preset configurations (matching backend)
    const presets = {
        'fake_news_basic': {
            domain: 'fake_news',
            experiment_types: ['single'],
            models: ['together'],
            adversarial: false,
            temperature: 0.7,
            max_turns: 1,
            num_articles: 100
        },
        'fake_news_adversarial': {
            domain: 'fake_news',
            experiment_types: ['dual', 'consensus'],
            models: ['together', 'claude', 'openai'],
            adversarial: true,
            temperature: 0.7,
            max_turns: 3,
            context_injection_strategy: 'first_and_last_turn',
            num_articles: null
        },
        'ai_detection_basic': {
            domain: 'ai_text_detection',
            experiment_types: ['single', 'dual'],
            models: ['together', 'claude'],
            adversarial: false,
            temperature: 0.7,
            max_turns: 2,
            context_injection_strategy: 'first_and_last_turn',
            num_articles: 200
        },
        'comprehensive_comparison': {
            domain: 'fake_news',
            experiment_types: ['single', 'dual', 'consensus'],
            models: ['claude', 'openai', 'together'],
            adversarial: true,
            temperature: 0.7,
            max_turns: 3,
            context_injection_strategy: 'all_turns',
            num_articles: null
        }
    };
    
    const config = presets[presetName];
    console.log(`🔧 DEBUG: Found preset config:`, config);
    
    if (config) {
        console.log(`🔧 DEBUG: Applying preset configuration...`);
        // Apply configuration
        elements.domainSelect.value = config.domain;
        
        elements.experimentTypes.forEach(cb => {
            cb.checked = config.experiment_types.includes(cb.value);
        });
        
        elements.models.forEach(cb => {
            cb.checked = config.models.includes(cb.value);
        });
        
        elements.adversarialToggle.checked = config.adversarial;
        elements.temperature.value = config.temperature;
        elements.maxTurns.value = config.max_turns;
        
        if (config.context_injection_strategy) {
            elements.contextStrategy.value = config.context_injection_strategy;
        }
        
        if (config.num_articles) {
            elements.numArticles.value = config.num_articles;
        }
        
        updateTemperatureDisplay();
        validateConfiguration();
        console.log(`✅ DEBUG: Preset ${presetName} loaded successfully`);
        showToast(`Loaded preset: ${presetName.replace(/_/g, ' ')}`, 'success');
    } else {
        console.error(`❌ ERROR: Preset ${presetName} not found`);
        showToast(`Preset ${presetName} not found`, 'error');
    }
    
    console.log(`🔧 DEBUG: Hiding loading overlay`);
    hideLoading();
    
    }, 100); // Small delay to show loading animation
}

// File Upload Handlers (Setup)
function handleDragOver(e) {
    e.preventDefault();
    elements.uploadZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
    }
}

// Queue File Upload Handlers (Independent)
function handleQueueDragOver(e) {
    e.preventDefault();
    elements.queueUploadZone.classList.add('dragover');
}

function handleQueueDragLeave(e) {
    e.preventDefault();
    elements.queueUploadZone.classList.remove('dragover');
}

function handleQueueFileDrop(e) {
    e.preventDefault();
    elements.queueUploadZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleQueueFileUpload(files[0]);
    }
}

function handleQueueFileSelect(e) {
    if (e.target.files.length > 0) {
        handleQueueFileUpload(e.target.files[0]);
    }
}

async function handleFileUpload(file) {
    if (!file.name.endsWith('.csv')) {
        showToast('Please select a CSV file', 'error');
        return;
    }
    
    const domain = elements.domainSelect.value;
    if (!domain) {
        showToast('Please select a domain first', 'warning');
        return;
    }
    
    showLoading('Uploading and validating file...');
    
    const response = await uploadFile(file, domain);
    
    hideLoading();
    
    if (response.success) {
        elements.fileName.textContent = file.name;
        elements.fileStatus.textContent = 'Uploaded and validated';
        
        displayValidationResults(response.data.validation);
        elements.uploadStatus.style.display = 'block';
        
        currentConfig.dataset_path = response.data.file_path;
        // Store estimated article count for analytics
        console.log("🔧 DEBUG: Validation response:", response.data.validation);
        console.log("🔧 DEBUG: Statistics object:", response.data.validation.statistics);
        
        // Try multiple possible locations for row count
        const rowCount = response.data.validation.total_rows || 
                        response.data.validation.statistics?.total_rows ||
                        response.data.validation.statistics?.row_count ||
                        response.data.validation.statistics?.num_rows ||
                        100;
        
        console.log("🔧 DEBUG: Found row count:", rowCount);
        currentConfig.estimated_articles = rowCount;
        console.log("🔧 DEBUG: Set estimated_articles to:", currentConfig.estimated_articles);
        
        // STORE SESSION ID FOR EXPERIMENTS
        if (response.data.session_id) {
            localStorage.setItem('dataset_session_id', response.data.session_id);
            console.log("🔧 DEBUG: Stored session ID:", response.data.session_id.substring(0, 8) + "...");
        }
        
        validateConfiguration();
        showToast('File uploaded successfully', 'success');
    } else {
        showToast(`Upload failed: ${response.error}`, 'error');
    }
}

// Queue File Upload Handler (Independent)
async function handleQueueFileUpload(file) {
    console.log('🔧 DEBUG: Queue file upload started:', file.name);
    
    if (!file.name.endsWith('.csv')) {
        showToast('Please select a CSV file for queue', 'error');
        return;
    }
    
    const domain = elements.queueDomainSelect.value;
    if (!domain) {
        showToast('Please select a queue domain first', 'warning');
        return;
    }
    
    showLoading('Uploading and validating queue dataset...');
    
    const response = await uploadQueueFile(file, domain);
    
    hideLoading();
    
    if (response.success) {
        elements.queueFileName.textContent = file.name;
        elements.queueFileStatus.textContent = 'Uploaded and validated';
        
        displayQueueValidationResults(response.data.validation);
        elements.queueUploadStatus.style.display = 'block';
        
        // Store in separate queue config
        queueConfig.dataset_path = response.data.file_path;
        queueConfig.domain = domain;
        queueConfig.estimated_articles = response.data.validation.statistics?.total_rows || 100;
        
        console.log('✅ DEBUG: Queue config updated:', queueConfig);
        showToast('Queue dataset uploaded successfully', 'success');
    } else {
        showToast(`Queue upload failed: ${response.error}`, 'error');
    }
}

function displayValidationResults(validation) {
    const container = elements.validationResults;
    container.innerHTML = '';
    
    // Add null check for validation object
    if (!validation) {
        console.error('🔧 DEBUG: Validation object is null or undefined');
        container.innerHTML = '<div class="validation-error"><i class="fas fa-exclamation-triangle"></i>Validation data missing</div>';
        return;
    }
    
    if (validation.is_valid) {
        container.innerHTML = `
            <div class="validation-success">
                <i class="fas fa-check-circle"></i>
                Dataset validation successful
            </div>
        `;
    } else {
        let html = '<div class="validation-error">';
        html += '<i class="fas fa-exclamation-triangle"></i>';
        html += '<strong>Validation Issues:</strong><ul>';
        
        // Add null check for errors array
        if (validation.errors && Array.isArray(validation.errors)) {
            validation.errors.forEach(error => {
                html += `<li>${error}</li>`;
            });
        } else {
            html += '<li>Unknown validation error</li>';
        }
        
        html += '</ul></div>';
        container.innerHTML = html;
    }
}

// Queue Validation Results Display (Independent)
function displayQueueValidationResults(validation) {
    console.log('🔧 DEBUG: Queue validation result:', validation);
    const container = elements.queueValidationResults;
    container.innerHTML = '';
    
    if (validation.is_valid) {
        let detailsHtml = '';
        if (validation.statistics) {
            const stats = validation.statistics;
            const totalRows = stats.total_rows || 'Unknown';
            const totalCols = stats.total_columns || 'Unknown';
            const columns = validation.column_info ? validation.column_info.column_names : [];
            
            detailsHtml = `
                <div class="validation-details">
                    <small>
                        Rows: ${totalRows}, Columns: ${totalCols}
                        ${columns.length > 0 ? ` (${columns.slice(0, 3).join(', ')}${columns.length > 3 ? '...' : ''})` : ''}
                    </small>
                </div>
            `;
        }
        
        container.innerHTML = `
            <div class="validation-success">
                <i class="fas fa-check-circle"></i>
                Queue dataset validation successful
                ${detailsHtml}
            </div>
        `;
    } else {
        let html = '<div class="validation-error">';
        html += '<i class="fas fa-exclamation-triangle"></i>';
        html += '<strong>Queue Validation Issues:</strong><ul>';
        
        if (validation.errors && validation.errors.length > 0) {
            validation.errors.forEach(error => {
                html += `<li>${error}</li>`;
            });
        } else {
            html += '<li>Unknown validation error</li>';
        }
        
        html += '</ul></div>';
        container.innerHTML = html;
    }
}

// Experiment Management
async function startExperiment() {
    if (!validateConfiguration()) {
        showToast('Please complete the configuration', 'warning');
        return;
    }
    
    if (!currentConfig.dataset_path) {
        showToast('Please upload a dataset first', 'warning');
        return;
    }
    
    // Show pre-run analytics instead of directly starting
    showPreRunAnalytics();
}

function showPreRunAnalytics() {
    const selectedMetrics = Array.from(elements.metrics)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    const selectedAdvMetrics = Array.from(elements.advMetrics)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    const experimentConfig = {
        domain: elements.domainSelect.value,
        dataset_path: currentConfig.dataset_path,
        experiment_types: Array.from(elements.experimentTypes)
            .filter(cb => cb.checked)
            .map(cb => cb.value),
        models: Array.from(elements.models)
            .filter(cb => cb.checked)
            .map(cb => cb.value),
        adversarial: elements.adversarialToggle.checked,
        adversary_model: elements.adversarialToggle.checked ? elements.adversaryModel.value : null,
        selected_metrics: selectedMetrics,
        selected_adv_metrics: selectedAdvMetrics,
        custom_prompt: elements.customPrompt.value || null,
        temperature: parseFloat(elements.temperature.value),
        max_turns: parseInt(elements.maxTurns.value),
        context_injection_strategy: elements.contextStrategy.value,
        num_articles: elements.numArticles.value ? parseInt(elements.numArticles.value) : null
    };
    
    // Store config for later use
    currentConfig.pendingExperiment = experimentConfig;
    
    // Calculate analytics
    const analytics = calculatePreRunAnalytics(experimentConfig);
    
    // Populate modal content
    populateAnalyticsModal(analytics, experimentConfig);
    
    // Show modal
    elements.analyticsModal.style.display = 'flex';
}

function calculatePreRunAnalytics(config) {
    // Get dataset size (prioritize actual uploaded dataset size)
    console.log("🔧 DEBUG: calculatePreRunAnalytics - currentConfig.estimated_articles:", currentConfig.estimated_articles);
    console.log("🔧 DEBUG: calculatePreRunAnalytics - config.num_articles:", config.num_articles);
    const numArticles = currentConfig.estimated_articles || config.num_articles || 100;
    console.log("🔧 DEBUG: calculatePreRunAnalytics - final numArticles:", numArticles);
    const maxTurns = config.max_turns;
    const experimentTypes = config.experiment_types;
    const models = config.models;
    
    let totalApiCalls = 0;
    const breakdown = [];
    
    // Calculate for each experiment type
    if (experimentTypes.includes('single')) {
        const numModels = models.length;
        const singleCalls = numArticles * numModels;
        totalApiCalls += singleCalls;
        
        breakdown.push({
            type: 'Single Model',
            calculation: `${numArticles} articles × ${numModels} models`,
            calls: singleCalls
        });
    }
    
    if (experimentTypes.includes('dual')) {
        // Dual uses pairs of models, each model in pair makes calls
        const numPairs = 1; // Assuming 1 pair for simplicity - could be expanded
        const dualCalls = numArticles * numPairs * 2 * maxTurns;
        totalApiCalls += dualCalls;
        
        breakdown.push({
            type: 'Dual Model',
            calculation: `${numArticles} articles × ${numPairs} pair × 2 models × ${maxTurns} turns`,
            calls: dualCalls
        });
    }
    
    if (experimentTypes.includes('consensus')) {
        // Consensus uses 3 models
        const consensusCalls = numArticles * 3 * maxTurns;
        totalApiCalls += consensusCalls;
        
        breakdown.push({
            type: 'Consensus (3-Model)',
            calculation: `${numArticles} articles × 3 models × ${maxTurns} turns`,
            calls: consensusCalls
        });
    }
    
    return {
        numArticles,
        maxTurns,
        experimentTypes,
        models,
        breakdown,
        totalApiCalls,
        contextStrategy: config.context_injection_strategy,
        adversarial: config.adversarial,
        customPrompt: !!config.custom_prompt
    };
}

function populateAnalyticsModal(analytics, config) {
    // Populate summary section
    elements.analyticsSummary.innerHTML = `
        <h4><i class="fas fa-info-circle"></i> Experiment Configuration</h4>
        <div class="summary-item">
            <span class="summary-label">Domain:</span>
            <span class="summary-value">${config.domain.replace('_', ' ').toUpperCase()}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Articles to Process:</span>
            <span class="summary-value">${analytics.numArticles}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Experiment Types:</span>
            <span class="summary-value">${analytics.experimentTypes.join(', ').toUpperCase()}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Models Selected:</span>
            <span class="summary-value">${analytics.models.join(', ').toUpperCase()}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Max Conversation Turns:</span>
            <span class="summary-value">${analytics.experimentTypes.length === 1 && analytics.experimentTypes.includes('single') ? 'N/A' : analytics.maxTurns}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Context Injection:</span>
            <span class="summary-value">${analytics.experimentTypes.length === 1 && analytics.experimentTypes.includes('single') ? 'N/A' : analytics.contextStrategy.replace('_', ' ').toUpperCase()}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Adversarial Mode:</span>
            <span class="summary-value">${analytics.adversarial ? 'ENABLED' : 'DISABLED'}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Custom Prompt:</span>
            <span class="summary-value">${analytics.customPrompt ? 'ENABLED' : 'DISABLED'}</span>
        </div>
    `;
    
    // Populate API calls breakdown
    let breakdownHtml = '<h4><i class="fas fa-calculator"></i> Estimated API Calls Breakdown</h4>';
    
    analytics.breakdown.forEach(item => {
        breakdownHtml += `
            <div class="breakdown-item">
                <span class="breakdown-label">${item.type}:</span>
                <span class="breakdown-calculation">${item.calculation}</span>
                <span class="breakdown-value">${item.calls} calls</span>
            </div>
        `;
    });
    
    elements.apiCallsBreakdown.innerHTML = breakdownHtml;
    
    // Populate total estimate
    elements.totalEstimate.innerHTML = `
        <h4>Total Estimated API Calls</h4>
        <p class="total-calls">${analytics.totalApiCalls}</p>
    `;
}

function closeAnalyticsModal() {
    elements.analyticsModal.style.display = 'none';
    // Clear pending experiment
    delete currentConfig.pendingExperiment;
}

async function confirmAndStartExperiment() {
    if (!currentConfig.pendingExperiment) {
        showToast('No experiment configuration found', 'error');
        return;
    }
    
    console.log('🔧 DEBUG: Raw currentConfig:', currentConfig);
    console.log('🔧 DEBUG: pendingExperiment keys:', Object.keys(currentConfig.pendingExperiment));
    console.log('🔧 DEBUG: Original experiment config:', currentConfig.pendingExperiment);
    
    // Convert frontend format to backend format
    const frontendConfig = currentConfig.pendingExperiment;
    
    // Validate the config has required fields
    console.log('🔧 DEBUG: Validating required fields:');
    console.log('  - domain:', frontendConfig.domain);
    console.log('  - dataset_path:', frontendConfig.dataset_path);
    console.log('  - experiment_types:', frontendConfig.experiment_types);
    
    if (!frontendConfig.domain || !frontendConfig.dataset_path || !frontendConfig.experiment_types || frontendConfig.experiment_types.length === 0) {
        console.error('❌ ERROR: Missing required fields in experiment config:', {
            domain: frontendConfig.domain,
            dataset_path: frontendConfig.dataset_path,
            experiment_types: frontendConfig.experiment_types
        });
        showToast('Invalid experiment configuration', 'error');
        return;
    }
    
    // Convert to backend expected format
    const backendConfig = {
        name: `${frontendConfig.domain} experiment - ${frontendConfig.experiment_types[0]}`, // Generate a name
        domain: frontendConfig.domain,
        experiment_type: frontendConfig.experiment_types[0], // Take first experiment type (single value)
        models: frontendConfig.models,
        context_strategy: frontendConfig.context_injection_strategy, // Renamed field
        adversarial: frontendConfig.adversarial,
        temperature: frontendConfig.temperature,
        num_articles: frontendConfig.num_articles,
        priority: 5, // Default priority
        session_id: localStorage.getItem('api_session_id') || (sessionManager ? sessionManager.getSessionId() : null), // Use API session ID for auth
        dataset_session_id: localStorage.getItem('dataset_session_id'), // Use dataset session ID for data access
        dataset_path: frontendConfig.dataset_path // Add dataset path
        // Remove fields backend doesn't need: selected_metrics, selected_adv_metrics, custom_prompt, max_turns, etc.
    };
    
    console.log('🔧 DEBUG: Converted backend config:', backendConfig);
    
    // Test JSON stringification
    try {
        const jsonString = JSON.stringify(backendConfig, null, 2);
        console.log('🔧 DEBUG: Stringified backend config:', jsonString);
        console.log('🔧 DEBUG: Stringified length:', jsonString.length);
    } catch (error) {
        console.error('❌ ERROR: Cannot stringify backend config:', error);
        showToast('Config serialization error', 'error');
        return;
    }
    
    // Close modal
    closeAnalyticsModal();
    
    // Start the experiment
    showLoading('Starting experiment...');
    
    const response = await apiCall('/experiments/start', 'POST', backendConfig);
    
    hideLoading();
    
    console.log('🔧 DEBUG: Full response from /experiments/start:', response);
    
    // Backend returns ExperimentResponse format: {experiment_id, status, message, estimated_duration_minutes}
    // Check for experiment_id to determine success (status 200 means the request was successful)
    if (response && response.experiment_id) {
        showToast(`Experiment started successfully: ${response.message || 'Queued for processing'}`, 'success');
        console.log(`✅ DEBUG: Experiment created with ID: ${response.experiment_id}, status: ${response.status}`);
        switchSection('experiments');
        updateExperimentsList();
    } else {
        // Handle error case - if we get here, check if response has error details
        const errorMsg = response?.detail || response?.message || response?.error || 'Unknown error';
        console.error('❌ ERROR: Experiment start failed:', response);
        showToast(`Failed to start experiment: ${errorMsg}`, 'error');
    }
}

async function updateExperimentsList() {
    const response = await apiCall('/experiments/');
    
    // Backend returns experiments array: {"experiments": [...]}
    // Convert to object with experiment IDs as keys: {experiment_id: experiment_data}
    if (response && response.experiments !== undefined) {
        currentExperiments = {};
        response.experiments.forEach(experiment => {
            currentExperiments[experiment.id] = experiment;
        });
        renderExperiments();
        updateResultsSelect();
    }
}

function renderExperiments() {
    const container = elements.experimentsContainer;
    
    if (Object.keys(currentExperiments).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-flask"></i>
                <p>No experiments running</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    Object.entries(currentExperiments).forEach(([id, experiment]) => {
        html += createExperimentCard(id, experiment);
    });
    
    container.innerHTML = html;
}

function createExperimentCard(id, experiment) {
    const statusClass = `status-${experiment.status}`;
    const progressWidth = experiment.progress || 0;
    
    return `
        <div class="experiment-card">
            <div class="experiment-header">
                <div class="experiment-id">${id.substring(0, 8)}...</div>
                <div class="experiment-status ${statusClass}">${experiment.status}</div>
            </div>
            
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progressWidth}%"></div>
            </div>
            
            <div class="experiment-details">
                <div class="detail-item">
                    <span class="detail-label">Domain:</span>
                    <span>${experiment.config?.domain || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Models:</span>
                    <span>${experiment.config?.models?.join(', ') || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Started:</span>
                    <span>${formatDate(experiment.start_time)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Progress:</span>
                    <span>${progressWidth}%</span>
                </div>
            </div>
            
            <div style="margin-top: 15px;">
                <strong>Current Step:</strong> ${experiment.current_step || 'Initializing...'}
            </div>
        </div>
    `;
}

async function loadExperimentResults() {
    const experimentId = elements.resultsExperimentSelect.value;
    if (!experimentId) {
        elements.resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-bar"></i>
                <p>Select an experiment to view results</p>
            </div>
        `;
        return;
    }
    
    showLoading('Loading experiment results...');
    
    const response = await apiCall(`/downloads/experiments/${experimentId}/results`);
    
    hideLoading();
    
    if (response.success) {
        renderExperimentResults(response.data);
    } else {
        showToast('Failed to load experiment results', 'error');
    }
}

function renderExperimentResults(data) {
    const container = elements.resultsContainer;
    
    if (!data.metrics) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock"></i>
                <p>Results not yet available</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="metrics-grid">';
    
    const metrics = data.metrics.overall_metrics || {};
    Object.entries(metrics).forEach(([key, value]) => {
        html += `
            <div class="metric-card">
                <div class="metric-value">${(value * 100).toFixed(1)}%</div>
                <div class="metric-label">${key.replace(/_/g, ' ')}</div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // Add download buttons if results files are available
    if (data.results_file || data.metrics_file) {
        html += '<div class="action-buttons">';
        if (data.results_file) {
            html += `<button class="btn btn-secondary" onclick="downloadResults('${data.experiment.id}', 'results')">
                <i class="fas fa-download"></i> Download Results
            </button>`;
        }
        if (data.metrics_file) {
            html += `<button class="btn btn-secondary" onclick="downloadResults('${data.experiment.id}', 'metrics')">
                <i class="fas fa-download"></i> Download Metrics
            </button>`;
        }
        html += '</div>';
    }
    
    container.innerHTML = html;
}

function updateResultsSelect() {
    const select = elements.resultsExperimentSelect;
    select.innerHTML = '<option value="">Select experiment...</option>';
    
    Object.entries(currentExperiments).forEach(([id, experiment]) => {
        if (experiment.status === 'completed') {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${id.substring(0, 8)}... (${experiment.config?.domain || 'Unknown'})`;
            select.appendChild(option);
        }
    });
}

async function downloadResults(experimentId, fileType) {
    window.open(`${API_BASE_URL}/download/${experimentId}/${fileType}`, '_blank');
}

// Polling for experiment updates
function startPollingExperiments() {
    setInterval(updateExperimentsList, 5000); // Poll every 5 seconds
}

// UI Utility Functions
function switchSection(sectionName) {
    // Trigger 3D transition effect
    if (window.ThreeJSEffects && window.ThreeJSEffects.background) {
        window.ThreeJSEffects.background.createSectionTransition();
    }
    
    // Update navigation
    elements.navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionName);
    });
    
    // Update sections
    elements.sections.forEach(section => {
        section.classList.toggle('active', section.id === sectionName);
    });
    
    // Load section-specific data
    if (sectionName === 'experiments') {
        updateExperimentsList();
    }
}

function updateTemperatureDisplay() {
    elements.tempValue.textContent = elements.temperature.value;
}

function toggleAdversarySelection() {
    const isChecked = elements.adversarialToggle.checked;
    const selectedModels = Array.from(elements.models)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    const selectedExperiments = Array.from(elements.experimentTypes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    console.log("🔧 DEBUG: Adversarial toggle changed. Checked:", isChecked, "Selected models:", selectedModels, "Selected experiments:", selectedExperiments);
    
    // If adversarial is turned on, uncheck single experiment type
    if (isChecked && selectedExperiments.includes('single')) {
        elements.experimentTypes.forEach(cb => {
            if (cb.value === 'single') {
                cb.checked = false;
                console.log('🔧 DEBUG: Adversarial enabled - unchecked single experiment type');
            }
        });
    }
    
    // Auto-toggle all adversarial metrics when adversarial mode is enabled/disabled
    elements.advMetrics.forEach(cb => {
        cb.checked = isChecked;
    });
    console.log("🔧 DEBUG: Auto-toggled adversarial metrics to:", isChecked);
    
    // Only show adversary selection if adversarial is checked AND multiple different models are selected
    const shouldShow = isChecked && selectedModels.length > 1;
    
    console.log("🔧 DEBUG: Should show adversary selection:", shouldShow);
    elements.adversarySelection.style.display = shouldShow ? 'block' : 'none';
    
    // Update adversary dropdown with only selected models
    if (shouldShow) {
        updateAdversaryDropdown(selectedModels);
    }
    
    validateConfiguration();
}

function updateAdversaryDropdown(selectedModels) {
    console.log("🔧 DEBUG: Updating adversary dropdown with models:", selectedModels);
    const adversarySelect = elements.adversaryModel;
    
    // Clear existing options except "Random Selection"
    adversarySelect.innerHTML = '<option value="random">Random Selection</option>';
    
    // Add options for each selected model
    const modelNames = {
        'claude': 'Claude',
        'openai': 'OpenAI GPT', 
        'gemini': 'Google Gemini',
        'together': 'Exaone 3.5',
        'deepseek': 'DeepSeek'
    };
    
    selectedModels.forEach(modelValue => {
        const option = document.createElement('option');
        option.value = modelValue;
        option.textContent = modelNames[modelValue] || modelValue;
        adversarySelect.appendChild(option);
    });
}

function showLoading(text) {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.style.display = 'flex';
    
    // Add 3D loading effect if available
    if (window.ThreeJSEffects && window.ThreeJSEffects.background) {
        window.ThreeJSEffects.createLoadingSpinner();
    }
}

function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
}


// API Key Management Functions
async function saveApiKeys() {
    console.log("🔧 DEBUG: Saving API keys and creating session");
    
    const apiKeys = {
        anthropic_api_key: elements.claudeApiKey.value,
        openai_api_key: elements.openaiApiKey.value,
        google_api_key: elements.geminiApiKey.value,
        together_api_key: elements.togetherApiKey.value
    };
    
    // Filter out empty keys
    const filteredKeys = {};
    Object.entries(apiKeys).forEach(([key, value]) => {
        if (value && value.trim().length > 10) {
            filteredKeys[key] = value.trim();
        }
    });
    
    if (Object.keys(filteredKeys).length === 0) {
        showToast('Please enter at least one valid API key', 'error');
        return;
    }
    
    try {
        // Create session with API keys
        const response = await apiCall('/sessions/create', 'POST', {
            api_keys: filteredKeys,
            session_name: 'Web Interface Session'
        });
        
        if (response && response.session_id) {
            // Store session ID for API key authentication
            localStorage.setItem('api_session_id', response.session_id);
            console.log("✅ DEBUG: Session created with ID:", response.session_id.substring(0, 8) + "...");
            console.log("✅ DEBUG: Available providers:", response.available_providers);
            
            // Save keys to session storage for UI display (cleared when window closes)
            const displayKeys = {
                claude: elements.claudeApiKey.value,
                openai: elements.openaiApiKey.value,
                gemini: elements.geminiApiKey.value,
                together: elements.togetherApiKey.value,
                deepseek: elements.togetherApiKey.value
            };
            sessionStorage.setItem('apiKeys', JSON.stringify(displayKeys));
            
            showToast(`API keys saved successfully. Providers: ${response.available_providers.join(', ')}`, 'success');
        } else {
            showToast('Failed to create session with API keys', 'error');
            console.error("❌ ERROR: Invalid response from session creation:", response);
        }
    } catch (error) {
        showToast('Error saving API keys: ' + error.message, 'error');
        console.error("❌ ERROR: Failed to create session:", error);
    }
}

function clearApiKeys() {
    console.log("🔧 DEBUG: Clearing API keys");
    
    elements.claudeApiKey.value = '';
    elements.openaiApiKey.value = '';
    elements.geminiApiKey.value = '';
    elements.togetherApiKey.value = '';
    
    // Clear from session storage
    sessionStorage.removeItem('apiKeys');
    
    showToast('API keys cleared', 'info');
}

function loadSavedApiKeys() {
    console.log("🔧 DEBUG: Loading saved API keys from session storage");
    
    const savedKeys = sessionStorage.getItem('apiKeys');
    if (savedKeys) {
        const keys = JSON.parse(savedKeys);
        
        elements.claudeApiKey.value = keys.claude || '';
        elements.openaiApiKey.value = keys.openai || '';
        elements.geminiApiKey.value = keys.gemini || '';
        elements.togetherApiKey.value = keys.together || '';
        
        console.log("✅ DEBUG: API keys loaded from session storage");
        
        // Send keys to backend automatically
        saveApiKeys();
    }
}

function togglePasswordVisibility(event) {
    const button = event.target.closest('.toggle-visibility');
    const targetId = button.getAttribute('data-target');
    const input = document.getElementById(targetId);
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

async function testApiKey(event) {
    const button = event.target.closest('.test-key');
    const provider = button.getAttribute('data-provider');
    
    console.log(`🔧 DEBUG: Testing ${provider} API key`);
    
    // Get the API key value
    const keyInput = document.getElementById(`${provider === 'together' ? 'together' : provider}ApiKey`);
    const apiKey = keyInput.value.trim();
    
    if (!apiKey) {
        showToast(`Please enter ${provider} API key first`, 'warning');
        return;
    }
    
    // Update button state
    button.className = 'test-key testing';
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
    
    try {
        const response = await apiCall('/sessions/test-keys', 'POST', {
            [provider + '_api_key']: apiKey
        });
        
        // Backend returns {"test_results": {provider: {valid: boolean, message: string}}}
        if (response && response.test_results && response.test_results[provider]) {
            const result = response.test_results[provider];
            
            if (result.valid) {
                button.className = 'test-key success';
                button.innerHTML = '<i class="fas fa-check"></i> Valid';
                showToast(`${provider} API key is valid`, 'success');
            } else {
                button.className = 'test-key error';
                button.innerHTML = '<i class="fas fa-times"></i> Invalid';
                showToast(`${provider} API key test failed: ${result.message}`, 'error');
            }
            
            setTimeout(() => {
                button.className = 'test-key';
                button.innerHTML = '<i class="fas fa-check"></i> Test';
            }, 3000);
        } else {
            button.className = 'test-key error';
            button.innerHTML = '<i class="fas fa-times"></i> Invalid';
            showToast(`${provider} API key test failed: Invalid response format`, 'error');
            
            setTimeout(() => {
                button.className = 'test-key';
                button.innerHTML = '<i class="fas fa-check"></i> Test';
            }, 3000);
        }
    } catch (error) {
        button.className = 'test-key error';
        button.innerHTML = '<i class="fas fa-times"></i> Error';
        showToast(`Failed to test ${provider} API key`, 'error');
        
        setTimeout(() => {
            button.className = 'test-key';
            button.innerHTML = '<i class="fas fa-check"></i> Test';
        }, 3000);
    }
}

// === QUEUE MANAGEMENT FUNCTIONS ===

// Global queue state
let queueState = {
    templates: [],
    queueStatus: {},
    batches: [],
    activeQueueTab: 'templates',
    queuePollingInterval: null
};

// Initialize queue functionality
function initializeQueue() {
    console.log("🔧 DEBUG: Initializing queue system");
    
    // Add queue tab elements to elements object
    elements.queueTabs = document.querySelectorAll('.queue-tab');
    elements.queueContents = document.querySelectorAll('.queue-content');
    elements.templateGrid = document.getElementById('templateGrid');
    elements.refreshTemplates = document.getElementById('refreshTemplates');
    
    // Queue controls
    elements.startQueue = document.getElementById('startQueue');
    elements.pauseQueue = document.getElementById('pauseQueue');
    elements.stopQueue = document.getElementById('stopQueue');
    
    // Queue stats
    elements.queueTotal = document.getElementById('queueTotal');
    elements.queuePending = document.getElementById('queuePending');
    elements.queueRunning = document.getElementById('queueRunning');
    elements.queueCompleted = document.getElementById('queueCompleted');
    elements.queueFailed = document.getElementById('queueFailed');
    
    // Queue lists
    elements.runningExperiments = document.getElementById('runningExperiments');
    elements.queuedExperiments = document.getElementById('queuedExperiments');
    elements.batchList = document.getElementById('batchList');
    
    // Visualization elements
    elements.visualizationFilesList = document.getElementById('visualizationFilesList');
    elements.visualizationControls = document.getElementById('visualizationControls');
    elements.visualizationDisplay = document.getElementById('visualizationDisplay');
    elements.refreshVisualizationFiles = document.getElementById('refreshVisualizationFiles');
    elements.conditionTypeSelect = document.getElementById('conditionTypeSelect');
    elements.titlePrefixInput = document.getElementById('titlePrefixInput');
    elements.metricsCheckboxes = document.getElementById('metricsCheckboxes');
    elements.createVisualization = document.getElementById('createVisualization');
    elements.autoDetectType = document.getElementById('autoDetectType');
    elements.visualizationTitle = document.getElementById('visualizationTitle');
    elements.visualizationMeta = document.getElementById('visualizationMeta');
    elements.visualizationPlotsContainer = document.getElementById('visualizationPlotsContainer');
    elements.fileSourceTabs = document.querySelectorAll('.file-source-tab');
    
    // Add event listeners
    addQueueEventListeners();
    addVisualizationEventListeners();
    
    // Load initial data
    loadTemplates();
    startQueuePolling();
}

function addQueueEventListeners() {
    // Queue tab switching
    elements.queueTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchQueueTab(e.target.getAttribute('data-queue-tab'));
        });
    });
    
    // Refresh templates
    elements.refreshTemplates.addEventListener('click', loadTemplates);
    
    // Queue controls
    elements.startQueue.addEventListener('click', startQueueProcessing);
    elements.pauseQueue.addEventListener('click', pauseQueueProcessing);
    elements.stopQueue.addEventListener('click', stopQueueProcessing);
}

function restoreQueueState() {
    console.log("🔧 DEBUG: Restoring queue state after page refresh");
    
    // Automatically refresh queue status and templates
    setTimeout(async () => {
        try {
            // Load templates if we're on the templates tab
            if (queueState.activeQueueTab === 'templates' || !queueState.activeQueueTab) {
                await loadTemplates();
            }
            
            // Always update queue status to show current progress
            await updateQueueStatus();
            
            // If there are running or pending experiments, switch to queue-status tab
            const response = await apiCall('/queue/status', 'GET');
            if (response.success && (response.data.running > 0 || response.data.pending > 0)) {
                console.log("🔄 Active queue detected, switching to queue status tab");
                switchQueueTab('queue-status');
                
                // Start polling for queue updates
                if (!queueState.statusPolling) {
                    startQueueStatusPolling();
                }
            }
            
        } catch (error) {
            console.log("⚠️ Could not fully restore queue state:", error.message);
        }
    }, 500); // Small delay to ensure all elements are ready
}

function switchQueueTab(tabName) {
    console.log(`🔧 DEBUG: Switching to queue tab: ${tabName}`);
    
    // Update active tab
    elements.queueTabs.forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-queue-tab') === tabName);
    });
    
    // Update active content
    elements.queueContents.forEach(content => {
        content.classList.toggle('active', content.id === `queue-${tabName}`);
    });
    
    queueState.activeQueueTab = tabName;
    
    // Load content based on tab
    switch (tabName) {
        case 'templates':
            if (queueState.templates.length === 0) {
                loadTemplates();
            }
            break;
        case 'queue-status':
            updateQueueStatus();
            break;
        case 'batches':
            loadBatches();
            break;
    }
}

async function loadTemplates() {
    console.log("🔧 DEBUG: Loading experiment templates");
    
    elements.templateGrid.innerHTML = `
        <div class="loading-template">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading templates...</p>
        </div>
    `;
    
    try {
        // Use local mock templates since backend doesn't have templates endpoint yet
        const mockTemplates = [
            {
                name: "Basic Fake News Analysis",
                description: "Single model analysis for fake news detection",
                experiments: ["single"],
                enabled: true
            },
            {
                name: "Comprehensive AI Detection", 
                description: "Multi-model consensus for AI text detection",
                experiments: ["single", "dual", "consensus"],
                enabled: true
            }
        ];
        
        queueState.templates = mockTemplates;
        displayTemplates(mockTemplates);
        console.log("✅ DEBUG: Using mock templates");
    } catch (error) {
        console.error("❌ ERROR: Failed to load templates:", error);
        elements.templateGrid.innerHTML = `
            <div class="loading-template">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load templates: ${error.message}</p>
                <button class="btn-secondary" onclick="loadTemplates()">Retry</button>
            </div>
        `;
    }
}

function displayTemplates(templates) {
    if (templates.length === 0) {
        elements.templateGrid.innerHTML = `
            <div class="loading-template">
                <i class="fas fa-layer-group"></i>
                <p>No templates available</p>
            </div>
        `;
        return;
    }
    
    const templatesHTML = templates.map(template => {
        const isDisabled = template.version && template.version.includes('disabled');
        const isComingSoon = template.description && template.description.includes('[COMING SOON]');
        
        return `
            <div class="template-card ${isDisabled ? 'template-disabled' : ''}" data-template="${template.name}">
                <div class="template-header">
                    <div class="template-icon">
                        <i class="fas fa-layer-group"></i>
                    </div>
                    <h4 class="template-title">
                        ${template.name}
                        ${isComingSoon ? '<span class="coming-soon-badge">COMING SOON</span>' : ''}
                    </h4>
                </div>
                
                <div class="template-description">
                    ${template.description}
                </div>
                
                <div class="template-actions">
                    ${isDisabled ? `
                        <button class="btn-disabled" disabled>
                            <i class="fas fa-lock"></i> Template Disabled
                        </button>
                        <button class="btn-secondary" onclick="viewTemplateDetails('${template.name}')">
                            <i class="fas fa-info-circle"></i> View Info
                        </button>
                    ` : `
                        <button class="btn-primary" onclick="queueTemplate('${template.name}')">
                            <i class="fas fa-play"></i> Queue Batch
                        </button>
                        <button class="btn-secondary" onclick="viewTemplateDetails('${template.name}')">
                            <i class="fas fa-cog"></i> View Full Config
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
    
    elements.templateGrid.innerHTML = templatesHTML;
}

async function queueTemplate(templateName) {
    console.log(`🔧 DEBUG: Queuing template: ${templateName}`);
    
    // Check if we have necessary queue data (independent of setup)
    if (!queueConfig.dataset_path) {
        showToast('Please upload a queue dataset first', 'warning');
        return;
    }
    
    // Get domain from the queue form (independent of setup)
    const domain = queueConfig.domain;
    if (!domain) {
        showToast('Please select a queue domain first', 'warning');
        return;
    }
    
    console.log('🔧 DEBUG: Using queue config:', queueConfig);
    
    try {
        showLoading(`Queuing batch from template: ${templateName}...`);
        
        const response = await apiCall('/experiments/batch', 'POST', {
            template_name: templateName,
            domain: domain,
            dataset_path: queueConfig.dataset_path, // Use queue config instead of setup config
            custom_config: {
                // Use queue configuration
                num_articles: queueConfig.estimated_articles || 100
            }
        });
        
        hideLoading();
        
        if (response.success) {
            showToast(`Successfully queued ${response.data.total_experiments} experiments!`, 'success');
            
            // Switch to queue status tab to show progress
            switchQueueTab('queue-status');
            updateQueueStatus();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        hideLoading();
        console.error("❌ ERROR: Failed to queue batch:", error);
        showToast(`Failed to queue batch: ${error.message}`, 'error');
    }
}

async function viewTemplateDetails(templateName) {
    console.log(`🔧 DEBUG: Viewing template details: ${templateName}`);
    
    try {
        // Use mock template data since backend doesn't have templates endpoint
        const mockTemplate = {
            name: templateName,
            description: "Sample template configuration",
            experiments: ["single", "dual"],
            config: { domain: "fake_news", models: ["claude", "openai"] }
        };
        
        displayTemplateDetailsModal(mockTemplate);
    } catch (error) {
        console.error("❌ ERROR: Failed to get template details:", error);
        showToast(`Failed to load template details: ${error.message}`, 'error');
    }
}

function displayTemplateDetailsModal(template) {
    // Create a modal to show EXHAUSTIVE template details for research
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const isDisabled = template.version && template.version.includes('disabled');
    const isComingSoon = template.description && template.description.includes('[COMING SOON]');
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; max-height: 90vh;">
            <div class="modal-header">
                <h3><i class="fas fa-microscope"></i> Research Template Configuration</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body" style="overflow-y: auto;">
                <div class="template-config-header">
                    <h2>
                        ${template.name}
                        ${isComingSoon ? '<span class="coming-soon-badge">COMING SOON</span>' : ''}
                    </h2>
                    <p class="template-desc">${template.description}</p>
                    <div class="config-meta">
                        <span class="badge ${isDisabled ? 'badge-disabled' : ''}">Version: ${template.version}</span>
                        <span class="badge">Total Experiments: ${template.experiment_matrix.length}</span>
                        <span class="badge">Est. Duration: ${(template.experiment_matrix.length * 15 / 60).toFixed(1)}h</span>
                        ${isDisabled ? '<span class="badge badge-warning">STATUS: DISABLED</span>' : ''}
                    </div>
                    ${isDisabled && template.base_config.disabled_reason ? `
                        <div class="disabled-notice">
                            <i class="fas fa-info-circle"></i>
                            <strong>Template Status:</strong> ${template.base_config.disabled_reason}
                        </div>
                    ` : ''}
                </div>

                <div class="config-section">
                    <h3><i class="fas fa-cogs"></i> Base Configuration</h3>
                    <div class="config-grid">
                        <div class="config-item">
                            <strong>Model:</strong> ${template.base_config.model} 
                            <span class="config-note">(${template.base_config.model === 'together' ? 'Exaone 3.5 via Together API' : template.base_config.model})</span>
                        </div>
                        <div class="config-item">
                            <strong>Temperature:</strong> ${template.base_config.temperature}
                            <span class="config-note">(Controls randomness: 0.0=deterministic, 1.0=creative)</span>
                        </div>
                        <div class="config-item">
                            <strong>Max Turns:</strong> ${template.base_config.max_turns}
                            <span class="config-note">(Conversation rounds for multi-model experiments)</span>
                        </div>
                        <div class="config-item">
                            <strong>Articles:</strong> ${template.base_config.num_articles || 'All'}
                            <span class="config-note">(Number of articles to process from dataset)</span>
                        </div>
                    </div>
                </div>

                <div class="config-section">
                    <h3><i class="fas fa-chart-line"></i> Standard Metrics</h3>
                    <div class="metrics-list">
                        ${template.base_config.metrics.map(metric => `
                            <div class="metric-item">
                                <strong>${metric}</strong>
                                <span class="metric-desc">${getMetricDescription(metric)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                ${template.base_config.adversarial_metrics ? `
                    <div class="config-section">
                        <h3><i class="fas fa-shield-alt"></i> Adversarial Metrics</h3>
                        <div class="metrics-list">
                            ${template.base_config.adversarial_metrics.map(metric => `
                                <div class="metric-item">
                                    <strong>${metric}</strong>
                                    <span class="metric-desc">${getAdversarialMetricDescription(metric)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="config-section">
                    <h3><i class="fas fa-list-ol"></i> Experiment Matrix (${template.experiment_matrix.length} experiments)</h3>
                    <div class="experiment-matrix">
                        ${template.experiment_matrix.map((exp, i) => `
                            <div class="experiment-detail">
                                <div class="exp-header">
                                    <strong>${i + 1}. ${exp.name_suffix || exp.type}</strong>
                                    <span class="exp-type">${exp.type.toUpperCase()}</span>
                                </div>
                                <div class="exp-details">
                                    <div class="detail-row">
                                        <span class="detail-label">Type:</span>
                                        <span class="detail-value">${exp.type}</span>
                                        <span class="detail-note">${getExperimentTypeDescription(exp.type)}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Models:</span>
                                        <span class="detail-value">${exp.models.length}x ${exp.models[0]}</span>
                                        <span class="detail-note">${exp.models.length === 1 ? 'Single model analysis' : exp.models.length + ' models discussing'}</span>
                                    </div>
                                    ${exp.context_injection_strategy ? `
                                        <div class="detail-row">
                                            <span class="detail-label">Context Injection:</span>
                                            <span class="detail-value">${exp.context_injection_strategy}</span>
                                            <span class="detail-note">${getContextStrategyDescription(exp.context_injection_strategy)}</span>
                                        </div>
                                    ` : ''}
                                    <div class="detail-row">
                                        <span class="detail-label">Adversarial:</span>
                                        <span class="detail-value">${exp.adversarial ? 'YES' : 'NO'}</span>
                                        <span class="detail-note">${exp.adversarial ? 'One model acts as adversary with hidden agenda' : 'All models cooperative'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Est. Duration:</span>
                                        <span class="detail-value">15 min</span>
                                        <span class="detail-note">Per 100 articles</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                ${template.deduplication ? `
                    <div class="config-section">
                        <h3><i class="fas fa-filter"></i> Deduplication Rules</h3>
                        <div class="dedup-info">
                            <div class="dedup-rule">
                                <strong>Single Model Deduplication:</strong> ${template.deduplication.single_model ? 'ENABLED' : 'DISABLED'}
                                <span class="config-note">
                                    ${template.deduplication.single_model ? 
                                        'Single model experiments run only once regardless of how many multi-model experiments are included' : 
                                        'Single model experiments may run multiple times'
                                    }
                                </span>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                ${isDisabled ? `
                    <button class="btn-disabled" disabled>
                        <i class="fas fa-lock"></i> Template Disabled
                    </button>
                ` : `
                    <button class="btn-primary" onclick="queueTemplateFromModal('${template.name}')">
                        <i class="fas fa-play"></i> Queue This Template
                    </button>
                `}
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add close functionality
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Helper functions for research descriptions
function getMetricDescription(metric) {
    const descriptions = {
        'confidence': 'Model confidence score in predictions (0-1)',
        'agreement': 'Inter-model agreement when multiple models used',
        'bias': 'Detected bias in model responses',
        'reliability': 'Consistency of model responses across similar inputs',
        'classification': 'Final classification result (fake/real, human/ai)',
        'manipulative_framing': 'Detection of manipulative language patterns'
    };
    return descriptions[metric] || 'Custom metric';
}

function getAdversarialMetricDescription(metric) {
    const descriptions = {
        'relevant': 'How relevant adversary responses are to the topic',
        'informative': 'Information content of adversarial contributions',
        'influence': 'Degree of influence adversary has on final decision',
        'opinion': 'Opinion strength and persuasiveness of adversary'
    };
    return descriptions[metric] || 'Custom adversarial metric';
}

function getExperimentTypeDescription(type) {
    const descriptions = {
        'single': 'One model analyzes each article independently',
        'dual': 'Two models discuss each article through conversation',
        'consensus': 'Three models discuss until reaching consensus'
    };
    return descriptions[type] || 'Custom experiment type';
}

function getContextStrategyDescription(strategy) {
    const descriptions = {
        'first_turn_only': 'Context injected only in first conversation turn',
        'all_turns': 'Context injected in every conversation turn',
        'first_and_last_turn': 'Context injected in first and final turns only'
    };
    return descriptions[strategy] || 'Custom context strategy';
}

function queueTemplateFromModal(templateName) {
    // Close modal first
    document.querySelector('.modal-overlay').remove();
    // Queue the template
    queueTemplate(templateName);
}

// Queue status and management
async function updateQueueStatus() {
    console.log("🔧 DEBUG: Updating queue status");
    
    try {
        const response = await apiCall('/queue/status', 'GET');
        
        // Backend returns queue status directly, not wrapped in success/data
        if (response && response.queue_status !== undefined) {
            displayQueueStatus(response);
        } else {
            console.error("❌ ERROR: Invalid queue status response:", response);
        }
    } catch (error) {
        console.error("❌ ERROR: Failed to update queue status:", error);
    }
}

function displayQueueStatus(status) {
    // Update stats
    elements.queueTotal.textContent = status.total_experiments;
    elements.queuePending.textContent = status.pending;
    elements.queueRunning.textContent = status.running;
    elements.queueCompleted.textContent = status.completed;
    elements.queueFailed.textContent = status.failed;
    
    // Update running experiments
    if (status.running_experiments && status.running_experiments.length > 0) {
        const runningHTML = status.running_experiments.map(exp => `
            <div class="experiment-item">
                <div class="experiment-info">
                    <div class="experiment-name">${exp.name}</div>
                    <div class="experiment-meta">
                        Started: ${formatDate(exp.started_at)} | Progress: ${exp.progress}%
                    </div>
                </div>
                <div class="experiment-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${exp.progress}%"></div>
                    </div>
                    <div class="progress-text">${exp.progress}%</div>
                </div>
            </div>
        `).join('');
        
        elements.runningExperiments.innerHTML = runningHTML;
    } else {
        elements.runningExperiments.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-play-circle"></i>
                <p>No experiments currently running</p>
            </div>
        `;
    }
    
    // Update queued experiments
    if (status.next_up && status.next_up.length > 0) {
        const queuedHTML = status.next_up.map(exp => `
            <div class="experiment-item">
                <div class="experiment-info">
                    <div class="experiment-name">${exp.name}</div>
                    <div class="experiment-meta">
                        Priority: ${exp.priority} | Est. ${exp.estimated_duration_minutes}min
                    </div>
                </div>
                <div class="experiment-progress">
                    <button class="btn-danger btn-sm" onclick="cancelExperiment('${exp.id}')">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        `).join('');
        
        elements.queuedExperiments.innerHTML = queuedHTML;
    } else {
        elements.queuedExperiments.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-list-ol"></i>
                <p>No experiments queued</p>
            </div>
        `;
    }
}

// Queue control functions
async function startQueueProcessing() {
    console.log("🔧 DEBUG: Starting queue processing");
    
    try {
        const response = await apiCall('/queue/start', 'POST');
        
        if (response.success) {
            showToast('Queue started successfully', 'success');
            updateQueueStatus();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        console.error("❌ ERROR: Failed to start queue:", error);
        showToast(`Failed to start queue: ${error.message}`, 'error');
    }
}

async function pauseQueueProcessing() {
    console.log("🔧 DEBUG: Pausing queue processing");
    
    try {
        const response = await apiCall('/queue/pause', 'POST');
        
        if (response.success) {
            showToast('Queue paused successfully', 'info');
            updateQueueStatus();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        console.error("❌ ERROR: Failed to pause queue:", error);
        showToast(`Failed to pause queue: ${error.message}`, 'error');
    }
}

async function stopQueueProcessing() {
    console.log("🔧 DEBUG: Stopping queue processing");
    
    try {
        const response = await apiCall('/queue/stop', 'POST');
        
        if (response.success) {
            showToast('Queue stopped successfully', 'warning');
            updateQueueStatus();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        console.error("❌ ERROR: Failed to stop queue:", error);
        showToast(`Failed to stop queue: ${error.message}`, 'error');
    }
}

async function cancelExperiment(experimentId) {
    console.log(`🔧 DEBUG: Cancelling experiment: ${experimentId}`);
    
    try {
        const response = await apiCall(`/experiments/${experimentId}`, 'DELETE');
        
        if (response.success) {
            showToast('Experiment cancelled successfully', 'info');
            updateQueueStatus();
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        console.error("❌ ERROR: Failed to cancel experiment:", error);
        showToast(`Failed to cancel experiment: ${error.message}`, 'error');
    }
}

// Batch management
async function loadBatches() {
    console.log("🔧 DEBUG: Loading batch history");
    
    try {
        const response = await apiCall('/queue/batches', 'GET');
        
        if (response.success) {
            displayBatches(response.data);
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        console.error("❌ ERROR: Failed to load batches:", error);
        elements.batchList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load batches: ${error.message}</p>
            </div>
        `;
    }
}

function displayBatches(batches) {
    if (batches.length === 0) {
        elements.batchList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>No batches found</p>
            </div>
        `;
        return;
    }
    
    const batchesHTML = batches.map(batch => `
        <div class="batch-item">
            <div class="batch-header">
                <h4 class="batch-title">${batch.name}</h4>
                <span class="batch-status ${batch.status}">${batch.status}</span>
            </div>
            
            <div class="batch-meta">
                <div class="batch-meta-item">
                    <i class="fas fa-calendar"></i>
                    Created: ${formatDate(batch.created_at)}
                </div>
                <div class="batch-meta-item">
                    <i class="fas fa-flask"></i>
                    ${batch.completed_experiments}/${batch.total_experiments} completed
                </div>
                <div class="batch-meta-item">
                    <i class="fas fa-chart-pie"></i>
                    ${Math.round(batch.progress * 100)}% progress
                </div>
                ${batch.template_name ? `
                    <div class="batch-meta-item">
                        <i class="fas fa-layer-group"></i>
                        Template: ${batch.template_name}
                    </div>
                ` : ''}
            </div>
            
            <div class="batch-actions">
                <button class="btn-secondary" onclick="viewBatchDetails('${batch.id}')">
                    <i class="fas fa-eye"></i> View Details
                </button>
                ${batch.status === 'running' || batch.status === 'pending' ? `
                    <button class="btn-danger" onclick="cancelBatch('${batch.id}')">
                        <i class="fas fa-stop"></i> Cancel Batch
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    elements.batchList.innerHTML = batchesHTML;
}

async function viewBatchDetails(batchId) {
    console.log(`🔧 DEBUG: Viewing batch details: ${batchId}`);
    
    try {
        const response = await apiCall(`/queue/batches/${batchId}`, 'GET');
        
        if (response.success) {
            displayBatchDetailsModal(response.data);
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        console.error("❌ ERROR: Failed to get batch details:", error);
        showToast(`Failed to load batch details: ${error.message}`, 'error');
    }
}

function displayBatchDetailsModal(batch) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-folder-open"></i> ${batch.name}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p><strong>Description:</strong> ${batch.description}</p>
                <p><strong>Status:</strong> <span class="batch-status ${batch.status}">${batch.status}</span></p>
                <p><strong>Progress:</strong> ${batch.completed_experiments}/${batch.total_experiments} (${Math.round(batch.progress * 100)}%)</p>
                <p><strong>Created:</strong> ${formatDate(batch.created_at)}</p>
                
                <h4>Experiments:</h4>
                <div class="experiment-list" style="max-height: 400px; overflow-y: auto;">
                    ${batch.experiments.map((exp, i) => `
                        <div class="experiment-item">
                            <div class="experiment-info">
                                <div class="experiment-name">${exp.name}</div>
                                <div class="experiment-meta">
                                    Status: <span class="batch-status ${exp.status}">${exp.status}</span> | 
                                    Progress: ${exp.progress}%
                                    ${exp.started_at ? ` | Started: ${formatDate(exp.started_at)}` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add close functionality
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

async function cancelBatch(batchId) {
    console.log(`🔧 DEBUG: Cancelling batch: ${batchId}`);
    
    if (!confirm('Are you sure you want to cancel this entire batch? This will stop all pending experiments in the batch.')) {
        return;
    }
    
    try {
        const response = await apiCall(`/queue/batches/${batchId}`, 'DELETE');
        
        if (response.success) {
            showToast('Batch cancelled successfully', 'info');
            loadBatches(); // Refresh the batch list
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        console.error("❌ ERROR: Failed to cancel batch:", error);
        showToast(`Failed to cancel batch: ${error.message}`, 'error');
    }
}

// Queue polling
function startQueuePolling() {
    // Stop existing polling
    if (queueState.queuePollingInterval) {
        clearInterval(queueState.queuePollingInterval);
    }
    
    // Start polling every 10 seconds if we're on the queue tab
    queueState.queuePollingInterval = setInterval(() => {
        const currentSection = document.querySelector('.section.active').id;
        if (currentSection === 'queue' && queueState.activeQueueTab === 'queue-status') {
            updateQueueStatus();
        }
    }, 10000);
}

// === COLLAPSIBLE PANEL FUNCTIONS ===

function togglePanel(panelId) {
    console.log(`🔧 DEBUG: Toggling panel: ${panelId}`);
    
    const content = document.getElementById(`${panelId}-content`);
    const toggleIcon = document.getElementById(`${panelId}-toggle`);
    
    if (!content || !toggleIcon) {
        console.error(`❌ ERROR: Panel elements not found for ${panelId}`);
        return;
    }
    
    const isCollapsed = content.classList.contains('collapsed');
    
    if (isCollapsed) {
        // Expand the panel
        content.classList.remove('collapsed');
        content.classList.add('expanded');
        toggleIcon.classList.add('rotated');
        console.log(`✅ DEBUG: Expanded panel: ${panelId}`);
    } else {
        // Collapse the panel
        content.classList.remove('expanded');
        content.classList.add('collapsed');
        toggleIcon.classList.remove('rotated');
        console.log(`✅ DEBUG: Collapsed panel: ${panelId}`);
    }
}

// =============== VISUALIZATION SYSTEM ===============

let selectedVisualizationFile = null;
let availableVisualizationFiles = [];
let currentFileSource = 'all';

function addVisualizationEventListeners() {
    // File source tabs
    elements.fileSourceTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            elements.fileSourceTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFileSource = this.getAttribute('data-source');
            filterVisualizationFiles();
        });
    });
    
    // Refresh files
    if (elements.refreshVisualizationFiles) {
        elements.refreshVisualizationFiles.addEventListener('click', loadVisualizationFiles);
    }
    
    // Auto-detect condition type
    if (elements.autoDetectType) {
        elements.autoDetectType.addEventListener('click', autoDetectConditionType);
    }
    
    // Create visualization
    if (elements.createVisualization) {
        elements.createVisualization.addEventListener('click', createVisualization);
    }
}


async function loadVisualizationFiles() {
    console.log('🔧 DEBUG: Loading visualization files...');
    
    try {
        showLoading('Loading available files...');
        const response = await apiCall('/visualizations/available-files', 'GET');
        hideLoading();
        
        if (response.success) {
            availableVisualizationFiles = response.data.files;
            console.log(`📁 Loaded ${availableVisualizationFiles.length} files`);
            filterVisualizationFiles();
        } else {
            showToast(`Failed to load files: ${response.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('❌ Failed to load visualization files:', error);
        showToast('Failed to load files', 'error');
    }
}

function filterVisualizationFiles() {
    let filteredFiles = availableVisualizationFiles;
    
    if (currentFileSource !== 'all') {
        filteredFiles = availableVisualizationFiles.filter(file => file.source === currentFileSource);
    }
    
    displayVisualizationFiles(filteredFiles);
}


function displayVisualizationFiles(files) {
    const container = elements.visualizationFilesList;
    
    if (files.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-csv"></i>
                <p>No ${currentFileSource === 'all' ? '' : currentFileSource + ' '}files found</p>
                <small>Run some experiments to generate result files</small>
            </div>
        `;
        return;
    }
    
    const fileItems = files.map(file => {
        const isSelected = selectedVisualizationFile?.file_path === file.file_path;
        const sourceIcon = file.source === 'batch' ? 'layer-group' : 'flask';
        const sizeText = file.size_mb > 0 ? `${file.size_mb} MB` : '< 0.1 MB';
        
        return `
            <div class="file-item ${isSelected ? 'selected' : ''}" 
                 data-file-path="${file.file_path}"
                 data-file-name="${file.file_name}"
                 data-source="${file.source}">
                <div class="file-info">
                    <div class="file-header">
                        <i class="fas fa-${sourceIcon}"></i>
                        <span class="file-name">${file.file_name}</span>
                        <span class="file-size">${sizeText}</span>
                    </div>
                    <div class="file-meta">
                        <span class="file-source">${file.source}</span>
                        ${file.domain ? `<span class="file-domain">${file.domain}</span>` : ''}
                        ${file.batch_id ? `<span class="file-batch">${file.batch_id}</span>` : ''}
                    </div>
                </div>
                <button class="select-file-btn ${isSelected ? 'selected' : ''}">
                    ${isSelected ? '<i class="fas fa-check"></i> Selected' : '<i class="fas fa-mouse-pointer"></i> Select'}
                </button>
            </div>
        `;
    }).join('');
    
    container.innerHTML = fileItems;
    
    // Add click handlers
    container.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', function() {
            selectVisualizationFile({
                file_path: this.dataset.filePath,
                file_name: this.dataset.fileName,
                source: this.dataset.source
            });
        });
    });
}

function selectVisualizationFile(file) {
    selectedVisualizationFile = file;
    console.log('📁 Selected file:', file.file_name);
    
    // Update UI
    displayVisualizationFiles(availableVisualizationFiles.filter(f => 
        currentFileSource === 'all' || f.source === currentFileSource
    ));
    
    // Show controls
    elements.visualizationControls.style.display = 'block';
    elements.visualizationDisplay.style.display = 'none';
    
    showToast(`Selected: ${file.file_name}`, 'success');
}

async function autoDetectConditionType() {
    if (!selectedVisualizationFile) {
        showToast('Please select a file first', 'warning');
        return;
    }
    
    try {
        showLoading('Auto-detecting condition type...');
        const response = await apiCall('/visualizations/auto-detect-type', 'POST', {
            file_path: selectedVisualizationFile.file_path
        });
        hideLoading();
        
        if (response.success) {
            const data = response.data;
            elements.conditionTypeSelect.value = data.condition_type;
            
            // Update available metrics
            updateMetricsCheckboxes(data.available_metrics);
            
            showToast(`Detected: ${data.condition_type} condition`, 'success');
        } else {
            showToast(`Auto-detection failed: ${response.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('❌ Auto-detection failed:', error);
        showToast('Auto-detection failed', 'error');
    }
}

function updateMetricsCheckboxes(availableMetrics) {
    const allMetrics = [
        'confidence', 'bias', 'reliability', 'manipulative_framing', 'classification',
        'relevant', 'informative', 'influence_score', 'overall_opinion', 'overall_agreement'
    ];
    
    const checkboxesHtml = allMetrics.map(metric => {
        const isAvailable = availableMetrics.includes(metric);
        const displayName = metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        return `
            <div class="metric-checkbox ${isAvailable ? '' : 'disabled'}">
                <input type="checkbox" 
                       id="metric_${metric}" 
                       name="metrics" 
                       value="${metric}"
                       ${isAvailable ? '' : 'disabled'}>
                <label for="metric_${metric}">
                    ${displayName}
                    ${isAvailable ? '' : ' <small>(not available)</small>'}
                </label>
            </div>
        `;
    }).join('');
    
    elements.metricsCheckboxes.innerHTML = checkboxesHtml;
}

async function createVisualization() {
    if (!selectedVisualizationFile) {
        showToast('Please select a file first', 'warning');
        return;
    }
    
    // Get selected metrics
    const selectedMetrics = Array.from(elements.metricsCheckboxes.querySelectorAll('input[name="metrics"]:checked'))
        .map(input => input.value);
    
    const requestData = {
        file_path: selectedVisualizationFile.file_path,
        condition_type: elements.conditionTypeSelect.value || null,
        title_prefix: elements.titlePrefixInput.value || null,
        metrics: selectedMetrics.length > 0 ? selectedMetrics : null
    };
    
    try {
        showLoading('Creating publication-quality visualizations...');
        const response = await apiCall('/visualizations/create', 'POST', requestData);
        hideLoading();
        
        if (response.success) {
            displayVisualizationResults(response.data);
            showToast('Visualizations created successfully!', 'success');
        } else {
            showToast(`Visualization failed: ${response.error}`, 'error');
            console.error('❌ Visualization error:', response.error);
        }
    } catch (error) {
        hideLoading();
        console.error('❌ Visualization failed:', error);
        showToast('Visualization creation failed', 'error');
    }
}

function displayVisualizationResults(data) {
    // Update title and metadata
    const conditionType = data.condition_type.charAt(0).toUpperCase() + data.condition_type.slice(1);
    elements.visualizationTitle.textContent = `${conditionType} Model Analysis - ${data.file_name}`;
    
    // Display metadata
    const metaHtml = `
        <div class="vis-meta-grid">
            <div class="meta-item">
                <strong>Condition Type:</strong> ${conditionType}
            </div>
            <div class="meta-item">
                <strong>File:</strong> ${data.file_name}
            </div>
            <div class="meta-item">
                <strong>Total Rows:</strong> ${data.data_summary.total_rows.toLocaleString()}
            </div>
            <div class="meta-item">
                <strong>Processed Rows:</strong> ${data.data_summary.processed_rows.toLocaleString()}
            </div>
            ${data.data_summary.article_distribution ? `
                <div class="meta-item">
                    <strong>Article Distribution:</strong> 
                    ${Object.entries(data.data_summary.article_distribution)
                        .map(([type, count]) => `${type}: ${count}`)
                        .join(', ')}
                </div>
            ` : ''}
            ${data.data_summary.temperature_stats ? `
                <div class="meta-item">
                    <strong>Temperature:</strong> 
                    ${data.data_summary.temperature_stats.mean.toFixed(2)} 
                    (${data.data_summary.temperature_stats.min}-${data.data_summary.temperature_stats.max})
                </div>
            ` : ''}
        </div>
    `;
    elements.visualizationMeta.innerHTML = metaHtml;
    
    // Display plots
    const plotsHtml = Object.entries(data.plots).map(([metric, base64Data]) => {
        const metricName = metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `
            <div class="vis-plot-container">
                <h4 class="plot-title">${metricName}</h4>
                <div class="plot-image">
                    <img src="data:image/png;base64,${base64Data}" 
                         alt="${metricName} visualization"
                         style="width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                </div>
                <div class="plot-actions">
                    <button onclick="downloadPlot('${base64Data}', '${metric}_${data.condition_type}.png')" 
                            class="btn-secondary btn-small">
                        <i class="fas fa-download"></i> Download PNG
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    elements.visualizationPlotsContainer.innerHTML = plotsHtml;
    
    // Show results
    elements.visualizationDisplay.style.display = 'block';
    
    // Scroll to results
    elements.visualizationDisplay.scrollIntoView({ behavior: 'smooth' });
}

function downloadPlot(base64Data, filename) {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Data}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Downloaded: ${filename}`, 'success');
}

// Initialize visualization system when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Load files when visualizations section is first accessed
    const visualizationsNavBtn = document.querySelector('[data-section="visualizations"]');
    if (visualizationsNavBtn) {
        visualizationsNavBtn.addEventListener('click', function() {
            if (availableVisualizationFiles.length === 0) {
                loadVisualizationFiles();
            }
        });
    }
});