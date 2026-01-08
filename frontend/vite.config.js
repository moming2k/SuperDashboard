import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Detect if running in devcontainer by checking workspace path or environment variable
const isDevContainer = process.env.DEVCONTAINER === 'true' || process.cwd().startsWith('/workspace');

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@/config': '/src/config.js',
      '@': '/src',
    },
  },
  server: {
    host: '0.0.0.0',
    port: isDevContainer ? 15173 : 5173,
    fs: {
      // Allow serving files from the plugins directory
      allow: ['..'],
    },
  },
  define: {
    // Make devcontainer status available to the app
    'import.meta.env.VITE_DEVCONTAINER': JSON.stringify(isDevContainer ? 'true' : 'false'),
  },
})

