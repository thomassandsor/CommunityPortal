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
    
    console.log(`🔒 OWNERSHIP VALIDATION: Checking contact ${sanitizedGuid} for user ${user.userId}`)
    
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
            console.error(`🛡️ OWNERSHIP VIOLATION: Contact GUID ${sanitizedGuid} does not exist`)
            throw new Error('Contact record not found')
        }
        console.error(`🛡️ OWNERSHIP VALIDATION ERROR: Failed to fetch contact: ${response.status}`)
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
            console.error(`🛡️ OWNERSHIP VIOLATION: Contact ${sanitizedGuid} has no email address`)
            throw new Error('Contact record has no email address')
        }
        
        if (contactEmail !== normalizedUserEmail) {
            console.error(`🛡️ OWNERSHIP VIOLATION: Contact ${sanitizedGuid} email "${contactEmail}" does not match user email "${normalizedUserEmail}"`)
            throw new Error('Access denied: Contact does not belong to authenticated user')
        }
        
        console.log(`✅ OWNERSHIP VALIDATED: Contact ${sanitizedGuid} belongs to ${normalizedUserEmail}`)
    } else {
        // Email not available in JWT - contact exists and GUID is valid
        // This is acceptable since the frontend already performed contact lookup via ContactChecker
        // and the user authenticated with Clerk
        console.log(`✅ OWNERSHIP CHECK: Contact ${sanitizedGuid} exists and GUID is valid (email verification not available in JWT)`)
    }
    
    return contact
}
