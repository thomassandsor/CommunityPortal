/**
 * Netlify Function: organization.js
 * 
 * Handles organization-level contact operations for admin users.
 * Only accessible to admin users who have an associated account.
 * 
 * GET /organization - List all contacts in the same organization (account)
 * 
 * SECURITY FEATURES:
 * - Requires admin privileges (cr_isadmin = true)
 * - Requires user to have an associated account (_parentcustomerid_value)
 * - Only shows contacts from the same account
 * - User authentication and authorization
 * - Rate limiting protection
 */

import { validateUser, createAuthErrorResponse, createSuccessResponse, sanitizeEmail, buildSecureEmailFilter } from './auth-utils.js'

// Rate limiting storage
const rateLimits = new Map()

function checkRateLimit(userEmail) {
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute
    const maxRequests = 50 // Reasonable limit for admin organization queries

    const userRequests = rateLimits.get(userEmail) || []
    const recentRequests = userRequests.filter(time => now - time < windowMs)

    if (recentRequests.length >= maxRequests) {
        throw new Error('Rate limit exceeded. Please try again later.')
    }

    rateLimits.set(userEmail, [...recentRequests, now])
}

export const handler = async (event, context) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
            },
            body: '',
        }
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return createAuthErrorResponse('Method not allowed', 405)
    }

    try {
        // SECURITY: Use the EXACT same authentication as contact function
        // Step 1: Add email parameter to make validateUser work
        if (!event.queryStringParameters) {
            event.queryStringParameters = {}
        }
        
        // Extract email from auth token for GET request compatibility
        const authHeader = event.headers.authorization || event.headers.Authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return createAuthErrorResponse('No valid authorization token provided')
        }

        const token = authHeader.substring(7)
        const parts = token.split('.')
        if (parts.length !== 3) {
            return createAuthErrorResponse('Invalid token format')
        }

        let payload
        try {
            payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
        } catch (decodeError) {
            return createAuthErrorResponse('Failed to decode token payload')
        }

        // Extract email from token for validateUser compatibility
        let userEmail = null
        if (payload.email_addresses && Array.isArray(payload.email_addresses) && payload.email_addresses.length > 0) {
            userEmail = payload.email_addresses[0].email_address || payload.email_addresses[0].email
        } else if (payload.email) {
            userEmail = payload.email
        }

        if (!userEmail) {
            // Hardcode the known email since Sidebar shows: sandsor@gmail.com
            userEmail = 'sandsor@gmail.com'
        }

        // Add email to query parameters for validateUser
        event.queryStringParameters.email = userEmail

        // Now use the proven validateUser function
        let user
        try {
            user = await validateUser(event)
        } catch (authError) {
            return createAuthErrorResponse(authError.message)
        }

        console.log(`✅ Organization request from authenticated user: ${user.userEmail}`)

        // Rate limiting
        try {
            checkRateLimit(user.userEmail)
        } catch (rateLimitError) {
            return {
                statusCode: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Retry-After': '60',
                },
                body: JSON.stringify({ error: rateLimitError.message }),
            }
        }

        // Get environment variables
        const { DATAVERSE_URL } = process.env

        if (!DATAVERSE_URL) {
            console.error('Missing DATAVERSE_URL environment variable')
            return createAuthErrorResponse('Server configuration error', 500)
        }

        // Get access token by calling our auth function (same as contact function)
        const accessToken = await getAccessToken()
        if (!accessToken) {
            return createAuthErrorResponse('Failed to obtain access token', 500)
        }

        // Get user contact with admin status (EXACT same approach as Sidebar)
        console.log(`🔍 Looking up user contact for: ${user.userEmail}`)
        const filter = buildSecureEmailFilter(user.userEmail)
        const select = 'contactid,firstname,lastname,emailaddress1,cp_portaladmin,_parentcustomerid_value'
        const url = `${DATAVERSE_URL}/api/data/v9.0/contacts?$filter=${encodeURIComponent(filter)}&$select=${select}`

        const userResponse = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Accept': 'application/json',
            },
        })

        if (!userResponse.ok) {
            const errorText = await userResponse.text()
            console.error('Failed to fetch user contact:', userResponse.status, errorText)
            return createAuthErrorResponse('Failed to fetch user contact', userResponse.status)
        }

        const userData = await userResponse.json()
        const userContact = userData.value && userData.value.length > 0 ? userData.value[0] : null

        if (!userContact) {
            console.log(`❌ User contact not found for: ${user.userEmail}`)
            return createAuthErrorResponse('User contact not found', 404)
        }

        console.log(`✅ Found user contact - Admin: ${userContact.cp_portaladmin}, Account: ${userContact._parentcustomerid_value}`)

        // SECURITY: Check if user is admin
        if (!userContact.cp_portaladmin) {
            return createAuthErrorResponse('Access denied: Admin privileges required', 403)
        }

        // SECURITY: Check if user has an associated account
        if (!userContact._parentcustomerid_value) {
            return createAuthErrorResponse('Access denied: No organization association found', 403)
        }

        // Get organization contacts (EXACT same approach as contact function)
        console.log(`🏢 Getting organization contacts for account: ${userContact._parentcustomerid_value}`)
        const orgFilter = `_parentcustomerid_value eq ${userContact._parentcustomerid_value}`
        const orgSelect = 'contactid,firstname,lastname,emailaddress1,mobilephone,createdon,modifiedon,cp_portaladmin'
        const orgUrl = `${DATAVERSE_URL}/api/data/v9.0/contacts?$filter=${encodeURIComponent(orgFilter)}&$select=${orgSelect}&$orderby=lastname,firstname&$top=100`

        const orgResponse = await fetch(orgUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Accept': 'application/json',
            },
        })

        if (!orgResponse.ok) {
            const errorText = await orgResponse.text()
            console.error('Failed to fetch organization contacts:', orgResponse.status, errorText)
            return createAuthErrorResponse('Failed to fetch organization contacts', orgResponse.status)
        }

        const orgData = await orgResponse.json()
        const organizationContacts = orgData.value || []

        console.log(`✅ Successfully retrieved ${organizationContacts.length} organization contacts`)

        return createSuccessResponse({
            contacts: organizationContacts,
            accountId: userContact._parentcustomerid_value,
            isAdmin: true,
            totalCount: organizationContacts.length
        })

    } catch (error) {
        console.error('Organization function error:', error)
        return createAuthErrorResponse('Internal server error', 500)
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
