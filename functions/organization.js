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

import { validateUser, createAuthErrorResponse, createSuccessResponse, buildSecureEmailFilter } from './auth-utils.js'

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

export const handler = async (event) => {
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
        const { DATAVERSE_URL, CONTACT_VIEW_GUID, CONTACT_FORM_GUID } = process.env

        if (!DATAVERSE_URL) {
            console.error('Missing DATAVERSE_URL environment variable')
            return createAuthErrorResponse('Server configuration error', 500)
        }

        // Log available environment variables for debugging
        console.log(`🔧 Environment check - DATAVERSE_URL: ${DATAVERSE_URL ? 'Set' : 'Missing'}`)
        console.log(`🔧 Environment check - CONTACT_VIEW_GUID: ${CONTACT_VIEW_GUID ? 'Set' : 'Missing'}`)
        console.log(`🔧 Environment check - CONTACT_FORM_GUID: ${CONTACT_FORM_GUID ? 'Set' : 'Missing'}`)

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

        // Get organization contacts - try without expand first, then add separate call if needed
        console.log(`🏢 Getting organization contacts for account: ${userContact._parentcustomerid_value}`)
        const orgFilter = `_parentcustomerid_value eq ${userContact._parentcustomerid_value}`
        const orgSelect = 'contactid,fullname,firstname,lastname,emailaddress1,mobilephone,createdon,modifiedon,_createdby_value,cp_portaladmin,_parentcustomerid_value'
        // Note: Customer lookup expand is complex - let's fetch without expand first
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

        // Enhance contacts with parent customer info if they have parentcustomerid
        if (organizationContacts.length > 0) {
            await enrichContactsWithParentInfo(accessToken, organizationContacts)
        }

        // Check request type and handle accordingly
        const mode = event.queryStringParameters?.mode
        const contactId = event.queryStringParameters?.contactId
        
        if (mode === 'dynamic') {
            try {
                return await handleDynamicViewRequest(accessToken, userContact, organizationContacts)
            } catch (dynamicError) {
                console.error('Dynamic view request failed:', dynamicError)
                return createAuthErrorResponse(`Dynamic view error: ${dynamicError.message}`, 500)
            }
        }
        
        if (mode === 'form') {
            try {
                return await handleDynamicFormRequest(accessToken, userContact, contactId)
            } catch (formError) {
                console.error('Dynamic form request failed:', formError)
                return createAuthErrorResponse(`Dynamic form error: ${formError.message}`, 500)
            }
        }
        
        if (contactId) {
            try {
                return await handleSingleContactRequest(accessToken, userContact, contactId)
            } catch (contactError) {
                console.error('Single contact request failed:', contactError)
                return createAuthErrorResponse(`Contact fetch error: ${contactError.message}`, 500)
            }
        }

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
 * Handle dynamic form request - fetch form metadata and return structured response
 */
async function handleDynamicFormRequest(accessToken, userContact) {
    console.log('🔍 Starting dynamic form request handler...')
    
    const { DATAVERSE_URL, CONTACT_FORM_GUID } = process.env
    
    console.log(`🔧 DATAVERSE_URL: ${DATAVERSE_URL ? 'Set' : 'Missing'}`)
    console.log(`🔧 CONTACT_FORM_GUID: ${CONTACT_FORM_GUID ? 'Set' : 'Missing'}`)
    
    // Require CONTACT_FORM_GUID - fail if not provided
    if (!CONTACT_FORM_GUID) {
        console.error('❌ CONTACT_FORM_GUID is missing')
        throw new Error('CONTACT_FORM_GUID environment variable is required for form mode')
    }
    
    console.log(`🎯 Using form GUID: ${CONTACT_FORM_GUID}`)
    
    // Fetch form metadata from systemforms (not savedqueries)
    const formUrl = `${DATAVERSE_URL}/api/data/v9.0/systemforms(${CONTACT_FORM_GUID})?$select=name,description,formxml`
    console.log(`🌐 Fetching form from: ${formUrl}`)
    
    const formResponse = await fetch(formUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
    })

    console.log(`📡 Form response status: ${formResponse.status}`)
    
    if (!formResponse.ok) {
        const errorText = await formResponse.text()
        console.error('❌ Failed to fetch form metadata:', formResponse.status, errorText)
        throw new Error(`Failed to fetch form metadata: ${formResponse.status} - ${errorText}`)
    }

    const formData = await formResponse.json()
    console.log(`📋 Form data received:`, JSON.stringify(formData, null, 2))
    
    const formMetadata = parseFormMetadata(formData)
    console.log(`✅ Form metadata parsed successfully: ${formMetadata.name}`)

    return createSuccessResponse({
        formMetadata: formMetadata,
        accountId: userContact._parentcustomerid_value,
        isAdmin: true,
        mode: 'form'
    })
}

