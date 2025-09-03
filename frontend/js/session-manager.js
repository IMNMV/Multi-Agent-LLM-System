// session-manager.js
/**
 * Secure session manager for user-provided API keys
 */

class SessionManager {
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
        this.currentSession = null;
        this.sessionCheckInterval = null;
        
        // Initialize session from localStorage if available
        this.loadSessionFromStorage();
        
        // Start session monitoring
        this.startSessionMonitoring();
        
        // Clear session on page refresh/close
        window.addEventListener('beforeunload', () => {
            this.clearSession();
        });
    }

    /**
     * Sanitize user input to prevent XSS
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        
        return input
            .replace(/[<>&"']/g, '') // Remove dangerous characters
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim()
            .substring(0, 200); // Limit length
    }

    /**
     * Validate API key format
     */
    validateApiKey(key, provider) {
        if (!key || typeof key !== 'string') return false;
        
        const sanitized = this.sanitizeInput(key);
        if (sanitized.length < 10) return false;
        
        // Basic format validation
        const patterns = {
            claude: /^sk-ant-[a-zA-Z0-9\-_]+$/,
            openai: /^sk-[a-zA-Z0-9\-_]+$/,
            google: /^[a-zA-Z0-9\-_]+$/,
            together: /^[a-fA-F0-9\-_]+$/
        };
        
        const pattern = patterns[provider];
        return pattern ? pattern.test(sanitized) : sanitized.length >= 10;
    }

    /**
     * Create new session with API keys
     */
    async createSession(apiKeys, sessionName = null) {
        try {
            // Sanitize inputs
            const sanitizedKeys = {};
            const sanitizedName = sessionName ? this.sanitizeInput(sessionName) : null;
            
            // Validate and sanitize API keys
            for (const [provider, key] of Object.entries(apiKeys)) {
                if (key && this.validateApiKey(key, provider)) {
                    sanitizedKeys[`${provider}_api_key`] = this.sanitizeInput(key);
                }
            }
            
            if (Object.keys(sanitizedKeys).length === 0) {
                throw new Error('At least one valid API key is required');
            }
            
            const response = await fetch(`${this.apiBaseUrl}/sessions/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_keys: sanitizedKeys,
                    session_name: sanitizedName
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to create session');
            }
            
            const sessionInfo = await response.json();
            this.currentSession = sessionInfo;
            
            // Store session info (without API keys) in localStorage
            this.saveSessionToStorage();
            
            console.log('✅ Session created successfully');
            console.log(`📋 Available providers: ${sessionInfo.available_providers.join(', ')}`);
            
            return sessionInfo;
            
        } catch (error) {
            console.error('❌ Failed to create session:', error.message);
            throw error;
        }
    }

    /**
     * Get current session info
     */
    async getSessionInfo() {
        if (!this.currentSession) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/sessions/${this.currentSession.session_id}/info`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    this.clearSession();
                    return null;
                }
                throw new Error('Failed to get session info');
            }
            
            const sessionInfo = await response.json();
            this.currentSession = sessionInfo;
            this.saveSessionToStorage();
            
            return sessionInfo;
            
        } catch (error) {
            console.error('Error getting session info:', error);
            this.clearSession();
            return null;
        }
    }

    /**
     * Extend session expiry
     */
    async extendSession(minutes = 60) {
        if (!this.currentSession) {
            throw new Error('No active session');
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/sessions/${this.currentSession.session_id}/extend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ minutes: Math.min(Math.max(minutes, 1), 240) })
            });
            
            if (!response.ok) {
                throw new Error('Failed to extend session');
            }
            
            console.log(`✅ Session extended by ${minutes} minutes`);
            
            // Refresh session info
            await this.getSessionInfo();
            
        } catch (error) {
            console.error('❌ Failed to extend session:', error);
            throw error;
        }
    }

    /**
     * Delete current session
     */
    async deleteSession() {
        if (!this.currentSession) {
            return;
        }

        try {
            await fetch(`${this.apiBaseUrl}/sessions/${this.currentSession.session_id}`, {
                method: 'DELETE'
            });
            
            console.log('🗑️ Session deleted');
            
        } catch (error) {
            console.warn('Error deleting session:', error);
        } finally {
            this.clearSession();
        }
    }

    /**
     * Clear session from memory and storage
     */
    clearSession() {
        this.currentSession = null;
        localStorage.removeItem('multiagent_session');
        
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
            this.sessionCheckInterval = null;
        }
    }

    /**
     * Save session info to localStorage (without API keys)
     */
    saveSessionToStorage() {
        if (this.currentSession) {
            localStorage.setItem('multiagent_session', JSON.stringify({
                session_id: this.currentSession.session_id,
                session_name: this.currentSession.session_name,
                created_at: this.currentSession.created_at,
                expires_at: this.currentSession.expires_at,
                available_providers: this.currentSession.available_providers
            }));
        }
    }

    /**
     * Load session info from localStorage
     */
    loadSessionFromStorage() {
        try {
            const stored = localStorage.getItem('multiagent_session');
            if (stored) {
                const sessionInfo = JSON.parse(stored);
                
                // Check if session is expired
                if (new Date(sessionInfo.expires_at) > new Date()) {
                    this.currentSession = sessionInfo;
                    console.log('📋 Restored session from storage');
                } else {
                    localStorage.removeItem('multiagent_session');
                    console.log('🕐 Stored session was expired');
                }
            }
        } catch (error) {
            console.warn('Error loading session from storage:', error);
            localStorage.removeItem('multiagent_session');
        }
    }

    /**
     * Start monitoring session status
     */
    startSessionMonitoring() {
        // Check session status every 5 minutes
        this.sessionCheckInterval = setInterval(async () => {
            if (this.currentSession) {
                const sessionInfo = await this.getSessionInfo();
                if (!sessionInfo) {
                    console.log('🕐 Session expired');
                    this.onSessionExpired();
                }
            }
        }, 300000); // 5 minutes
    }

    /**
     * Handle session expiry
     */
    onSessionExpired() {
        this.clearSession();
        
        // Show notification to user
        if (window.app && typeof window.app.showNotification === 'function') {
            window.app.showNotification('Session expired. API keys have been cleared from memory.', 'warning');
        }
        
        // Refresh UI
        if (window.app && typeof window.app.updateSessionStatus === 'function') {
            window.app.updateSessionStatus();
        }
    }

    /**
     * Get session ID for API requests
     */
    getSessionId() {
        return this.currentSession ? this.currentSession.session_id : null;
    }

    /**
     * Check if session is active
     */
    hasActiveSession() {
        return this.currentSession !== null;
    }

    /**
     * Get available AI providers
     */
    getAvailableProviders() {
        return this.currentSession ? this.currentSession.available_providers : [];
    }
}