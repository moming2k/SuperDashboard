/**
 * Plugin Config Re-export
 * This file allows plugins to import config using relative paths
 * e.g., import { API_BASE } from '../../config';
 */

// Re-export everything from the main frontend config
export { default, apiBaseUrl, API_BASE } from '../frontend/src/config.js';