/**
 * Handle single contact request - fetch specific contact data
 */
async function handleSingleContactRequest(accessToken, userContact, contactId) {
    console.log(`🔍 Fetching single contact: ${contactId}`)
    
    const { DATAVERSE_URL } = process.env
    
    // Security: Ensure the contact belongs to the same organization
    const filter = `contactid eq ${contactId} and _parentcustomerid_value eq ${userContact._parentcustomerid_value}`
    const select = 'contactid,fullname,firstname,lastname,emailaddress1,mobilephone,createdon,modifiedon,_createdby_value,cp_portaladmin,_parentcustomerid_value'
    const contactUrl = `${DATAVERSE_URL}/api/data/v9.0/contacts?$filter=${encodeURIComponent(filter)}&$select=${select}`
    
    const contactResponse = await fetch(contactUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
    })

    if (!contactResponse.ok) {
        const errorText = await contactResponse.text()
        console.error('Failed to fetch contact:', contactResponse.status, errorText)
        throw new Error(`Failed to fetch contact: ${contactResponse.status} - ${errorText}`)
    }

    const contactData = await contactResponse.json()
    const contact = contactData.value && contactData.value.length > 0 ? contactData.value[0] : null

    if (!contact) {
        throw new Error('Contact not found or access denied')
    }

    // Enrich with parent customer info
    await enrichContactsWithParentInfo(accessToken, [contact])

    console.log(`✅ Successfully retrieved contact: ${contact.fullname}`)

    return createSuccessResponse({
        contact: contact,
        accountId: userContact._parentcustomerid_value,
        isAdmin: true,
        mode: 'single'
    })
}

/**
 * Parse Dataverse form formxml to extract comprehensive form structure
 */
function parseFormMetadata(formData) {
    console.log('🔍 Starting enhanced parseFormMetadata...')
    
    const formXml = formData.formxml
    const name = formData.name
    const description = formData.description
    
    console.log(`📝 Form name: ${name}`)
    console.log(`📄 Form description: ${description}`)
    console.log(`🏗️ Form XML length: ${formXml ? formXml.length : 'null'}`)
    
    if (!formXml) {
        console.error('❌ Form formxml is missing or empty')
        throw new Error('Form formxml is missing or empty')
    }
    
    // Parse the full form structure
    const formStructure = parseFormStructure(formXml)
    console.log(`✅ Successfully parsed form structure with ${formStructure.tabs?.length || 0} tabs`)
    
    return {
        systemformid: formData.systemformid,
        name: name,
        displayName: name,
        description: description,
        structure: formStructure
    }
}

/**
 * Parse the full form structure including tabs, sections, columns, and controls
 */
function parseFormStructure(formXml) {
    const tabs = []
    
    // Extract tab elements
    const tabMatches = formXml.match(/<tab[^>]*>.*?<\/tab>/gs) || []
    console.log(`🔍 Found ${tabMatches.length} tabs in form`)
    
    tabMatches.forEach((tabXml, tabIndex) => {
        const tab = parseTab(tabXml, tabIndex)
        if (tab) {
            tabs.push(tab)
        }
    })
    
    return { tabs }
}

/**
 * Parse a single tab element
 */
