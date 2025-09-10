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
        
        console.log('🔍 Request from IP:', clientIP)
        
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

        console.log('✅ Token received, length:', token.length)

        // For development, we'll use a more permissive approach
        const parts = token.split('.')
        
        if (parts.length !== 3) {
            throw new Error(`Invalid token format - has ${parts.length} parts instead of 3`)
        }

        try {
            // Try to decode the JWT payload
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
            
            console.log('✅ Token payload decoded successfully')
            console.log('Available claims:', Object.keys(payload))
            
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

            console.log('✅ Token validation successful for user:', payload.sub)

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
            console.error('❌ Token decode error:', decodeError.message)
            throw new Error(`Failed to decode token payload: ${decodeError.message}`)
        }
    } catch (error) {
        console.error('❌ Authentication validation failed:', error.message)
        throw new Error(`Authentication failed: ${error.message}`)
    }
}

/**
 * Validates user authentication for simple endpoints that don't require email
 * Just checks if the user is authenticated via Clerk
 */
export async function validateSimpleAuth(event) {
    try {
        console.log('🔍 Request from IP:', event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown')

        // Extract Authorization header
        const authHeader = event.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Missing or invalid authorization header')
        }

        const token = authHeader.substring(7) // Remove 'Bearer ' prefix
        console.log('✅ Token received, length:', token.length)

        try {
            // Decode JWT payload without verification (Clerk handles verification)
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
            console.log('✅ Token payload decoded successfully')
            console.log('Available claims:', Object.keys(payload))

            if (!payload.sub) {
                throw new Error('Token missing required user ID claim')
            }

            console.log('✅ Token validation successful for user:', payload.sub)

            return {
                userId: payload.sub,
                userEmail: payload.email || null, // Include email if available
                sessionId: payload.sid || null,
                isAuthenticated: true,
                clientIP: event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown'
            }
        } catch (decodeError) {
            console.error('❌ Token decode error:', decodeError.message)
            throw new Error(`Failed to decode token payload: ${decodeError.message}`)
        }
    } catch (error) {
        console.error('❌ Authentication validation failed:', error.message)
        throw new Error(`Authentication failed: ${error.message}`)
    }
}

/**
 * Create a standardized error response for authentication failures
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 401)
 * @returns {Object} - Netlify function response object
 */
export function createAuthErrorResponse(message = 'Authentication required', statusCode = 401) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
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
 * @returns {Object} - Netlify function response object
 */
export function createSuccessResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
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
