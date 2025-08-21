/**
 * Development Connection Monitor
 * 
 * Handles graceful disconnection when the development server stops
 * to prevent the endless localhost reconnection errors.
 */

// Only run in development mode
if (import.meta.env.DEV) {
    let connectionLost = false
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5

    // Monitor for connection losses
    const originalFetch = window.fetch
    window.fetch = async function (...args) {
        try {
            const response = await originalFetch.apply(this, args)

            // Reset connection status on successful request
            if (response.ok && connectionLost) {
                connectionLost = false
                reconnectAttempts = 0
                console.log('🔄 Development server reconnected')
            }

            return response
        } catch (error) {
            // Check if this is a localhost connection error
            if (error.message.includes('localhost') || error.message.includes('ERR_CONNECTION_REFUSED')) {
                reconnectAttempts++

                if (!connectionLost) {
                    connectionLost = true
                    console.log('🔌 Development server disconnected')
                }

                // After max attempts, show user-friendly message
                if (reconnectAttempts >= maxReconnectAttempts) {
                    console.log('⚠️ Development server appears to be stopped')
                    console.log('💡 Close this browser tab to stop reconnection attempts')

                    // Stop further reconnection attempts by disabling HMR
                    if (window.__vite_plugin_react_preamble_installed__) {
                        // Disable Vite HMR reconnection
                        if (import.meta.hot) {
                            import.meta.hot.dispose(() => { })
                        }
                    }
                }
            }

            throw error
        }
    }

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && connectionLost) {
            console.log('🔍 Page visible again, checking server status...')

            // Test if server is back online
            fetch('/.netlify/functions/contact?test=1')
                .then(() => {
                    connectionLost = false
                    reconnectAttempts = 0
                    console.log('✅ Development server is back online')
                })
                .catch(() => {
                    console.log('❌ Development server still offline')
                })
        }
    })

    // Provide helpful console messages
    console.log('🛠️ Development mode active')
    console.log('💡 Tips to reduce reconnection errors:')
    console.log('   • Use Ctrl+C to stop the server')
    console.log('   • Close browser tabs when server stops')
    console.log('   • Refresh page if you see connection errors')
}