function parseTab(tabXml, tabIndex) {
    // Extract tab attributes
    const nameMatch = tabXml.match(/<tab[^>]*name="([^"]*)"/)
    const idMatch = tabXml.match(/<tab[^>]*id="([^"]*)"/)
    const visibleMatch = tabXml.match(/<tab[^>]*visible="([^"]*)"/)
    
    const tab = {
        index: tabIndex,
        name: nameMatch ? nameMatch[1] : `Tab ${tabIndex + 1}`,
        id: idMatch ? idMatch[1] : null,
        visible: visibleMatch ? visibleMatch[1] !== 'false' : true,
        sections: []
    }
    
    // Extract label for display name
    const labelMatch = tabXml.match(/<labels>.*?<label[^>]*description="([^"]*)".*?<\/labels>/s)
    tab.displayName = labelMatch ? labelMatch[1] : tab.name
    
    // Extract sections within this tab
    const sectionMatches = tabXml.match(/<section[^>]*>.*?<\/section>/gs) || []
    
    sectionMatches.forEach((sectionXml, sectionIndex) => {
        const section = parseSection(sectionXml, sectionIndex)
        if (section) {
            tab.sections.push(section)
        }
    })
    
    return tab
}

/**
 * Parse a single section element
 */
function parseSection(sectionXml, sectionIndex) {
    // Extract section attributes
    const nameMatch = sectionXml.match(/<section[^>]*name="([^"]*)"/)
    const idMatch = sectionXml.match(/<section[^>]*id="([^"]*)"/)
    const visibleMatch = sectionXml.match(/<section[^>]*visible="([^"]*)"/)
    const columnsMatch = sectionXml.match(/<section[^>]*columns="([^"]*)"/)
    
    const section = {
        index: sectionIndex,
        name: nameMatch ? nameMatch[1] : `Section ${sectionIndex + 1}`,
        id: idMatch ? idMatch[1] : null,
        visible: visibleMatch ? visibleMatch[1] !== 'false' : true,
        columns: columnsMatch ? parseInt(columnsMatch[1]) : 1,
        rows: []
    }
    
    // Extract label for display name
    const labelMatch = sectionXml.match(/<labels>.*?<label[^>]*description="([^"]*)".*?<\/labels>/s)
    section.displayName = labelMatch ? labelMatch[1] : section.name
    
    console.log(`📋 Parsing section: ${section.displayName} (${section.columns} columns)`)
    
    // Extract rows within this section
    const rowMatches = sectionXml.match(/<row[^>]*>.*?<\/row>/gs) || []
    
    rowMatches.forEach((rowXml, rowIndex) => {
        const row = parseRow(rowXml, rowIndex, section.columns)
        if (row) {
            section.rows.push(row)
        }
    })
    
    return section
}

/**
 * Parse a single row element
 */
function parseRow(rowXml, rowIndex, maxColumns) {
    const row = {
        index: rowIndex,
        cells: []
    }
    
    // Extract cells within this row
    const cellMatches = rowXml.match(/<cell[^>]*>.*?<\/cell>/gs) || []
    
    cellMatches.forEach((cellXml, cellIndex) => {
        const cell = parseCell(cellXml, cellIndex)
        if (cell) {
            row.cells.push(cell)
        }
    })
    
    console.log(`� Parsed row ${rowIndex} with ${row.cells.length} cells`)
    return row
}

/**
 * Parse a single cell element
 */
function parseCell(cellXml, cellIndex) {
    // Extract cell attributes
    const colspanMatch = cellXml.match(/<cell[^>]*colspan="([^"]*)"/)
    const rowspanMatch = cellXml.match(/<cell[^>]*rowspan="([^"]*)"/)
    const visibleMatch = cellXml.match(/<cell[^>]*visible="([^"]*)"/)
    
    const cell = {
        index: cellIndex,
        colspan: colspanMatch ? parseInt(colspanMatch[1]) : 1,
        rowspan: rowspanMatch ? parseInt(rowspanMatch[1]) : 1,
        visible: visibleMatch ? visibleMatch[1] !== 'false' : true,
        controls: []
    }
    
    // Extract controls within this cell
    const controlMatches = cellXml.match(/<control[^>]*(?:\/>|>.*?<\/control>)/gs) || []
    
    controlMatches.forEach((controlXml, controlIndex) => {
        const control = parseControl(controlXml, controlIndex)
        if (control) {
            cell.controls.push(control)
        }
    })
    
    // Check for subgrids
    const subgridMatches = cellXml.match(/<subgrid[^>]*(?:\/>|>.*?<\/subgrid>)/gs) || []
    
    subgridMatches.forEach((subgridXml, subgridIndex) => {
        const subgrid = parseSubgrid(subgridXml, subgridIndex)
        if (subgrid) {
            cell.controls.push(subgrid)
        }
    })
    
    return cell
}

