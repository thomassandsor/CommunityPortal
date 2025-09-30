/**
 * Netlify Function: auth.js
 * 
 * Handles authentication with Microsoft Dataverse using OAuth 2.0 Client Credentials Flow.
 * This function exchanges CLIENT_ID + CLIENT_SECRET + TENANT_ID for a Dataverse access token.
 * 
 * The Service Principal (App Registration) approach is used for secure, production-ready
 * authentication that doesn't require user delegation.
 * 
 * SECURITY FEATURES:
 * - Token caching to prevent excessive token requests
 * - Secure token expiry handling
 * - Environment variable validation
 * - Request logging without sensitive data
 * - Secure CORS configuration
 * - Request timeout protection (10s for auth endpoints)
 */

import { getSecureCorsHeaders, fetchWithTimeout } from './auth-utils.js'

// In-memory token cache (use Redis/database in production for multi-instance deployments)
let tokenCache = {
    token: null,
    expiry: null,
    scope: null
}

export const handler = async (event) => {
    // Get origin for CORS
    const origin = event.headers?.origin || event.headers?.Origin || null
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: getSecureCorsHeaders(origin),
            body: JSON.stringify({ error: 'Method not allowed' }),
        }
    }

    try {
        // Get environment variables
        const {
            TENANT_ID,
            CLIENT_ID,
            CLIENT_SECRET,
            DATAVERSE_URL
        } = process.env

        // Validate required environment variables
        if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !DATAVERSE_URL) {
            console.error('Missing required environment variables')
            return {
                statusCode: 500,
                headers: getSecureCorsHeaders(origin),
                body: JSON.stringify({
                    error: 'Server configuration error: Missing required environment variables'
                }),
            }
        }

        const currentScope = `${DATAVERSE_URL}/.default`

        // Check if we have a valid cached token
        if (tokenCache.token &&
            tokenCache.expiry &&
            tokenCache.expiry > Date.now() &&
            tokenCache.scope === currentScope) {

            console.log('Returning cached access token')
            return {
                statusCode: 200,
                headers: getSecureCorsHeaders(origin),
                body: JSON.stringify({
                    access_token: tokenCache.token,
                    expires_in: Math.floor((tokenCache.expiry - Date.now()) / 1000),
                    token_type: 'Bearer',
                    cached: true
                }),
            }
        }

        // Construct the token endpoint URL
        const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`

        // Prepare the request body for client credentials flow
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            scope: currentScope
        })

        console.log('Requesting new access token from Azure AD...')

        // Make the token request with 10-second timeout (auth endpoints should be fast)
        const response = await fetchWithTimeout(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString()
        }, 10000) // 10 second timeout for auth requests

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Token request failed:', response.status, errorText)

            return {
                statusCode: 401,
                headers: getSecureCorsHeaders(origin),
                body: JSON.stringify({
                    error: 'Authentication failed',
                    details: `Token request failed with status ${response.status}`
                }),
            }
        }

        const tokenData = await response.json()

        // Validate that we received an access token
        if (!tokenData.access_token) {
            console.error('No access token in response')
            return {
                statusCode: 401,
                headers: getSecureCorsHeaders(origin),
                body: JSON.stringify({
                    error: 'Authentication failed',
                    details: 'No access token received'
                }),
            }
        }

        // Cache the token with proper expiry (subtract 60 seconds for safety buffer)
        const expiresIn = tokenData.expires_in || 3600
        tokenCache = {
            token: tokenData.access_token,
            expiry: Date.now() + (expiresIn * 1000) - 60000, // 60 second buffer
            scope: currentScope
        }

        console.log('Successfully obtained and cached new access token')

        // Return the access token
        return {
            statusCode: 200,
            headers: getSecureCorsHeaders(origin),
            body: JSON.stringify({
                access_token: tokenData.access_token,
                expires_in: expiresIn,
                token_type: tokenData.token_type || 'Bearer',
                cached: false
            }),
        }

    } catch (error) {
        console.error('Auth function error:', error)
        
        // 🔒 SECURITY: Handle timeout errors explicitly
        if (error.isTimeout) {
            return {
                statusCode: 504,
                headers: getSecureCorsHeaders(origin),
                body: JSON.stringify({
                    error: 'Gateway timeout',
                    details: 'Authentication request timed out. Please try again.'
                }),
            }
        }

        return {
            statusCode: 500,
            headers: getSecureCorsHeaders(origin),
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message
            }),
        }
    }
}
