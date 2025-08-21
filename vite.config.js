import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
    },
    server: {
        // Optimize HMR reconnection behavior
        hmr: {
            timeout: 5000,
            overlay: true,
            // Reduce aggressive reconnection attempts
            host: 'localhost',
            port: 5173
        },
        // Configure connection handling
        watch: {
            // Use polling to reduce resource usage
            usePolling: false,
            // Ignore node_modules to improve performance
            ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**']
        },
        // Better port handling
        port: 5173,
        strictPort: false,  // Allow Vite to try other ports if 5173 is busy
        host: '127.0.0.1'   // Explicitly bind to localhost
    },
    // Optimize for development
    esbuild: {
        // Reduce bundle size in development
        target: 'es2020'
    }
})