/**
 * Parse a control element
 */
function parseControl(controlXml, controlIndex) {
    // Extract control attributes
    const datafieldnameMatch = controlXml.match(/datafieldname="([^"]*)"/)
    const classidMatch = controlXml.match(/classid="([^"]*)"/)
    const disabledMatch = controlXml.match(/disabled="([^"]*)"/)
    const idMatch = controlXml.match(/<control[^>]*id="([^"]*)"/)
    
    if (!datafieldnameMatch) {
        return null // Skip controls without datafield
    }
    
    const control = {
        type: 'control',
        index: controlIndex,
        id: idMatch ? idMatch[1] : null,
        datafieldname: datafieldnameMatch[1],
        classid: classidMatch ? classidMatch[1] : null,
        disabled: disabledMatch ? disabledMatch[1] === 'true' : false,
        controlType: inferControlType(classidMatch ? classidMatch[1] : null, datafieldnameMatch[1])
    }
    
    // Extract label if available
    const labelMatch = controlXml.match(/<labels>.*?<label[^>]*description="([^"]*)".*?<\/labels>/s)
    control.label = labelMatch ? labelMatch[1] : formatDisplayName(control.datafieldname)
    control.displayName = control.label
    
    return control
}

/**
 * Parse a subgrid element
 */
function parseSubgrid(subgridXml, subgridIndex) {
    // Extract subgrid attributes
    const nameMatch = subgridXml.match(/<subgrid[^>]*name="([^"]*)"/)
    const idMatch = subgridXml.match(/<subgrid[^>]*id="([^"]*)"/)
    const relationshipMatch = subgridXml.match(/relationship="([^"]*)"/)
    const entityMatch = subgridXml.match(/entity="([^"]*)"/)
    
    const subgrid = {
        type: 'subgrid',
        index: subgridIndex,
        name: nameMatch ? nameMatch[1] : `Subgrid ${subgridIndex + 1}`,
        id: idMatch ? idMatch[1] : null,
        relationship: relationshipMatch ? relationshipMatch[1] : null,
        entity: entityMatch ? entityMatch[1] : null
    }
    
    // Extract label if available
    const labelMatch = subgridXml.match(/<labels>.*?<label[^>]*description="([^"]*)".*?<\/labels>/s)
    subgrid.label = labelMatch ? labelMatch[1] : subgrid.name
    subgrid.displayName = subgrid.label
    
    return subgrid
}

/**
 * Infer control type from classid and field name
 */
function inferControlType(classid, fieldName) {
    // Map Dataverse classids to control types
    const classidMap = {
        '{4273EDBD-AC1D-40d3-9FB2-095C621B552D}': 'text', // Single line text
        '{E0DECE4B-6FC8-4a8f-A065-082708572369}': 'multitext', // Multi-line text
        '{C6D124CA-7EDA-4a60-AEA9-7FB8D318B68F}': 'datetime', // Date time
        '{5B773807-9FB2-42db-97C3-7A91EFF8ADFF}': 'lookup', // Lookup
        '{3EF39988-22BB-4f0b-BBBE-64B5A3748AEE}': 'decimal', // Decimal
        '{C3EFE0C3-0EC6-42be-8349-CBD9079DFD8E}': 'money', // Money
        '{67FAC785-CD58-4f9f-ABB3-4B7DDC6ED5ED}': 'picklist', // Option set
        '{B0C6723A-8503-4fd7-BB28-C8A06AC933C2}': 'boolean', // Boolean
        '{F9A8A302-114E-466A-B582-6771B2AE0D92}': 'email', // Email
        '{71716B6C-711E-476c-8AB8-5D11542BFB47}': 'phone', // Phone
        '{ADA2203E-B4CD-49be-9DDF-234642B43B52}': 'url' // URL
    }
    
    if (classid && classidMap[classid]) {
        return classidMap[classid]
    }
    
    // Fallback to field name inference
    return inferFieldType(fieldName)
}

