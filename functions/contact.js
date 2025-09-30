/**
 * Netlify Function: contact.js
 * 
 * Handles CRUD operations for Contact records in Microsoft Dataverse.
 * 
 * GET /contact?email={email} - Find Contact by email address
 * POST /contact - Create or update Contact record
 * 
 * Uses Service Principal authentication to securely access Dataverse.
 * Implements email-based contact matching and creation logic.
 * 
 * SECURITY FEATURES:
 * - User authentication and authorization
 * - Input validation and sanitization
 * - Rate limiting protection
 * - Secure OData query building
 * - Request size limits
 */

import { validateUser, createAuthErrorResponse, createSuccessResponse, sanitizeEmail, buildSecureEmailFilter, getSecureCorsHeaders } from './auth-utils.js'

// Rate limiting storage (in production, use Redis or similar)
const rateLimits = new Map()

// Security helper functions
function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email) && email.length <= 254
}

function validateContactData(data, authenticatedEmail) {
    const errors = []

    // Required fields
    if (!data.emailaddress1?.trim()) {
        errors.push('Email address is required')
    } else if (!validateEmail(data.emailaddress1)) {
        errors.push('Invalid email format')
    } else if (data.emailaddress1.toLowerCase() !== authenticatedEmail.toLowerCase()) {
        // SECURITY: Ensure user can only create/update their own contact
        errors.push('Email address must match your authenticated account')
    }

    // Length limits (Dataverse field constraints)
    if (data.firstname && data.firstname.length > 50) {
        errors.push('First name cannot exceed 50 characters')
    }
    if (data.lastname && data.lastname.length > 50) {
        errors.push('Last name cannot exceed 50 characters')
    }
    if (data.mobilephone && data.mobilephone.length > 50) {
        errors.push('Mobile phone cannot exceed 50 characters')
    }

    // Sanitize HTML/script content
    const dangerousPattern = /<script|<iframe|javascript:|data:/i
    if (dangerousPattern.test(data.firstname || '') ||
        dangerousPattern.test(data.lastname || '') ||
        dangerousPattern.test(data.mobilephone || '')) {
        errors.push('Invalid characters detected in input')
    }

    return errors
}

function checkRateLimit(userEmail) {
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute
    const maxRequests = 100 // Increased to 100 requests per minute per user (reasonable for normal usage)

    const userRequests = rateLimits.get(userEmail) || []
    const recentRequests = userRequests.filter(time => now - time < windowMs)

    if (recentRequests.length >= maxRequests) {
        throw new Error('Rate limit exceeded. Please try again later.')
    }

    // Clean up old entries
    rateLimits.set(userEmail, [...recentRequests, now])

    // Cleanup old entries periodically
    if (rateLimits.size > 1000) {
        const cutoff = now - windowMs
        for (const [email, requests] of rateLimits.entries()) {
            const validRequests = requests.filter(time => time > cutoff)
            if (validRequests.length === 0) {
                rateLimits.delete(email)
            } else {
                rateLimits.set(email, validRequests)
            }
        }
    }
}

