/**
 * Frontend Configuration
 * Centralized configuration for the SuperDashboard frontend
 */

// Detect if running in devcontainer
const isDevContainer = import.meta.env.VITE_DEVCONTAINER === 'true';

// Determine backend port based on environment
const backendPort = isDevContainer ? 18010 : 8000;

// Get API base URL from environment variable or construct from port
const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://localhost:${backendPort}`;

/**
 * Configuration object
 */
const config = {
  // API Configuration
  apiBaseUrl: API_BASE,

  // Environment
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  isDevContainer,

  // Feature Flags (can be extended)
  features: {
    commandPalette: true,
    pluginRegistry: true,
  }
};

export default config;

// Named exports for convenience
export const { apiBaseUrl } = config;
export { API_BASE }; // For backwards compatibility