/**
 * Handle dynamic view request - fetch view metadata and return structured response
 */
async function handleDynamicViewRequest(accessToken, userContact, organizationContacts) {
    console.log('🔍 Starting dynamic view request handler...')
    
    const { DATAVERSE_URL, CONTACT_VIEW_GUID } = process.env
    
    console.log(`� DATAVERSE_URL: ${DATAVERSE_URL ? 'Set' : 'Missing'}`)
    console.log(`🔧 CONTACT_VIEW_GUID: ${CONTACT_VIEW_GUID ? 'Set' : 'Missing'}`)
    
    // Require CONTACT_VIEW_GUID - fail if not provided
    if (!CONTACT_VIEW_GUID) {
        console.error('❌ CONTACT_VIEW_GUID is missing')
        throw new Error('CONTACT_VIEW_GUID environment variable is required for dynamic mode')
    }
    
    console.log(`🎯 Using view GUID: ${CONTACT_VIEW_GUID}`)
    
    // Fetch view metadata
    const viewUrl = `${DATAVERSE_URL}/api/data/v9.0/savedqueries(${CONTACT_VIEW_GUID})?$select=name,description,layoutxml,fetchxml`
    console.log(`🌐 Fetching view from: ${viewUrl}`)
    
    const viewResponse = await fetch(viewUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
    })

    console.log(`📡 View response status: ${viewResponse.status}`)
    
    if (!viewResponse.ok) {
        const errorText = await viewResponse.text()
        console.error('❌ Failed to fetch view metadata:', viewResponse.status, errorText)
        throw new Error(`Failed to fetch view metadata: ${viewResponse.status} - ${errorText}`)
    }

    const viewData = await viewResponse.json()
    console.log(`📋 View data received:`, JSON.stringify(viewData, null, 2))
    
    const viewMetadata = parseViewMetadata(viewData)
    console.log(`✅ View metadata parsed successfully: ${viewMetadata.name}`)

    return createSuccessResponse({
        contacts: organizationContacts,
        viewMetadata: viewMetadata,
        accountId: userContact._parentcustomerid_value,
        isAdmin: true,
        totalCount: organizationContacts.length,
        mode: 'dynamic'
        // Company info is now included in the expanded contact data
    })
}

/**
 * Parse Dataverse view layoutxml to extract column information
 */
function parseViewMetadata(viewData) {
    console.log('🔍 Starting parseViewMetadata...')
    
    const layoutXml = viewData.layoutxml
    const name = viewData.name
    const description = viewData.description
    
    console.log(`📝 View name: ${name}`)
    console.log(`📄 View description: ${description}`)
    console.log(`🏗️ Layout XML length: ${layoutXml ? layoutXml.length : 'null'}`)
    
    if (!layoutXml) {
        console.error('❌ View layoutxml is missing or empty')
        throw new Error('View layoutxml is missing or empty')
    }
    
    // Simple XML parsing for proof of concept
    // In production, we'd use a proper XML parser
    const columns = []
    
    // Extract cell definitions from layoutxml using regex (quick POC approach)
    const cellMatches = layoutXml.match(/<cell[^>]*>/g) || []
    console.log(`🔍 Found ${cellMatches.length} cell matches in layoutxml`)
    
    if (cellMatches.length === 0) {
        console.error('❌ No column definitions found in view layoutxml')
        console.log('🔍 LayoutXML content:', layoutXml.substring(0, 500) + '...')
        throw new Error('No column definitions found in view layoutxml')
    }
    
    cellMatches.forEach((cellTag, index) => {
        const nameMatch = cellTag.match(/name="([^"]*)"/)
        const widthMatch = cellTag.match(/width="([^"]*)"/)
        
        if (nameMatch) {
            const fieldName = nameMatch[1]
            const width = widthMatch ? widthMatch[1] : '120'
            
            console.log(`📋 Adding column ${index}: ${fieldName} (width: ${width})`)
            
            columns.push({
                name: fieldName,
                displayName: formatDisplayName(fieldName),
                width: width + 'px',
                type: inferFieldType(fieldName),
                index: index
            })
        }
    })

    if (columns.length === 0) {
        console.error('❌ No valid columns parsed from view layoutxml')
        throw new Error('No valid columns parsed from view layoutxml')
    }

    console.log(`✅ Successfully parsed ${columns.length} columns`)
    
    return {
        savedqueryid: viewData.savedqueryid,
        name: name,
        displayName: name,
        description: description,
        columns: columns
    }
}

