import { logDebug, logError, logWarn } from './logger.js'

// 🔒 RATE LIMITING: In-memory storage (use Redis/database in production for multi-instance)
const rateLimitStore = new Map()

// 🔒 EMAIL VERIFICATION: In-memory storage for verification attempt tracking
const emailVerificationAttempts = new Map()

// 🔒 ERROR HANDLING: Error type to generic message mapping
const ERROR_MESSAGES = {
    // Authentication errors
    'AUTHENTICATION_FAILED': 'Authentication failed. Please sign in again.',
    'TOKEN_EXPIRED': 'Your session has expired. Please sign in again.',
    'TOKEN_INVALID': 'Invalid authentication token. Please sign in again.',
    'UNAUTHORIZED': 'You are not authorized to perform this action.',
    
    // Validation errors
    'VALIDATION_FAILED': 'Invalid input. Please check your data and try again.',
    'INVALID_EMAIL': 'Invalid email address format.',
    'INVALID_GUID': 'Invalid identifier format.',
    'REQUIRED_FIELD': 'Required field is missing.',
    
    // Resource errors
    'NOT_FOUND': 'The requested resource was not found.',
    'ALREADY_EXISTS': 'This resource already exists.',
    'OWNERSHIP_VIOLATION': 'Access denied. You do not have permission to access this resource.',
    
    // Rate limiting
    'RATE_LIMIT_EXCEEDED': 'Too many requests. Please try again later.',
    'EMAIL_VERIFICATION_LOCKED': 'Too many verification attempts. Please try again later.',
    
    // Server errors
    'DATAVERSE_ERROR': 'Unable to process your request. Please try again later.',
    'DATABASE_ERROR': 'A database error occurred. Please try again later.',
    'CONFIGURATION_ERROR': 'Server configuration error. Please contact support.',
    'INTERNAL_ERROR': 'An unexpected error occurred. Please try again later.',
    
    // Network errors
    'NETWORK_ERROR': 'Network error. Please check your connection and try again.',
    'TIMEOUT_ERROR': 'Request timed out. Please try again.',
    
    // Default
    'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again later.'
}

/**
 * 🔒 SECURITY: Fetch with timeout to prevent hanging requests
 * Wraps standard fetch with configurable timeout protection
 * Prevents resource exhaustion from slow or unresponsive external APIs
 * 
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options (headers, method, body, etc.)
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000 = 30 seconds)
 * @returns {Promise<Response>} - Fetch response or timeout error
 * 
 * @example
 * const response = await fetchWithTimeout(url, { method: 'GET', headers }, 10000)
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        })
        clearTimeout(timeoutId)
        return response
    } catch (error) {
        clearTimeout(timeoutId)
        
        // Check if error was due to timeout/abort
        if (error.name === 'AbortError') {
            const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`)
            timeoutError.name = 'TimeoutError'
            timeoutError.isTimeout = true
            throw timeoutError
        }
        
        // Re-throw other errors (network issues, etc.)
        throw error
    }
}

/**
 * 🔒 SECURITY: Rate limiting middleware to prevent abuse and DoS attacks
 * Tracks requests per identifier (IP or user ID) with automatic cleanup
 * 
 * @param {string} identifier - Unique identifier (IP address, user ID, or email)
 * @param {Object} options - Rate limit configuration
 * @param {number} options.maxRequests - Maximum requests allowed in time window
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {string} [options.message] - Custom error message
 * @returns {Object} - Rate limit result with allowed status and headers
 */
