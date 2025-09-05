// Multi-Agent Experiment System Frontend Application
console.log('🚀 App.js loaded successfully');
console.log('THREE library available:', typeof THREE !== 'undefined');

class MultiAgentApp {
    constructor() {
        this.apiBaseUrl = 'https://multi-agent-llm-system-production.up.railway.app/api'; // Update with your Railway URL
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.init();
    }

    init() {
        this.setupThreeJS();
        this.setupEventListeners();
        this.loadInitialData();
    }

    setupThreeJS() {
        console.log('🎨 Setting up Three.js...');
        
        if (typeof THREE === 'undefined') {
            console.error('❌ THREE.js library not loaded!');
            return;
        }
        
        const container = document.getElementById('visualization-container');
        if (!container) {
            console.error('❌ Visualization container not found!');
            return;
        }
        
        try {
            // Scene setup
            this.scene = new THREE.Scene();
            console.log('✅ Three.js scene created');
        this.scene.background = new THREE.Color(0x0a0a0a);
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.z = 5;
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);
        
        // Add some basic geometry for testing
        this.addTestGeometry();
        
        // Start render loop
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        console.log('✅ Three.js setup completed successfully');
        } catch (error) {
            console.error('❌ Error setting up Three.js:', error);
            // Show fallback message in the container
            container.innerHTML = '<div style="color: white; padding: 20px; text-align: center;">3D Visualization temporarily unavailable</div>';
        }
    }

    addTestGeometry() {
        // Create a simple sphere to test Three.js
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00d4ff,
            wireframe: true 
        });
        const sphere = new THREE.Mesh(geometry, material);
        this.scene.add(sphere);
        
        // Add some lighting
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 5, 5);
        this.scene.add(light);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Rotate the test sphere
        if (this.scene.children[0]) {
            this.scene.children[0].rotation.x += 0.01;
            this.scene.children[0].rotation.y += 0.01;
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const container = document.getElementById('visualization-container');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    setupEventListeners() {
        // Add event listeners for UI controls
        console.log('Setting up event listeners...');
        
        // Refresh experiments list every 5 seconds
        setInterval(() => this.loadExperiments(), 5000);
    }

    async loadInitialData() {
        try {
            // Test API connection
            const response = await fetch(`${this.apiBaseUrl}/health`);
            if (response.ok) {
                console.log('✅ Connected to backend API');
                this.loadExperiments();
            } else {
                console.warn('⚠️ Backend API not available');
                this.showMockData();
            }
        } catch (error) {
            console.warn('⚠️ Could not connect to backend API:', error.message);
            console.log('Running in development mode with mock data');
            this.showMockData();
        }
    }

    async loadExperiments() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/experiments/`);
            if (response.ok) {
                const data = await response.json();
                this.displayExperiments(data.experiments);
            }
        } catch (error) {
            console.warn('Error loading experiments:', error);
        }
    }

    displayExperiments(experiments) {
        const container = document.getElementById('experiment-list');
        
        if (!experiments || experiments.length === 0) {
            container.innerHTML = '<p>No experiments found. Start an experiment to see results here.</p>';
            return;
        }

        const html = experiments.map(exp => `
            <div class="experiment-item" data-status="${exp.status}">
                <div class="experiment-header">
                    <h4>${exp.name}</h4>
                    <span class="status-badge status-${exp.status}">${exp.status}</span>
                </div>
                <div class="experiment-details">
                    <p><strong>Type:</strong> ${exp.experiment_type}</p>
                    <p><strong>Domain:</strong> ${exp.domain}</p>
                    <p><strong>Progress:</strong> ${exp.progress || 0}%</p>
                    <p><strong>Created:</strong> ${new Date(exp.created_at).toLocaleString()}</p>
                </div>
                ${exp.status === 'completed' ? `
                    <div class="download-buttons">
                        <button onclick="app.downloadExperiment('${exp.id}', 'csv')" class="download-btn csv-btn">
                            📊 Download CSV
                        </button>
                        <button onclick="app.downloadExperiment('${exp.id}', 'json')" class="download-btn json-btn">
                            📄 Download JSON
                        </button>
                        <button onclick="app.downloadExperimentFiles('${exp.id}')" class="download-btn zip-btn">
                            📦 Download All Files
                        </button>
                        <button onclick="app.previewExperiment('${exp.id}')" class="download-btn preview-btn">
                            👁️ Preview
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');

        container.innerHTML = html;
    }
    
    // CLIENT-SIDE CSV CONVERSION UTILITIES
    convertJsonToCsv(data) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return 'No data available';
        }
        
        // Get all unique keys from all objects
        const keys = new Set();
        data.forEach(row => {
            Object.keys(row).forEach(key => keys.add(key));
        });
        
        const headers = Array.from(keys);
        
        // Create CSV header row
        let csv = headers.map(h => `"${h}"`).join(',') + '\n';
        
        // Create data rows
        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) return '""';
                
                // Escape quotes and wrap in quotes
                const stringValue = String(value).replace(/"/g, '""');
                return `"${stringValue}"`;
            });
            csv += values.join(',') + '\n';
        });
        
        return csv;
    }
    
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`✅ Downloaded: ${filename}`);
        } else {
            console.error('Download not supported in this browser');
            alert('Download not supported in this browser');
        }
    }

    async downloadExperiment(experimentId, format) {
        try {
            console.log(`📋 Starting ${format} download for experiment ${experimentId}...`);
            
            // Get results from in-memory storage
            const response = await fetch(`${this.apiBaseUrl}/downloads/experiments/${experimentId}/results`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success || !data.data || !data.data.results) {
                throw new Error('No results data available for download');
            }
            
            const { results, name, experiment_id, completed_at } = data.data;
            const timestamp = completed_at ? new Date(completed_at).toISOString().split('T')[0] : 'unknown';
            
            if (format === 'csv') {
                // Convert JSON to CSV and download
                const csvContent = this.convertJsonToCsv(results);
                const filename = `${name || 'experiment'}_${experiment_id}_${timestamp}.csv`;
                this.downloadFile(csvContent, filename, 'text/csv');
                
            } else if (format === 'json') {
                // Download as JSON
                const filename = `${name || 'experiment'}_${experiment_id}_${timestamp}.json`;
                const jsonContent = JSON.stringify({
                    experiment_id,
                    name,
                    completed_at,
                    total_results: results.length,
                    results: results,
                    metadata: data.data.metadata,
                    metrics: data.data.metrics
                }, null, 2);
                this.downloadFile(jsonContent, filename, 'application/json');
            }
            
            console.log(`✅ Downloaded ${format.toUpperCase()} for experiment ${experimentId}`);
        } catch (error) {
            console.error('Download failed:', error);
            alert(`Download failed: ${error.message}`);
        }
    }

    async downloadExperimentFiles(experimentId) {
        try {
            const downloadUrl = `${this.apiBaseUrl}/downloads/experiments/${experimentId}/files`;
            
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `experiment_${experimentId}_complete.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`✅ Started ZIP download for experiment ${experimentId}`);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Download failed. Please try again.');
        }
    }

    async previewExperiment(experimentId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/downloads/experiments/${experimentId}/preview`);
            if (response.ok) {
                const data = await response.json();
                this.showPreviewModal(data);
            } else {
                alert('Preview not available for this experiment.');
            }
        } catch (error) {
            console.error('Preview failed:', error);
            alert('Preview failed. Please try again.');
        }
    }

    showPreviewModal(previewData) {
        const modal = document.createElement('div');
        modal.className = 'preview-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Experiment Preview: ${previewData.file_path}</h3>
                    <button onclick="this.closest('.preview-modal').remove()" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <p><strong>Lines shown:</strong> ${previewData.total_lines}</p>
                    <pre class="preview-content">${previewData.preview.join('\n')}</pre>
                    <p><em>This is a preview of the first few lines. Download the full file to see all results.</em></p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    showMockData() {
        // Show some mock experiments for development
        const mockExperiments = [
            {
                id: 'mock-1',
                name: 'Sample Fake News Detection',
                status: 'completed',
                experiment_type: 'dual',
                domain: 'fake_news',
                progress: 100,
                created_at: new Date().toISOString()
            },
            {
                id: 'mock-2', 
                name: 'AI Text Detection Test',
                status: 'running',
                experiment_type: 'consensus',
                domain: 'ai_text_detection',
                progress: 45,
                created_at: new Date(Date.now() - 300000).toISOString()
            }
        ];
        
        this.displayExperiments(mockExperiments);
    }
}

// Global app instance
let app;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new MultiAgentApp();
});
