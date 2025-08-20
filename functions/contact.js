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
 * Security features:
 * - Input validation and sanitization
 * - Rate limiting protection  
 * - Error message sanitization
 * - Secure logging
 * - CORS policy enforcement
 * - Security headers
 */

import { 
    sanitizeError, 
    SecureLogger, 
    checkRateLimit, 
    buildResponse,
    InputValidator 
} from './security-utils.js';

export const handler = async (event) => {
    const origin = event.headers.origin;
    
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return buildResponse(200, {}, origin);
    }
    
    // Rate limiting - use IP address as identifier
    const clientIP = event.headers['x-forwarded-for'] || 
                     event.headers['x-real-ip'] || 
                     'unknown';
    
    const rateLimit = checkRateLimit(`contact:${clientIP}`, 50); // 50 requests per 15min window
    
    if (!rateLimit.allowed) {
        SecureLogger.info('Rate limit exceeded for contact function', { ip: clientIP });
        return buildResponse(429, { 
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        }, origin);
    }

    try {
        // Get environment variables
        const { DATAVERSE_URL } = process.env

        if (!DATAVERSE_URL) {
            SecureLogger.error('Missing DATAVERSE_URL environment variable');
            return buildResponse(500, {
                error: 'Server configuration error'
            }, origin);
        }

        // Get access token by calling our auth function
        const accessToken = await getAccessToken()
        if (!accessToken) {
            return buildResponse(401, { 
                error: 'Failed to obtain access token' 
            }, origin);
        }

        // Handle GET request - find contact by email
        if (event.httpMethod === 'GET') {
            const email = event.queryStringParameters?.email

            // Validate email parameter
            if (!email || !InputValidator.email(email)) {
                return buildResponse(400, { 
                    error: 'Valid email parameter is required' 
                }, origin);
            }

            SecureLogger.debug('Looking up contact for email (redacted)');

            // Query Dataverse for contact with matching email
            const filter = `emailaddress1 eq '${email.replace(/'/g, "''")}'`
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
                SecureLogger.error('Dataverse GET request failed', { 
                    status: response.status,
                    errorPreview: process.env.NODE_ENV === 'development' ? errorText : 'Error details hidden'
                });

                return buildResponse(response.status, sanitizeError({
                    message: 'Failed to fetch contact from Dataverse',
                    status: response.status
                }), origin);
            }
                    }),
                }
            }

            const data = await response.json()
            const contact = data.value && data.value.length > 0 ? data.value[0] : null

            SecureLogger.debug('Contact lookup completed', { found: !!contact });

            return buildResponse(200, {
                contact,
                found: !!contact
            }, origin);
        }

        // Handle POST request - create or update contact
        if (event.httpMethod === 'POST') {
            const contactData = JSON.parse(event.body || '{}')

            // Validate and sanitize input data
            const validation = InputValidator.validateContactData(contactData);
            if (!validation.isValid) {
                return buildResponse(400, { 
                    error: 'Invalid input data',
                    details: validation.errors
                }, origin);
            }

            // Use sanitized data
            const contact = validation.sanitized;

            let response
            let result
            
            // Update existing contact
            if (contactData.contactid) {
                SecureLogger.debug('Updating existing contact');

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
                    SecureLogger.error('Dataverse PATCH request failed', { 
                        status: response.status,
                        errorPreview: process.env.NODE_ENV === 'development' ? errorText : 'Error details hidden'
                    });

                    return buildResponse(response.status, sanitizeError({
                        message: 'Failed to update contact in Dataverse',
                        status: response.status
                    }), origin);
                }

                // For PATCH requests, return the updated contact
                result = { ...contact, contactid: contactData.contactid }
                SecureLogger.info('Contact updated successfully');

            } else {
                // Create new contact
                SecureLogger.debug('Creating new contact');

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
                    SecureLogger.error('Dataverse POST request failed', { 
                        status: response.status,
                        errorPreview: process.env.NODE_ENV === 'development' ? errorText : 'Error details hidden'
                    });

                    return buildResponse(response.status, sanitizeError({
                        message: 'Failed to create contact in Dataverse',
                        status: response.status
                    }), origin);
                }

                result = await response.json()
                SecureLogger.info('Contact created successfully');
            }

            return buildResponse(200, {
                contact: result,
                created: !contactData.contactid
            }, origin);
        }

        // Method not allowed
        return buildResponse(405, { 
            error: 'Method not allowed' 
        }, origin);

    } catch (error) {
        SecureLogger.error('Contact function error', { message: error.message });

        return buildResponse(500, sanitizeError({
            message: 'Internal server error'
        }), origin);
    }
}
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
            headers: {}
        }

        const authResult = await authHandler(authEvent)

        if (authResult.statusCode === 200) {
            const authData = JSON.parse(authResult.body)
            return authData.access_token
        } else {
            SecureLogger.error('Auth function failed', { status: authResult.statusCode });
            return null
        }

    } catch (error) {
        SecureLogger.error('Error getting access token', { message: error.message });
        return null
    }
}