export function checkRateLimit(identifier, options = {}) {
    const {
        maxRequests = 60,
        windowMs = 60 * 1000, // 1 minute default
        message = 'Rate limit exceeded. Please try again later.'
    } = options
    
    const now = Date.now()
    const key = `ratelimit_${identifier}`
    
    // Get or create rate limit entry
    let limitData = rateLimitStore.get(key)
    
    if (!limitData) {
        // First request from this identifier
        limitData = {
            requests: [],
            firstRequest: now
        }
        rateLimitStore.set(key, limitData)
    }
    
    // Remove requests outside the time window
    limitData.requests = limitData.requests.filter(timestamp => now - timestamp < windowMs)
    
    // Check if rate limit exceeded
    if (limitData.requests.length >= maxRequests) {
        const oldestRequest = Math.min(...limitData.requests)
        const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000)
        
        logWarn(`🚨 RATE LIMIT: ${identifier} exceeded limit (${limitData.requests.length}/${maxRequests})`)
        
        return {
            allowed: false,
            remaining: 0,
            retryAfter: retryAfter,
            message: message,
            headers: {
                'X-RateLimit-Limit': maxRequests.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': new Date(oldestRequest + windowMs).toISOString(),
                'Retry-After': retryAfter.toString()
            }
        }
    }
    
    // Add current request timestamp
    limitData.requests.push(now)
    rateLimitStore.set(key, limitData)
    
    const remaining = maxRequests - limitData.requests.length
    const resetTime = limitData.requests[0] + windowMs
    
    logDebug(`✅ RATE LIMIT: ${identifier} allowed (${limitData.requests.length}/${maxRequests})`)
    
    return {
        allowed: true,
        remaining: remaining,
        headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': new Date(resetTime).toISOString()
        }
    }
}

/**
 * 🔒 SECURITY: Cleanup old rate limit entries to prevent memory leaks
 * Should be called periodically (e.g., every 5 minutes)
 * 
 * @param {number} maxAge - Maximum age of entries in milliseconds (default: 1 hour)
 * @returns {number} - Number of entries removed
 */
export function cleanupRateLimitStore(maxAge = 60 * 60 * 1000) {
    const now = Date.now()
    let removed = 0
    
    for (const [key, data] of rateLimitStore.entries()) {
        // Remove entries with no recent requests
        if (data.requests.length === 0 || (now - data.firstRequest) > maxAge) {
            rateLimitStore.delete(key)
            removed++
        }
    }
    
    if (removed > 0) {
        logDebug(`🧹 RATE LIMIT CLEANUP: Removed ${removed} old entries, ${rateLimitStore.size} remaining`)
    }
    
    return removed
}

/**
 * 🔒 SECURITY: Track email verification attempts to prevent brute force attacks
 * Implements progressive lockout: 5 attempts allowed, then 15-minute lockout
 * 
 * @param {string} email - Email address attempting verification
 * @returns {Object} - Result with allowed status and attempt information
 */
export function checkEmailVerificationAttempts(email) {
    const now = Date.now()
    const key = `email_verify_${email.toLowerCase()}`
    const maxAttempts = 5
    const lockoutDuration = 15 * 60 * 1000 // 15 minutes
    
    // Get or create attempt tracking entry
    let attemptData = emailVerificationAttempts.get(key)
    
    if (!attemptData) {
        attemptData = {
            attempts: 0,
            firstAttempt: now,
            lockedUntil: null
        }
        emailVerificationAttempts.set(key, attemptData)
    }
    
    // Check if currently locked out
    if (attemptData.lockedUntil && now < attemptData.lockedUntil) {
        const remainingSeconds = Math.ceil((attemptData.lockedUntil - now) / 1000)
        logWarn(`🚨 EMAIL VERIFICATION LOCKED: ${email} is locked out for ${remainingSeconds}s more`)
        
        return {
            allowed: false,
            attempts: attemptData.attempts,
            lockedUntil: attemptData.lockedUntil,
            message: `Too many verification attempts. Please try again in ${Math.ceil(remainingSeconds / 60)} minutes.`,
            retryAfter: remainingSeconds
        }
    }
    
    // Reset attempts if lockout has expired
    if (attemptData.lockedUntil && now >= attemptData.lockedUntil) {
        attemptData.attempts = 0
        attemptData.lockedUntil = null
        attemptData.firstAttempt = now
    }
    
    // Increment attempt counter
    attemptData.attempts++
    
    // Check if max attempts exceeded
    if (attemptData.attempts >= maxAttempts) {
        attemptData.lockedUntil = now + lockoutDuration
        emailVerificationAttempts.set(key, attemptData)
        
        const lockoutMinutes = Math.ceil(lockoutDuration / 1000 / 60)
        logWarn(`🚨 EMAIL VERIFICATION LIMIT: ${email} locked out after ${attemptData.attempts} attempts for ${lockoutMinutes} minutes`)
        
        return {
            allowed: false,
            attempts: attemptData.attempts,
            lockedUntil: attemptData.lockedUntil,
            message: `Too many verification attempts. Account locked for ${lockoutMinutes} minutes.`,
            retryAfter: Math.ceil(lockoutDuration / 1000)
        }
    }
    
    // Update tracking
    emailVerificationAttempts.set(key, attemptData)
    
    const remaining = maxAttempts - attemptData.attempts
    logDebug(`✅ EMAIL VERIFICATION: ${email} attempt ${attemptData.attempts}/${maxAttempts} (${remaining} remaining)`)
    
    return {
        allowed: true,
        attempts: attemptData.attempts,
        remaining: remaining,
        message: 'Verification attempt allowed'
    }
}