export const handler = async (event) => {
    // Get origin for CORS
    const origin = event.headers?.origin || event.headers?.Origin || null
    
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: getSecureCorsHeaders(origin),
            body: '',
        }
    }

    try {
        // SECURITY: Validate user authentication first
        let user
        try {
            user = await validateUser(event)
        } catch (authError) {
            return createAuthErrorResponse(authError.message, 401, origin)
        }

        const { userEmail } = user

        // Security: Check request size limit (1MB)
        const maxBodySize = 1024 * 1024 // 1MB
        if (event.body && Buffer.byteLength(event.body, 'utf8') > maxBodySize) {
            return createAuthErrorResponse('Request payload too large', 413, origin)
        }

        // Security: Rate limiting per authenticated user
        try {
            checkRateLimit(userEmail)
        } catch (rateLimitError) {
            return {
                statusCode: 429,
                headers: {
                    ...getSecureCorsHeaders(origin),
                    'Retry-After': '60',
                },
                body: JSON.stringify({ error: rateLimitError.message }),
            }
        }

        // Get environment variables
        const { DATAVERSE_URL, CONTACT_VIEW_GUID, CONTACT_FORM_GUID } = process.env

        if (!DATAVERSE_URL) {
            console.error('Missing DATAVERSE_URL environment variable')
            return createAuthErrorResponse('Server configuration error', 500, origin)
        }

        // Log available environment variables for debugging (first occurrence)
        console.log(`🔧 Environment check - DATAVERSE_URL: ${DATAVERSE_URL ? 'Set' : 'Missing'}`)
        console.log(`🔧 Environment check - CONTACT_VIEW_GUID: ${CONTACT_VIEW_GUID ? 'Set' : 'Missing'}`)
        console.log(`🔧 Environment check - CONTACT_FORM_GUID: ${CONTACT_FORM_GUID ? 'Set' : 'Missing'}`)

        // Get access token by calling our auth function
        const accessToken = await getAccessToken()
        if (!accessToken) {
            return createAuthErrorResponse('Failed to obtain access token', 500, origin)
        }

        // Get user's admin status
        const isAdmin = await getUserAdminStatus(userEmail)

        // Handle GET request - find contact by email
        if (event.httpMethod === 'GET') {
            const requestedEmail = event.queryStringParameters?.email

            if (!requestedEmail) {
                return createAuthErrorResponse('Email parameter is required', 400, origin)
            }

            // SECURITY: Ensure user can only access their own contact data (unless admin)
            if (!isAdmin && requestedEmail.toLowerCase() !== userEmail.toLowerCase()) {
                return createAuthErrorResponse('Access denied: Can only access your own contact', 403, origin)
            }

            console.log(`${isAdmin ? 'Admin' : 'User'} ${userEmail} looking up contact: ${requestedEmail}`)

            // Security: Use secure email sanitization and filter building
            const sanitizedEmail = sanitizeEmail(requestedEmail)
            const filter = buildSecureEmailFilter(sanitizedEmail)
            // Include account information for organization features
            const select = 'contactid,firstname,lastname,emailaddress1,mobilephone,createdon,modifiedon,cp_portaladmin,_parentcustomerid_value'
            const url = `${DATAVERSE_URL}/api/data/v9.0/contacts?$filter=${encodeURIComponent(filter)}&$select=${select}`

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'OData-MaxVersion': '4.0',
                    'OData-Version': '4.0',
                    'Accept': 'application/json',
                },
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error('Dataverse GET request failed:', response.status, errorText)
                return createAuthErrorResponse('Failed to fetch contact from Dataverse', response.status, origin)
            }

            const data = await response.json()
            const contact = data.value && data.value.length > 0 ? data.value[0] : null

            console.log(`Found ${data.value?.length || 0} contacts for email: ${requestedEmail}`)

            return createSuccessResponse({
                contact,
                found: !!contact,
                isAdmin
            }, 200, origin)
        }

        // Handle POST request - create or update contact
        if (event.httpMethod === 'POST') {
            let contactData
            try {
                contactData = JSON.parse(event.body || '{}')
            } catch (parseError) {
                return createAuthErrorResponse('Invalid JSON in request body', 400, origin)
            }

            // Security: Validate all input data with authenticated user context
            const validationErrors = validateContactData(contactData, userEmail)
            if (validationErrors.length > 0) {
                return createAuthErrorResponse(`Validation failed: ${validationErrors.join(', ')}`, 400, origin)
            }

            // Prepare contact data for Dataverse (sanitized)
            const contact = {
                firstname: (contactData.firstname || '').trim().substring(0, 50),
                lastname: (contactData.lastname || '').trim().substring(0, 50),
                emailaddress1: sanitizeEmail(contactData.emailaddress1),
                mobilephone: (contactData.mobilephone || '').trim().substring(0, 50),
            }

            let response
            let result

            // Update existing contact
            if (contactData.contactid) {
                console.log(`Authenticated user ${userEmail} updating contact: ${contactData.contactid}`)

                const url = `${DATAVERSE_URL}/api/data/v9.0/contacts(${contactData.contactid})`

                response = await fetch(url, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'OData-MaxVersion': '4.0',
                        'OData-Version': '4.0',
                    },
                    body: JSON.stringify(contact),
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    console.error('Dataverse PATCH request failed:', response.status, errorText)
                    return createAuthErrorResponse('Failed to update contact in Dataverse', response.status, origin)
                }

                // For PATCH requests, return the updated contact
                result = { ...contact, contactid: contactData.contactid }
                console.log(`Contact updated successfully for user: ${userEmail}`)

            } else {
                // Create new contact
                console.log(`Authenticated user ${userEmail} creating new contact`)

                const url = `${DATAVERSE_URL}/api/data/v9.0/contacts`

                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'OData-MaxVersion': '4.0',
                        'OData-Version': '4.0',
                        'Prefer': 'return=representation',
                    },
                    body: JSON.stringify(contact),
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    console.error('Dataverse POST request failed:', response.status, errorText)
                    return createAuthErrorResponse('Failed to create contact in Dataverse', response.status, origin)
                }

                result = await response.json()
                console.log(`Contact created successfully for user ${userEmail} with ID:`, result.contactid)
            }

            return createSuccessResponse({
                contact: result,
                created: !contactData.contactid,
                isAdmin
            }, 200, origin)
        }

        // Method not allowed
        return createAuthErrorResponse('Method not allowed', 405, origin)

    } catch (error) {
        console.error('Contact function error:', error)
        return createAuthErrorResponse('Internal server error', 500, origin)
    }
}

/**
 * Helper function to get access token from our auth function
 */
async function getAccessToken() {
    try {
        // In a Netlify function, we can call other functions directly
        const { handler: authHandler } = await import('./auth.js')

        // Create a mock event for the auth function
        const authEvent = {
            httpMethod: 'POST',
            body: '',
            queryStringParameters: null,
        }

        const authResult = await authHandler(authEvent, {})

        if (authResult.statusCode === 200) {
            const authData = JSON.parse(authResult.body)
            return authData.access_token
        } else {
            console.error('Auth function failed:', authResult.statusCode, authResult.body)
            return null
        }

    } catch (error) {
        console.error('Error getting access token:', error)
        return null
    }
}

/**
 * Helper function to check if user has admin privileges
 */
async function getUserAdminStatus(userEmail) {
    try {
        const accessToken = await getAccessToken()
        if (!accessToken) return false

        const { DATAVERSE_URL, CONTACT_VIEW_GUID, CONTACT_FORM_GUID } = process.env
        const filter = buildSecureEmailFilter(userEmail)
        const url = `${DATAVERSE_URL}/api/data/v9.0/contacts?$filter=${encodeURIComponent(filter)}&$select=cp_portaladmin`

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Accept': 'application/json',
            },
        })

        if (response.ok) {
            const data = await response.json()
            const isAdmin = data.value?.[0]?.cp_portaladmin || false
            console.log(`User ${userEmail} admin status: ${isAdmin}`)
            return isAdmin
        }
        
        console.log(`Could not determine admin status for ${userEmail}, defaulting to false`)
        return false
    } catch (error) {
        console.error('Error checking admin status:', error)
        return false // Default to non-admin on error
    }
}
