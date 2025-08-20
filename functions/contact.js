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
 */

exports.handler = async (event, context) => {
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

      console.log(`Looking up contact for email: ${email}`)
      
      // Query Dataverse for contact with matching email
      const filter = `emailaddress1 eq '${email.replace(/'/g, "''")}'`
      const select = 'contactid,firstname,lastname,emailaddress1,telephone1,createdon,modifiedon'
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
      const contactData = JSON.parse(event.body || '{}')
      
      // Validate required fields
      if (!contactData.emailaddress1) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Email address is required' }),
        }
      }

      // Prepare contact data for Dataverse
      const contact = {
        firstname: contactData.firstname || '',
        lastname: contactData.lastname || '',
        emailaddress1: contactData.emailaddress1,
        telephone1: contactData.telephone1 || '',
      }

      let response
      let result

      // Update existing contact
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
    const authFunction = require('./auth')
    
    // Create a mock event for the auth function
    const authEvent = {
      httpMethod: 'POST',
      body: '',
      queryStringParameters: null,
    }
    
    const authResult = await authFunction.handler(authEvent, {})
    
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