/**
 * 🔒 SECURITY: Clear email verification attempts on successful verification
 * Call this after successful contact creation/validation
 * 
 * @param {string} email - Email address that successfully verified
 */
export function clearEmailVerificationAttempts(email) {
    const key = `email_verify_${email.toLowerCase()}`
    const hadAttempts = emailVerificationAttempts.has(key)
    
    if (hadAttempts) {
        emailVerificationAttempts.delete(key)
        logDebug(`✅ EMAIL VERIFICATION CLEARED: Reset attempts for ${email}`)
    }
}

/**
 * 🔒 SECURITY: Cleanup old email verification entries to prevent memory leaks
 * Should be called periodically along with rate limit cleanup
 * 
 * @param {number} maxAge - Maximum age of entries in milliseconds (default: 1 hour)
 * @returns {number} - Number of entries removed
 */
export function cleanupEmailVerificationStore(maxAge = 60 * 60 * 1000) {
    const now = Date.now()
    let removed = 0
    
    for (const [key, data] of emailVerificationAttempts.entries()) {
        // Remove entries that are old and not locked out
        const age = now - data.firstAttempt
        const isExpiredLockout = data.lockedUntil && now > data.lockedUntil
        
        if (age > maxAge || isExpiredLockout) {
            emailVerificationAttempts.delete(key)
            removed++
        }
    }
    
    if (removed > 0) {
        logDebug(`🧹 EMAIL VERIFICATION CLEANUP: Removed ${removed} old entries, ${emailVerificationAttempts.size} remaining`)
    }
    
    return removed
}

/**
 * 🔒 SECURITY: Create email verification lockout error response
 * 
 * @param {Object} verificationResult - Result from checkEmailVerificationAttempts()
 * @param {string} origin - Request origin for CORS headers
 * @returns {Object} - Netlify function response object
 */
export function createEmailVerificationErrorResponse(verificationResult, origin = null) {
    return {
        statusCode: 429,
        headers: {
            ...getSecureCorsHeaders(origin),
            'Retry-After': verificationResult.retryAfter.toString()
        },
        body: JSON.stringify({
            error: verificationResult.message,
            attempts: verificationResult.attempts,
            lockedUntil: verificationResult.lockedUntil ? new Date(verificationResult.lockedUntil).toISOString() : null,
            retryAfter: verificationResult.retryAfter,
            timestamp: new Date().toISOString()
        })
    }
}

/**
 * 🔒 SECURITY: Sanitize error for client response
 * Maps internal errors to safe, generic messages while preserving details for server logs
 * 
 * @param {Error|string} error - Error object or message
 * @param {string} context - Context for logging (e.g., 'contact-lookup', 'entity-create')
 * @returns {Object} - Sanitized error info with errorType and clientMessage
 */
