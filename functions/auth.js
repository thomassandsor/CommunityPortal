/**
 * Netlify Function: auth.js
 * 
 * Handles authentication with Microsoft Dataverse using OAuth 2.0 Client Credentials Flow.
 * This function exchanges CLIENT_ID + CLIENT_SECRET + TENANT_ID for a Dataverse access token.
 * 
 * The Service Principal (App Registration) approach is used for secure, production-ready
 * authentication that doesn't require user delegation.
 */

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Server configuration error: Missing required environment variables' 
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
      console.error('Token request failed:', response.status, errorText)
      
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Authentication failed',
          details: `Token request failed with status ${response.status}`
        }),
      }
    }

    const tokenData = await response.json()
    
    // Validate that we received an access token
    if (!tokenData.access_token) {
      console.error('No access token in response:', tokenData)
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Authentication failed',
          details: 'No access token received'
        }),
      }
    }

    console.log('Successfully obtained access token')
    
    // Return the access token (expires_in is typically 3600 seconds = 1 hour)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type || 'Bearer'
      }),
    }

  } catch (error) {
    console.error('Auth function error:', error)
    
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