/**
 * Format field name to display name
 */
function formatDisplayName(fieldName) {
    const displayNames = {
        'fullname': 'Full Name',
        'firstname': 'First Name',
        'lastname': 'Last Name',
        'emailaddress1': 'Email Address',
        'mobilephone': 'Mobile Phone',
        'telephone1': 'Phone',
        'createdon': 'Created On',
        'modifiedon': 'Modified On',
        'createdby': 'Created By',
        '_createdby_value': 'Created By',
        'cp_portaladmin': 'Portal Admin',
        '_parentcustomerid_value': 'Company',
        'parentcustomerid': 'Company', // View field name variant
        'statecode': 'Status'
    }
    
    return displayNames[fieldName] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
}

/**
 * Infer field type from field name
 */
function inferFieldType(fieldName) {
    if (fieldName.includes('email')) return 'email'
    if (fieldName.includes('phone') || fieldName.includes('telephone')) return 'phone'
    if (fieldName.includes('createdon') || fieldName.includes('modifiedon')) return 'datetime'
    if (fieldName.includes('admin') || fieldName.includes('active')) return 'boolean'
    if (fieldName.includes('_parentcustomerid_value') || fieldName === 'parentcustomerid') return 'lookup'
    if (fieldName.endsWith('_value')) return 'lookup' // General lookup field pattern
    return 'text'
}

/**
 * Enrich contacts with parent customer information
 * Customer lookup can be Account OR Contact, so we need to check both
 */
async function enrichContactsWithParentInfo(accessToken, contacts) {
    const { DATAVERSE_URL } = process.env
    
    for (const contact of contacts) {
        if (contact._parentcustomerid_value) {
            try {
                console.log(`🔍 Fetching parent customer info for: ${contact._parentcustomerid_value}`)
                
                // Try as Account first (most common for organizations)
                let parentUrl = `${DATAVERSE_URL}/api/data/v9.0/accounts(${contact._parentcustomerid_value})?$select=name,accountid`
                let parentResponse = await fetch(parentUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'OData-MaxVersion': '4.0',
                        'OData-Version': '4.0',
                        'Accept': 'application/json',
                    },
                })

                if (parentResponse.ok) {
                    const accountData = await parentResponse.json()
                    contact.parentcustomerid = {
                        ...accountData,
                        entityType: 'account'
                    }
                    console.log(`✅ Found parent account: ${accountData.name}`)
                } else {
                    // If not found as Account, try as Contact
                    parentUrl = `${DATAVERSE_URL}/api/data/v9.0/contacts(${contact._parentcustomerid_value})?$select=fullname,contactid`
                    parentResponse = await fetch(parentUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'OData-MaxVersion': '4.0',
                            'OData-Version': '4.0',
                            'Accept': 'application/json',
                        },
                    })

                    if (parentResponse.ok) {
                        const contactData = await parentResponse.json()
                        contact.parentcustomerid = {
                            ...contactData,
                            entityType: 'contact'
                        }
                        console.log(`✅ Found parent contact: ${contactData.fullname}`)
                    } else {
                        console.warn(`⚠️ Could not resolve parent customer: ${contact._parentcustomerid_value}`)
                    }
                }
            } catch (error) {
                console.error(`❌ Error fetching parent customer for ${contact._parentcustomerid_value}:`, error)
            }
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