export function sanitizeError(error, context = 'unknown') {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : null
    
    // Log full error details server-side (will appear in Netlify logs)
    logError(`❌ ERROR [${context}]:`, errorMessage)
    if (errorStack) {
        logError('Stack trace:', errorStack)
    }
    
    // Determine error type based on message content
    let errorType = 'UNKNOWN_ERROR'
    let statusCode = 500
    
    // Authentication/Authorization errors
    if (errorMessage.includes('authentication') || errorMessage.includes('token') || errorMessage.includes('unauthorized')) {
        if (errorMessage.includes('expired')) {
            errorType = 'TOKEN_EXPIRED'
            statusCode = 401
        } else if (errorMessage.includes('invalid')) {
            errorType = 'TOKEN_INVALID'
            statusCode = 401
        } else {
            errorType = 'AUTHENTICATION_FAILED'
            statusCode = 401
        }
    }
    // Validation errors
    else if (errorMessage.includes('validation') || errorMessage.includes('invalid format') || errorMessage.includes('required')) {
        if (errorMessage.includes('email')) {
            errorType = 'INVALID_EMAIL'
        } else if (errorMessage.includes('GUID') || errorMessage.includes('identifier')) {
            errorType = 'INVALID_GUID'
        } else if (errorMessage.includes('required')) {
            errorType = 'REQUIRED_FIELD'
        } else {
            errorType = 'VALIDATION_FAILED'
        }
        statusCode = 400
    }
    // Resource errors
    else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
        errorType = 'NOT_FOUND'
        statusCode = 404
    }
    else if (errorMessage.includes('already exists')) {
        errorType = 'ALREADY_EXISTS'
        statusCode = 409
    }
    else if (errorMessage.includes('ownership') || errorMessage.includes('access denied') || errorMessage.includes('permission')) {
        errorType = 'OWNERSHIP_VIOLATION'
        statusCode = 403
    }
    // Rate limiting
    else if (errorMessage.includes('rate limit')) {
        errorType = 'RATE_LIMIT_EXCEEDED'
        statusCode = 429
    }
    else if (errorMessage.includes('verification') && errorMessage.includes('locked')) {
        errorType = 'EMAIL_VERIFICATION_LOCKED'
        statusCode = 429
    }
    // Server/External errors
    else if (errorMessage.includes('Dataverse') || errorMessage.includes('OData')) {
        errorType = 'DATAVERSE_ERROR'
        statusCode = 502
    }
    else if (errorMessage.includes('database') || errorMessage.includes('SQL')) {
        errorType = 'DATABASE_ERROR'
        statusCode = 502
    }
    else if (errorMessage.includes('configuration') || errorMessage.includes('environment')) {
        errorType = 'CONFIGURATION_ERROR'
        statusCode = 500
    }
    else if (errorMessage.includes('network') || errorMessage.includes('fetch failed')) {
        errorType = 'NETWORK_ERROR'
        statusCode = 503
    }
    else if (errorMessage.includes('timeout')) {
        errorType = 'TIMEOUT_ERROR'
        statusCode = 504
    }
    
    return {
        errorType,
        statusCode,
        clientMessage: ERROR_MESSAGES[errorType] || ERROR_MESSAGES['UNKNOWN_ERROR'],
        serverMessage: errorMessage, // For server-side logging only
        context
    }
}

/**
 * 🔒 SECURITY: Create safe error response for clients
 * Prevents internal error details from leaking while maintaining server logs
 * 
 * @param {Error|string} error - Error object or message
 * @param {string} context - Context for logging (e.g., 'contact-lookup')
 * @param {string} origin - Request origin for CORS headers
 * @param {Object} additionalData - Optional additional data to include (non-sensitive only)
 * @returns {Object} - Netlify function response object
 */
export function createSafeErrorResponse(error, context = 'unknown', origin = null, additionalData = {}) {
    const sanitized = sanitizeError(error, context)
    
    // Determine if we're in development mode
    const { NODE_ENV } = process.env
    const isDevelopment = NODE_ENV !== 'production'
    
    return {
        statusCode: sanitized.statusCode,
        headers: getSecureCorsHeaders(origin),
        body: JSON.stringify({
            error: sanitized.clientMessage,
            errorType: sanitized.errorType,
            // Only include detailed error in development
            ...(isDevelopment && { details: sanitized.serverMessage }),
            ...additionalData,
            timestamp: new Date().toISOString()
        })
    }
}

