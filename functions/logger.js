/**
 * Secure Logging Utility for Netlify Functions
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

// Determine if we're in development mode (Netlify Functions)
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     process.env.NETLIFY_DEV === 'true' ||
                     process.env.CONTEXT === 'dev'

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
    /private[_-]?key/i,
    /client[_-]?secret/i,
    /tenant[_-]?id/i
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
    
    // Redact Bearer tokens (JWT format)
    str = str.replace(/Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi, 'Bearer [REDACTED_JWT]')
    
    // Redact long alphanumeric tokens (likely API keys/secrets)
    str = str.replace(/[A-Za-z0-9]{32,}/g, '[REDACTED_TOKEN]')
    
    // Redact GUIDs in sensitive contexts
    str = str.replace(/([Tt]oken|[Ss]ecret|[Kk]ey)[:=]\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '$1: [REDACTED_GUID]')
    
    return str
}

/**
 * Development-only debug logging
 * Only logs in development mode, completely silent in production
 * 
 * @example
 * logDebug('🔍 Processing request:', { userId: '123', token: 'secret' })
 * // Development: Logs with token redacted
 * // Production: Silent
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
 * 
 * @example
 * import { logger } from './logger.js'
 * logger.debug('User authenticated:', userId)
 * logger.error('Failed to fetch:', error)
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
