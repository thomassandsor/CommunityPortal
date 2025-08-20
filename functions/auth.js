/**
 * Netlify Function: auth.js
 * 
 * Handles authentication with Microsoft Dataverse using OAuth 2.0 Client Credentials Flow.
 * This function exchanges CLIENT_ID + CLIENT_SECRET + TENANT_ID for a Dataverse access token.
 * 
 * The Service Principal (App Registration) approach is used for secure, production-ready
 * authentication that doesn't require user delegation.
 * 
 * Security features:
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
    buildResponse 
} from './security-utils.js';

export const handler = async (event) => {
    const origin = event.headers.origin;
    
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return buildResponse(200, {}, origin);
    }
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return buildResponse(405, { error: 'Method not allowed' }, origin);
    }
    
    // Rate limiting - use IP address as identifier
    const clientIP = event.headers['x-forwarded-for'] || 
                     event.headers['x-real-ip'] || 
                     'unknown';
    
    const rateLimit = checkRateLimit(`auth:${clientIP}`, 20); // 20 requests per 15min window
    
    if (!rateLimit.allowed) {
        SecureLogger.info('Rate limit exceeded for auth function', { ip: clientIP });
        return buildResponse(429, { 
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        }, origin);
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
            SecureLogger.error('Missing required environment variables');
            return buildResponse(500, {
                error: 'Server configuration error'
            }, origin);
        }

        // Construct the token endpoint URL
        const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`

        // Prepare the request body for client credentials flow
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            scope: `${DATAVERSE_URL}/.default`
        })

        console.log('Requesting access token from Azure AD...')

        // Make the token request
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString()
        })

        if (!response.ok) {
            const errorText = await response.text()
            SecureLogger.error('Token request failed', { 
                status: response.status,
                // Don't log the full error text in production 
                errorPreview: process.env.NODE_ENV === 'development' ? errorText : 'Error details hidden'
            });

            return buildResponse(401, sanitizeError({
                message: 'Authentication failed',
                status: response.status
            }), origin);
        }

        const tokenData = await response.json()

        // Validate that we received an access token
        if (!tokenData.access_token) {
            SecureLogger.error('No access token in response');
            return buildResponse(401, sanitizeError({
                message: 'Authentication failed'
            }), origin);
        }

        SecureLogger.info('Successfully obtained access token');

        // Return the access token (expires_in is typically 3600 seconds = 1 hour)
        return buildResponse(200, {
            access_token: tokenData.access_token,
            expires_in: tokenData.expires_in,
            token_type: tokenData.token_type || 'Bearer'
        }, origin);

    } catch (error) {
        SecureLogger.error('Auth function error', { message: error.message });

        return buildResponse(500, sanitizeError({
            message: 'Internal server error'
        }), origin);
    }
}