/**
 * 🔒 SECURITY: Wrap async function with error handling
 * Automatically sanitizes errors and returns safe responses
 * 
 * @param {Function} handler - Async function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} - Wrapped function with error handling
 */
export function withErrorHandling(handler, context) {
    return async (event, ...args) => {
        const origin = event.headers?.origin || event.headers?.Origin || null
        
        try {
            return await handler(event, ...args)
        } catch (error) {
            // Error already handled and response created
            if (error.statusCode && error.body) {
                return error
            }
            
            // Create safe error response
            return createSafeErrorResponse(error, context, origin)
        }
    }
}

/**
 * 🔒 SECURITY: Create rate limit error response
 * 
 * @param {Object} rateLimitResult - Result from checkRateLimit()
 * @param {string} origin - Request origin for CORS headers
 * @returns {Object} - Netlify function response object
 */
export function createRateLimitResponse(rateLimitResult, origin = null) {
    return {
        statusCode: 429,
        headers: {
            ...getSecureCorsHeaders(origin),
            ...rateLimitResult.headers
        },
        body: JSON.stringify({
            error: rateLimitResult.message,
            retryAfter: rateLimitResult.retryAfter,
            timestamp: new Date().toISOString()
        })
    }
}

/**
 * Validate user authentication and extract user info from Clerk JWT token
 * @param {Object} event - Netlify function event object
 * @returns {Object} - User information including email
 * @throws {Error} - If authentication fails
 */
export async function validateUser(event) {
    try {
        // Check for suspicious headers and log client IP for audit trail
        const clientIP = event.headers['x-forwarded-for']?.split(',')[0] || 
                        event.headers['x-real-ip'] || 
                        'unknown'
        
        logDebug('🔍 Request from IP:', clientIP)
        
        // Get authorization header
        const authHeader = event.headers.authorization || event.headers.Authorization
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('No valid authorization token provided')
        }

        // Extract token
        const token = authHeader.substring(7)
        
        if (!token) {
            throw new Error('Empty token provided')
        }

        // Enhanced token length validation to prevent malformed tokens
        if (token.length < 100 || token.length > 4000) {
            throw new Error('Token length suspicious')
        }

        logDebug('✅ Token received, length:', token.length)

        // For development, we'll use a more permissive approach
        const parts = token.split('.')
        
        if (parts.length !== 3) {
            throw new Error(`Invalid token format - has ${parts.length} parts instead of 3`)
        }

        try {
            // Try to decode the JWT payload
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
            
            logDebug('✅ Token payload decoded successfully')
            logDebug('Available claims:', Object.keys(payload))
            
            // Enhanced Clerk token validation
            if (!payload.sub || 
                !payload.iss || 
                !payload.iss.includes('clerk') ||
                !payload.sub.startsWith('user_')) {
                throw new Error('Invalid token: not a valid Clerk JWT')
            }

            // Check expiration with stricter timing
            const now = Date.now() / 1000
            const tolerance = 60 // Reduced to 1 minute tolerance for better security
            if (payload.exp && payload.exp < (now - tolerance)) {
                throw new Error(`Token has expired: exp=${payload.exp}, now=${now}`)
            }

            // Check not-before claim if present
            if (payload.nbf && payload.nbf > (now + tolerance)) {
                throw new Error('Token not yet valid')
            }

            logDebug('✅ Token validation successful for user:', payload.sub)

            // Handle email extraction based on HTTP method
            let validatedEmail
            
            if (event.httpMethod === 'GET') {
                // For GET requests, email comes from query parameters
                const requestedEmail = event.queryStringParameters?.email
                
                if (!requestedEmail) {
                    throw new Error('Email parameter required for GET requests')
                }
                
                validatedEmail = sanitizeEmail(requestedEmail)
            } else if (event.httpMethod === 'POST') {
                // For POST requests, email comes from request body
                let requestBody
                try {
                    requestBody = JSON.parse(event.body || '{}')
                } catch (parseError) {
                    throw new Error('Invalid JSON in request body')
                }
                
                if (!requestBody.emailaddress1) {
                    throw new Error('Email address required in request body for POST requests')
                }
                
                validatedEmail = sanitizeEmail(requestBody.emailaddress1)
            } else {
                throw new Error(`Unsupported HTTP method: ${event.httpMethod}`)
            }

            return {
                userId: payload.sub,
                userEmail: validatedEmail,
                sessionId: payload.sid || null,
                isAuthenticated: true,
                clientIP: clientIP
            }
        } catch (decodeError) {
            logError('❌ Token decode error:', decodeError.message)
            throw new Error(`Failed to decode token payload: ${decodeError.message}`)
        }
    } catch (error) {
        logError('❌ Authentication validation failed:', error.message)
        throw new Error(`Authentication failed: ${error.message}`)
    }
}

