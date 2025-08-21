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
 * - Input validation and sanitization
 * - Rate limiting protection
 * - Secure OData query building
 * - Request size limits
 */

// Rate limiting storage (in production, use Redis or similar)
const rateLimits = new Map()

// Security helper functions
function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email) && email.length <= 254
}

function validateContactData(data) {
    const errors = []

    // Required fields
    if (!data.emailaddress1?.trim()) {
        errors.push('Email address is required')
    } else if (!validateEmail(data.emailaddress1)) {
        errors.push('Invalid email format')
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

function buildSecureODataFilter(email) {
    // Validate email first
    if (!validateEmail(email)) {
        throw new Error('Invalid email format for filter')
    }

    // Proper OData escaping - escape quotes and percent signs
    const escapedEmail = email
        .replace(/'/g, "''")    // Escape single quotes
        .replace(/%/g, '%25')   // Escape percent signs

    return `emailaddress1 eq '${escapedEmail}'`
}

function checkRateLimit(clientIP) {
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute
    const maxRequests = 30 // 30 requests per minute per IP

    if (!clientIP) clientIP = 'unknown'

    const userRequests = rateLimits.get(clientIP) || []
    const recentRequests = userRequests.filter(time => now - time < windowMs)

    if (recentRequests.length >= maxRequests) {
        throw new Error('Rate limit exceeded. Please try again later.')
    }

    // Clean up old entries
    rateLimits.set(clientIP, [...recentRequests, now])

    // Cleanup old IPs periodically
    if (rateLimits.size > 1000) {
        const cutoff = now - windowMs
        for (const [ip, requests] of rateLimits.entries()) {
            const validRequests = requests.filter(time => time > cutoff)
            if (validRequests.length === 0) {
                rateLimits.delete(ip)
            } else {
                rateLimits.set(ip, validRequests)
            }
        }
    }
}

export const handler = async (event, context) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
            body: '',
        }
    }

    try {
        // Security: Check request size limit (1MB)
        const maxBodySize = 1024 * 1024 // 1MB
        if (event.body && Buffer.byteLength(event.body, 'utf8') > maxBodySize) {
            return {
                statusCode: 413,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({ error: 'Request payload too large' }),
            }
        }

        // Security: Rate limiting
        const clientIP = event.headers['x-forwarded-for']?.split(',')[0] ||
            event.headers['x-real-ip'] ||
            'unknown'

        try {
            checkRateLimit(clientIP)
        } catch (rateLimitError) {
            return {
                statusCode: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Retry-After': '60',
                },
                body: JSON.stringify({ error: rateLimitError.message }),
            }
        }

        // Get environment variables
        const { DATAVERSE_URL } = process.env

        if (!DATAVERSE_URL) {
            console.error('Missing DATAVERSE_URL environment variable')
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Server configuration error: Missing DATAVERSE_URL'
                }),
            }
        }

        // Get access token by calling our auth function
        const accessToken = await getAccessToken()
        if (!accessToken) {
            return {
                statusCode: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({ error: 'Failed to obtain access token' }),
            }
        }

        // Handle GET request - find contact by email
        if (event.httpMethod === 'GET') {
            const email = event.queryStringParameters?.email

            if (!email) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({ error: 'Email parameter is required' }),
                }
            }

            // Security: Validate email format
            if (!validateEmail(email)) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({ error: 'Invalid email format' }),
                }
            }

            console.log(`Looking up contact for email: ${email}`)

            // Security: Use secure OData filter building
            const filter = buildSecureODataFilter(email)
            const select = 'contactid,firstname,lastname,emailaddress1,mobilephone,createdon,modifiedon'
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

                return {
                    statusCode: response.status,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        error: 'Failed to fetch contact from Dataverse',
                        details: errorText
                    }),
                }
            }

            const data = await response.json()
            const contact = data.value && data.value.length > 0 ? data.value[0] : null

            console.log(`Found ${data.value?.length || 0} contacts for email: ${email}`)

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    contact,
                    found: !!contact
                }),
            }
        }

        // Handle POST request - create or update contact
        if (event.httpMethod === 'POST') {
            let contactData
            try {
                contactData = JSON.parse(event.body || '{}')
            } catch (parseError) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({ error: 'Invalid JSON in request body' }),
                }
            }

            // Security: Validate all input data
            const validationErrors = validateContactData(contactData)
            if (validationErrors.length > 0) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    body: JSON.stringify({
                        error: 'Validation failed',
                        details: validationErrors
                    }),
                }
            }

            // Prepare contact data for Dataverse (sanitized)
            const contact = {
                firstname: (contactData.firstname || '').trim().substring(0, 50),
                lastname: (contactData.lastname || '').trim().substring(0, 50),
                emailaddress1: contactData.emailaddress1.trim(),
                mobilephone: (contactData.mobilephone || '').trim().substring(0, 50),
            }

            let response
            let result            // Update existing contact
            if (contactData.contactid) {
                console.log(`Updating contact: ${contactData.contactid}`)

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

                    return {
                        statusCode: response.status,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            error: 'Failed to update contact in Dataverse',
                            details: errorText
                        }),
                    }
                }

                // For PATCH requests, return the updated contact
                result = { ...contact, contactid: contactData.contactid }
                console.log('Contact updated successfully')

            } else {
                // Create new contact
                console.log(`Creating new contact for email: ${contact.emailaddress1}`)

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

                    return {
                        statusCode: response.status,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        },
                        body: JSON.stringify({
                            error: 'Failed to create contact in Dataverse',
                            details: errorText
                        }),
                    }
                }

                result = await response.json()
                console.log('Contact created successfully with ID:', result.contactid)
            }

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    contact: result,
                    created: !contactData.contactid
                }),
            }
        }

        // Method not allowed
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Method not allowed' }),
        }

    } catch (error) {
        console.error('Contact function error:', error)

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message
            }),
        }
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
