#!/usr/bin/env node
/**
 * Development Helper Script
 * 
 * Provides better control over the development server lifecycle
 * and reduces the localhost reconnection spam when server stops.
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m'
}

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`)
}

function showBanner() {
    log('blue', '\n╭─────────────────────────────────────────────╮')
    log('blue', '│         Community Portal Dev Server         │')
    log('blue', '│                                             │')
    log('blue', '│  🔧 Netlify Dev + Vite HMR                 │')
    log('blue', '│  🔒 Security headers + Rate limiting        │')
    log('blue', '│  📊 Dataverse integration                   │')
    log('blue', '╰─────────────────────────────────────────────╯\n')
}

function showInstructions() {
    log('green', '✅ Development server ready!')
    log('yellow', '\n📋 Quick Tips:')
    log('reset', '   • Open http://localhost:8888 in browser')
    log('reset', '   • Functions: http://localhost:8888/.netlify/functions/')
    log('reset', '   • Vite HMR: http://localhost:5173')
    log('reset', '   • Press Ctrl+C to stop server cleanly')
    log('yellow', '\n🚨 To prevent localhost errors:')
    log('reset', '   • Close browser tabs when stopping server')
    log('reset', '   • Use Ctrl+C to stop (not just closing terminal)')
    log('reset', '   • Clear browser cache if issues persist\n')
}

async function startDevelopment() {
    showBanner()
    
    // Check if netlify.toml exists
    if (!existsSync('./netlify.toml')) {
        log('red', '❌ Error: netlify.toml not found')
        log('yellow', 'Make sure you\'re in the project root directory')
        process.exit(1)
    }
    
    log('yellow', '🚀 Starting Netlify development server...\n')
    
    // Start netlify dev with proper signal handling
    const netlifyDev = spawn('netlify', ['dev'], {
        stdio: 'inherit',
        shell: true
    })
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        log('yellow', '\n🛑 Stopping development server...')
        log('reset', '   Closing browser tabs to prevent reconnection errors...')
        
        netlifyDev.kill('SIGINT')
        
        setTimeout(() => {
            log('green', '✅ Development server stopped cleanly')
            log('blue', '💡 Tip: Your browser tabs should now stop trying to reconnect')
            process.exit(0)
        }, 1000)
    })
    
    netlifyDev.on('error', (err) => {
        log('red', `❌ Error starting development server: ${err.message}`)
        process.exit(1)
    })
    
    netlifyDev.on('close', (code) => {
        if (code === 0) {
            log('green', '✅ Development server closed successfully')
        } else {
            log('red', `❌ Development server exited with code ${code}`)
        }
        process.exit(code)
    })
    
    // Show instructions after a brief delay
    setTimeout(showInstructions, 3000)
}

// Run the development server
startDevelopment().catch((err) => {
    log('red', `❌ Failed to start development: ${err.message}`)
    process.exit(1)
})