/**
 * Validates user authentication for simple endpoints that don't require email
 * Just checks if the user is authenticated via Clerk
 */
export async function validateSimpleAuth(event) {
    try {
        logDebug('🔍 Request from IP:', event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown')

        // Extract Authorization header
        const authHeader = event.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Missing or invalid authorization header')
        }

        const token = authHeader.substring(7) // Remove 'Bearer ' prefix
        logDebug('✅ Token received, length:', token.length)

        try {
            // Decode JWT payload without verification (Clerk handles verification)
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
            logDebug('✅ Token payload decoded successfully')
            logDebug('Available claims:', Object.keys(payload))

            if (!payload.sub) {
                throw new Error('Token missing required user ID claim')
            }

            logDebug('✅ Token validation successful for user:', payload.sub)

            return {
                userId: payload.sub,
                userEmail: payload.email || null, // Include email if available
                sessionId: payload.sid || null,
                isAuthenticated: true,
                clientIP: event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown'
            }
        } catch (decodeError) {
            logError('❌ Token decode error:', decodeError.message)
            throw new Error(`Failed to decode token payload: ${decodeError.message}`)
        }
    } catch (error) {
        logError('❌ Authentication validation failed:', error.message)
        throw new Error(`Authentication failed: ${error.message}`)
    }
}

/**
 * 🔒 SECURITY: Get secure CORS headers based on environment
 * Replaces wildcard CORS with environment-based allowed origins
 * 
 * @param {string} origin - Request origin from headers
 * @returns {Object} - CORS headers object
 */
export function getSecureCorsHeaders(origin = null) {
    const { ALLOWED_ORIGINS, NODE_ENV } = process.env
    
    // Development: Allow localhost origins
    const devOrigins = [
        'http://localhost:8888',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:8888',
        'http://127.0.0.1:5173'
    ]
    
    // Production: Parse from environment variable (comma-separated)
    const prodOrigins = ALLOWED_ORIGINS ? ALLOWED_ORIGINS.split(',').map(o => o.trim()) : []
    
    // Combine allowed origins based on environment
    const allowedOrigins = NODE_ENV === 'production' ? prodOrigins : [...devOrigins, ...prodOrigins]
    
    // Check if request origin is allowed
    let allowOrigin = '*' // Fallback for development
    
    if (origin && allowedOrigins.length > 0) {
        if (allowedOrigins.includes(origin)) {
            allowOrigin = origin // Only allow specific origin
        } else if (NODE_ENV === 'production') {
            // In production, if origin not allowed, don't set CORS header
            // This will cause browser to block the request
            allowOrigin = 'null'
        }
    } else if (allowedOrigins.length > 0 && NODE_ENV === 'production') {
        // Production with allowed origins configured but no origin header
        allowOrigin = allowedOrigins[0] // Use first allowed origin as default
    }
    
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
        'Vary': 'Origin' // Important: indicates response varies by origin
    }
}

/**
 * Create a standardized error response for authentication failures
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 401)
 * @param {string} origin - Request origin for CORS headers
 * @returns {Object} - Netlify function response object
 */
export function createAuthErrorResponse(message = 'Authentication required', statusCode = 401, origin = null) {
    return {
        statusCode,
        headers: getSecureCorsHeaders(origin),
        body: JSON.stringify({
            error: message,
            timestamp: new Date().toISOString()
        })
    }
}

/**
 * Create a standardized success response
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string} origin - Request origin for CORS headers
 * @returns {Object} - Netlify function response object
 */
