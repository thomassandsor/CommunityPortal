/**
 * Secure Logging Utility
 * 
 * Environment-aware logging that prevents sensitive data exposure in production.
 * Only logs debug information in development mode.
 * 
 * SECURITY FEATURES:
 * - Development-only debug logging
 * - Production error logging only
 * - Automatic token sanitization
 * - Data redaction for sensitive fields
 */

// Determine if we're in development mode
const isDevelopment = import.meta.env?.DEV || 
                     import.meta.env?.MODE === 'development' ||
                     process.env.NODE_ENV === 'development'

// Sensitive field patterns to redact
const SENSITIVE_PATTERNS = [
    /token/i,
    /password/i,
    /secret/i,
    /authorization/i,
    /bearer/i,
    /api[_-]?key/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /private[_-]?key/i
]

/**
 * Check if a key contains sensitive information
 */
function isSensitiveKey(key) {
    if (typeof key !== 'string') return false
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(key))
}

/**
 * Redact sensitive data from objects
 */
function redactSensitiveData(data) {
    if (!data || typeof data !== 'object') return data
    
    if (Array.isArray(data)) {
        return data.map(item => redactSensitiveData(item))
    }
    
    const redacted = {}
    for (const [key, value] of Object.entries(data)) {
        if (isSensitiveKey(key)) {
            redacted[key] = '[REDACTED]'
        } else if (typeof value === 'object' && value !== null) {
            redacted[key] = redactSensitiveData(value)
        } else {
            redacted[key] = value
        }
    }
    return redacted
}

/**
 * Sanitize string tokens (Bearer tokens, GUIDs in headers, etc.)
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return str
    
    // Redact Bearer tokens
    str = str.replace(/Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi, 'Bearer [REDACTED_JWT]')
    
    // Redact long alphanumeric tokens (likely API keys)
    str = str.replace(/[A-Za-z0-9]{32,}/g, '[REDACTED_TOKEN]')
    
    return str
}

/**
 * Development-only debug logging
 * Only logs in development mode, completely silent in production
 */
export function logDebug(...args) {
    if (!isDevelopment) return
    
    const sanitized = args.map(arg => {
        if (typeof arg === 'string') {
            return sanitizeString(arg)
        } else if (typeof arg === 'object' && arg !== null) {
            return redactSensitiveData(arg)
        }
        return arg
    })
    
    console.log(...sanitized)
}

/**
 * Development-only info logging
 */
export function logInfo(...args) {
    if (!isDevelopment) return
    
    const sanitized = args.map(arg => {
        if (typeof arg === 'string') {
            return sanitizeString(arg)
        } else if (typeof arg === 'object' && arg !== null) {
            return redactSensitiveData(arg)
        }
        return arg
    })
    
    console.info(...sanitized)
}

/**
 * Warning logging (enabled in all environments)
 * Sanitizes sensitive data before logging
 */
export function logWarn(...args) {
    const sanitized = args.map(arg => {
        if (typeof arg === 'string') {
            return sanitizeString(arg)
        } else if (typeof arg === 'object' && arg !== null) {
            return redactSensitiveData(arg)
        }
        return arg
    })
    
    console.warn(...sanitized)
}

/**
 * Error logging (enabled in all environments)
 * Sanitizes sensitive data but preserves stack traces
 */
export function logError(...args) {
    const sanitized = args.map(arg => {
        // Preserve Error objects and their stack traces
        if (arg instanceof Error) {
            return arg
        } else if (typeof arg === 'string') {
            return sanitizeString(arg)
        } else if (typeof arg === 'object' && arg !== null) {
            return redactSensitiveData(arg)
        }
        return arg
    })
    
    console.error(...sanitized)
}

/**
 * Conditional logging based on log level
 * Useful for replacing console.log with environment awareness
 */
export const logger = {
    debug: logDebug,
    info: logInfo,
    warn: logWarn,
    error: logError,
    
    // Convenience method to check if debug logging is enabled
    isDebugEnabled: () => isDevelopment
}

// Default export
export default logger