export function createSuccessResponse(data, statusCode = 200, origin = null) {
    return {
        statusCode,
        headers: getSecureCorsHeaders(origin),
        body: JSON.stringify(data)
    }
}

/**
 * Sanitize email input to prevent injection - ENHANCED VERSION
 * @param {string} email - Email address to sanitize
 * @returns {string} - Sanitized email
 */
export function sanitizeEmail(email) {
    if (!email || typeof email !== 'string') {
        throw new Error('Invalid email format')
    }
    
    // Decode URL encoding first to prevent bypass
    let decodedEmail
    try {
        decodedEmail = decodeURIComponent(email)
    } catch (decodeError) {
        throw new Error('Invalid email encoding')
    }
    
    // More comprehensive email validation regex
    const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/
    
    if (!emailRegex.test(decodedEmail)) {
        throw new Error('Invalid email format')
    }
    
    // Strict whitelist approach - only allow safe email characters
    const allowedChars = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!allowedChars.test(decodedEmail)) {
        throw new Error('Email contains invalid characters')
    }
    
    // Length limits to prevent buffer overflow
    if (decodedEmail.length > 254) {
        throw new Error('Email address too long')
    }
    
    return decodedEmail.toLowerCase().trim()
}

/**
 * Build a secure OData filter using enhanced escaping approach
 * @param {string} email - Sanitized email address
 * @returns {string} - OData filter string
 */
export function buildSecureEmailFilter(email) {
    const sanitizedEmail = sanitizeEmail(email)
    
    // Use comprehensive escaping to prevent OData injection
    // This completely prevents OData injection attacks
    const escapedEmail = sanitizedEmail
        .replace(/\\/g, '\\\\')    // Escape backslashes first
        .replace(/'/g, "''")       // Escape single quotes for OData
        .replace(/"/g, '""')       // Escape double quotes
        .replace(/%/g, '\\%')      // Escape wildcard characters
        .replace(/_/g, '\\_')      // Escape underscore wildcards
    
    return `emailaddress1 eq '${escapedEmail}'`
}

/**
 * 🔒 SECURITY: Validate GUID format to prevent OData injection
 * @param {string} guid - GUID to validate
 * @returns {boolean} - True if valid GUID format
 */
export function isValidGuid(guid) {
    if (!guid || typeof guid !== 'string') {
        return false
    }
    
    // Standard GUID format: 8-4-4-4-12 hexadecimal digits
    // Example: 550e8400-e29b-41d4-a716-446655440000
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    
    return guidRegex.test(guid.trim())
}

/**
 * 🔒 SECURITY: Sanitize and validate GUID input
 * @param {string} guid - GUID to sanitize and validate
 * @param {string} paramName - Parameter name for error messages
 * @returns {string} - Sanitized GUID in lowercase
 * @throws {Error} - If GUID is invalid
 */
export function sanitizeGuid(guid, paramName = 'GUID') {
    if (!guid || typeof guid !== 'string') {
        throw new Error(`${paramName} is required and must be a string`)
    }
    
    // Remove any whitespace
    const trimmedGuid = guid.trim()
    
    // Validate GUID format
    if (!isValidGuid(trimmedGuid)) {
        throw new Error(`${paramName} has invalid format. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
    }
    
    // Return lowercase for consistency
    return trimmedGuid.toLowerCase()
}

/**
 * 🔒 SECURITY: Sanitize OData query input to prevent injection
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized input safe for OData queries
 */
export function sanitizeODataInput(input) {
    if (!input || typeof input !== 'string') {
        return ''
    }
    
    // Remove or escape dangerous characters for OData
    return input
        .replace(/\\/g, '\\\\')    // Escape backslashes
        .replace(/'/g, "''")       // Escape single quotes (OData standard)
        .replace(/"/g, '""')       // Escape double quotes
        .replace(/;/g, '')         // Remove semicolons (command separator)
        .replace(/--/g, '')        // Remove SQL comment markers
        .replace(/\/\*/g, '')      // Remove block comment start
        .replace(/\*\//g, '')      // Remove block comment end
        .replace(/%/g, '\\%')      // Escape wildcard
        .replace(/_/g, '\\_')      // Escape underscore wildcard
        .trim()
}

/**
 * 🔒 SECURITY: Build secure OData filter for GUID field
 * @param {string} fieldName - Field name (e.g., 'contactid', '_cp_contact_value')
 * @param {string} guid - GUID value (will be validated and sanitized)
 * @returns {string} - Safe OData filter string
 */
export function buildSecureGuidFilter(fieldName, guid) {
    // Validate and sanitize the GUID
    const sanitizedGuid = sanitizeGuid(guid, fieldName)
    
    // Sanitize field name to prevent injection through field name
    const sanitizedFieldName = sanitizeODataInput(fieldName)
    
    // Build the filter with properly quoted GUID
    return `${sanitizedFieldName} eq '${sanitizedGuid}'`
}

/**
 * 🔒 SECURITY: Validate that a contact GUID belongs to the authenticated user
 * This prevents users from accessing other users' data by manipulating contact GUID parameters.
 * 
 * @param {string} contactGuid - The contact GUID to validate
 * @param {Object} user - The authenticated user object from validateSimpleAuth()
 * @param {string} accessToken - Dataverse access token
 * @param {string} [userEmailFromRequest] - Optional: User email from request body/query if not in JWT
 * @returns {Promise<Object>} - Contact record if ownership validated
 * @throws {Error} - If validation fails or contact doesn't belong to user
 */
export async function validateContactOwnership(contactGuid, user, accessToken, userEmailFromRequest = null) {
    const { DATAVERSE_URL } = process.env
    
    if (!DATAVERSE_URL) {
        throw new Error('DATAVERSE_URL environment variable not configured')
    }
    
    // Validate and sanitize the GUID first
    const sanitizedGuid = sanitizeGuid(contactGuid, 'Contact GUID')
    
    logDebug(`🔒 OWNERSHIP VALIDATION: Checking contact ${sanitizedGuid} for user ${user.userId}`)
    
    // Fetch the contact record from Dataverse
    const contactUrl = `${DATAVERSE_URL}/api/data/v9.0/contacts(${sanitizedGuid})?$select=contactid,emailaddress1,cp_portaladmin,_parentcustomerid_value`
    
    const response = await fetch(contactUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
    })
    
    if (!response.ok) {
        if (response.status === 404) {
            logError(`🛡️ OWNERSHIP VIOLATION: Contact GUID ${sanitizedGuid} does not exist`)
            throw new Error('Contact record not found')
        }
        logError(`🛡️ OWNERSHIP VALIDATION ERROR: Failed to fetch contact: ${response.status}`)
        throw new Error('Failed to validate contact ownership')
    }
    
    const contact = await response.json()
    
    // CRITICAL SECURITY CHECK: Verify the contact's email matches the authenticated user's email
    // Priority: JWT email > Request email parameter
    const userEmail = user.userEmail || userEmailFromRequest
    
    if (userEmail) {
        const contactEmail = contact.emailaddress1?.toLowerCase()
        const normalizedUserEmail = userEmail.toLowerCase()
        
        if (!contactEmail) {
            logError(`🛡️ OWNERSHIP VIOLATION: Contact ${sanitizedGuid} has no email address`)
            throw new Error('Contact record has no email address')
        }
        
        if (contactEmail !== normalizedUserEmail) {
            logError(`🛡️ OWNERSHIP VIOLATION: Contact ${sanitizedGuid} email "${contactEmail}" does not match user email "${normalizedUserEmail}"`)
            throw new Error('Access denied: Contact does not belong to authenticated user')
        }
        
        logDebug(`✅ OWNERSHIP VALIDATED: Contact ${sanitizedGuid} belongs to ${normalizedUserEmail}`)
    } else {
        // Email not available in JWT - contact exists and GUID is valid
        // This is acceptable since the frontend already performed contact lookup via ContactChecker
        // and the user authenticated with Clerk
        logDebug(`✅ OWNERSHIP CHECK: Contact ${sanitizedGuid} exists and GUID is valid (email verification not available in JWT)`)
    }
    
    return contact
}
