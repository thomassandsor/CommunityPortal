/**
 * Netlify Function: generic-entity.js - v2.2 TESTING
 * 
 * Generic CRUD operations for any Dataverse entity based on configuration.
 * Provides unified API for entity operations with dynamic form/view metadata.
 * 
 * GET /generic-entity?entity={name}&mode=list - List entities
 * GET /generic-entity?entity={name}&mode=form - Get form metadata
 * GET /generic-entity?entity={name}&id={id} - Get single entity
 * POST /generic-entity?entity={name} - Create entity
 * PATCH /generic-entity?entity={name}&id={id} - Update entity
 * DELETE /generic-entity?entity={name}&id={id} - Delete entity
 * 
 * SECURITY FEATURES:
 * - User authentication required
 * - Entity configuration validation
 * - Contact relation filtering
 * - Admin permission checks
 */

import { validateSimpleAuth, createAuthErrorResponse, createSuccessResponse, buildSecureEmailFilter, sanitizeGuid, isValidGuid, validateContactOwnership, getSecureCorsHeaders, checkRateLimit, createRateLimitResponse, createSafeErrorResponse, fetchWithTimeout } from './auth-utils.js'
import { logDebug, logError, logWarn } from './logger.js'

// 🔒 SECURITY: System fields that MUST NOT be modified by client requests
// These fields are managed by Dataverse internally or through admin operations only
const BLOCKED_SYSTEM_FIELDS = [
    'createdon',           // Created date - system managed
    'modifiedon',          // Modified date - system managed
    'createdby',           // Creator - system managed
    'modifiedby',          // Modifier - system managed
    '_createdby_value',    // Creator lookup - system managed
    '_modifiedby_value',   // Modifier lookup - system managed
    '_ownerid_value',      // Owner - controlled via contact relation
    'ownerid',             // Owner - controlled via contact relation
    'statecode',           // State (active/inactive) - controlled via API
    'statuscode',          // Status reason - controlled via API
    'versionnumber',       // Version - system managed
    'importsequencenumber', // Import tracking - system managed
    'overriddencreatedon', // Historical import field - system managed
    'timezoneruleversionnumber', // Timezone - system managed
    'utcconversiontimezonecode', // Timezone - system managed
    'fullname',            // Computed field (firstname + lastname) - read-only
    'yominame',            // Computed field (phonetic name) - read-only
]

/**
 * 🔒 SECURITY: Validate incoming fields against entity form metadata
 * Prevents unauthorized field manipulation by ensuring only form-visible fields are accepted
 * 
 * @param {Object} data - Incoming data from client
 * @param {Object} formMetadata - Entity form metadata with allowed fields
 * @param {string} entityLogicalName - Entity name for error messages
 * @returns {Object} { valid: boolean, blockedFields: string[], message: string }
 */
function validateFieldSecurity(data, formMetadata, entityLogicalName) {
    const incomingFields = Object.keys(data)
    const blockedFields = []
    const unauthorizedFields = []
    
    // Extract all allowed field names from form metadata
    const allowedFields = new Set()
    let hasLastNameField = false
    
    if (formMetadata?.structure?.tabs) {
        formMetadata.structure.tabs.forEach(tab => {
            // Skip subgrid tabs - they don't contain editable fields
            if (tab.type === 'subgrid') {
                return
            }
            
            if (tab.sections) {
                tab.sections.forEach(section => {
                    if (section.rows) {
                        section.rows.forEach(row => {
                            if (row.cells) {
                                row.cells.forEach(cell => {
                                    if (cell.controls) {
                                        cell.controls.forEach(control => {
                                            // Only process regular form controls (not subgrids)
                                            if (control.datafieldname && control.type === 'control') {
                                                logDebug(`🔒 Adding allowed field: ${control.datafieldname} (type: ${control.controlType})`)
                                                allowedFields.add(control.datafieldname.toLowerCase())
                                                // Also allow the lookup field variant (_fieldname_value)
                                                allowedFields.add(`_${control.datafieldname}_value`.toLowerCase())
                                                
                                                // Track if lastname field exists (for fullname pattern)
                                                if (control.datafieldname.toLowerCase() === 'lastname') {
                                                    hasLastNameField = true
                                                }
                                            } else if (control.type === 'subgrid') {
                                                logDebug(`🔒 Skipping subgrid control: ${control.id} (not a data field)`)
                                            }
                                        })
                                    }
                                })
                            }
                        })
                    }
                })
            }
        })
    }
    
    // SPECIAL CASE: If form has lastname field, also allow firstname
    // This handles Contact forms where fullname is computed from firstname+lastname
    // but forms might only show one field explicitly
    if (hasLastNameField && entityLogicalName === 'contact') {
        logDebug(`🔒 SPECIAL CASE: Contact form with lastname - auto-allowing firstname for fullname pattern`)
        allowedFields.add('firstname')
        allowedFields.add('_firstname_value')
    }
    
    logDebug(`🔒 Field Security Check for ${entityLogicalName}:`)
    logDebug(`🔒   Allowed fields: ${allowedFields.size}`)
    logDebug(`🔒   Allowed fields list: ${Array.from(allowedFields).join(', ')}`)
    logDebug(`🔒   Incoming fields: ${incomingFields.length}`)
    logDebug(`🔒   Incoming fields list: ${incomingFields.join(', ')}`)
    
    // Fields that are legitimate metadata and should be exempted from validation
    const METADATA_FIELDS = ['@odata.etag', 'contactguid', 'contactGuid']
    
    // Check each incoming field
    for (const fieldName of incomingFields) {
        const fieldLower = fieldName.toLowerCase()
        
        // Skip metadata fields (legitimate API fields)
        if (METADATA_FIELDS.includes(fieldLower)) {
            logDebug(`✅ Allowing metadata field: ${fieldName}`)
            continue
        }
        
        // Check if it's a blocked system field
        if (BLOCKED_SYSTEM_FIELDS.includes(fieldLower)) {
            blockedFields.push(fieldName)
            logWarn(`⚠️ SECURITY VIOLATION: Attempted to modify blocked system field: ${fieldName}`)
            continue
        }
        
        // Check if field is in the form metadata (skip @odata.bind fields as they're conversions)
        if (!fieldName.includes('@odata.bind') && !allowedFields.has(fieldLower)) {
            unauthorizedFields.push(fieldName)
            logWarn(`⚠️ SECURITY VIOLATION: Attempted to modify unauthorized field: ${fieldName}`)
        }
    }
    
    if (blockedFields.length > 0 || unauthorizedFields.length > 0) {
        const violations = []
        if (blockedFields.length > 0) {
            violations.push(`Blocked system fields: ${blockedFields.join(', ')}`)
        }
        if (unauthorizedFields.length > 0) {
            violations.push(`Unauthorized fields: ${unauthorizedFields.join(', ')}`)
        }
        
        return {
            valid: false,
            blockedFields,
            unauthorizedFields,
            message: `Field security violation detected. ${violations.join('. ')}. Only form-visible fields can be modified.`
        }
    }
    
    logDebug(`✅ Field security validation passed`)
    return { valid: true, blockedFields: [], unauthorizedFields: [], message: '' }
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

    logDebug(`🚀 GENERIC-ENTITY FUNCTION CALLED v2`)
    logDebug(`🚀 Method: ${event.httpMethod}`)
    logDebug(`🚀 Path: ${event.path}`)
    logDebug(`🚀 Query: ${JSON.stringify(event.queryStringParameters)}`)
    
    // EARLY DEBUG: Check the contact GUID from query parameters
    const contactGuidFromQuery = event.queryStringParameters?.contactGuid
    if (contactGuidFromQuery) {
        logDebug(`🔍 EARLY DEBUG: Contact GUID from query: "${contactGuidFromQuery}"`)
        logDebug(`🔍 EARLY DEBUG: GUID length: ${contactGuidFromQuery.length}`)
        logDebug(`🔍 EARLY DEBUG: GUID segments: ${contactGuidFromQuery.split('-').map(s => s.length).join('-')}`)
    }

    try {
        // Authenticate user (simple auth - no email required)
        const user = await validateSimpleAuth(event)
        logDebug(`✅ Generic entity request from: ${user.userId}`)
        
        // 🔒 SECURITY: Rate limiting per user ID
        const rateLimitResult = checkRateLimit(user.userId, {
            maxRequests: 60, // 60 requests per minute for generic entity operations
            windowMs: 60 * 1000,
            message: 'Too many API requests. Please slow down.'
        })
        
        if (!rateLimitResult.allowed) {
            return createRateLimitResponse(rateLimitResult, origin)
        }

        // Get entity name from query parameters
        const entitySlugOrName = event.queryStringParameters?.entity
        
        if (!entitySlugOrName) {
            return createAuthErrorResponse('Entity name is required', 400, origin)
        }

        // Get access token
        const accessToken = await getAccessToken()
        if (!accessToken) {
            return createAuthErrorResponse('Failed to obtain access token', 500, origin)
        }

        // Resolve URL slug to actual entity logical name
        const entityLogicalName = await resolveEntityName(entitySlugOrName, accessToken)
        if (!entityLogicalName) {
            return createAuthErrorResponse('Entity not found or not configured', 404, origin)
        }

        // Get entity configuration
        logDebug(`🔍 LOADING ENTITY CONFIG for: ${entityLogicalName}`)
        const entityConfig = await getEntityConfiguration(accessToken, entityLogicalName)
        logDebug(`🔍 ENTITY CONFIG RESULT:`, entityConfig)
        
        if (!entityConfig) {
            console.error(`❌ ENTITY CONFIG NOT FOUND for: ${entityLogicalName}`)
            return createAuthErrorResponse(`Entity configuration not found for ${entityLogicalName}. Please create a configuration record in cp_entityconfigurations table.`, 404, origin)
        }
        
        logDebug(`✅ ENTITY CONFIG LOADED:`, {
            name: entityConfig.name,
            contactRelationField: entityConfig.contactRelationField,
            accountRelationField: entityConfig.accountRelationField,
            requiresAdmin: entityConfig.requiresAdmin
        })

        // SECURITY: Get contact GUID directly from request - MAXIMUM SECURITY APPROACH
        let userContact = null
        let contactGuid = null
        
        // Accept contact GUID from query params or request body
        if (event.httpMethod === 'GET') {
            contactGuid = event.queryStringParameters?.contactGuid
        } else {
            const requestBody = event.body ? JSON.parse(event.body) : {}
            contactGuid = requestBody.contactGuid
        }
        
        // Get view mode for filtering (personal vs organization)
        const viewMode = event.queryStringParameters?.viewMode || 'personal'
        
        if (!contactGuid) {
            console.error('🛡️ SECURITY VIOLATION: No contact GUID provided')
            return createAuthErrorResponse('Contact GUID required for secure data access', 401, origin)
        }
        
        // 🔒 SECURITY: Validate and sanitize contact GUID using centralized utility
        logDebug(`🔍 SECURITY: Validating Contact GUID: "${contactGuid}"`)
        
        try {
            // Use the new secure GUID validation function
            contactGuid = sanitizeGuid(contactGuid, 'Contact GUID')
            logDebug(`✅ SECURITY: Contact GUID validated and sanitized: ${contactGuid}`)
        } catch (guidError) {
            console.error(`🛡️ SECURITY VIOLATION: ${guidError.message}`)
            return createAuthErrorResponse(guidError.message, 401, origin)
        }
        
        // 🔒 CRITICAL SECURITY: Verify the contact GUID belongs to the authenticated user
        try {
            userContact = await validateContactOwnership(contactGuid, user, accessToken)
            logDebug(`✅ OWNERSHIP: Contact ${contactGuid} ownership verified for user ${user.userId}`)
        } catch (ownershipError) {
            console.error(`🛡️ OWNERSHIP VIOLATION: ${ownershipError.message}`)
            return createAuthErrorResponse(`Access denied: ${ownershipError.message}`, 403, origin)
        }
        if (!userContact || !userContact.contactid) {
            console.error(`🛡️ SECURITY VIOLATION: No contact record found for GUID: ${contactGuid}`)
            return createAuthErrorResponse('Contact record not found or invalid', 403, origin)
        }

        logDebug(`🛡️ SECURITY: User verified - Contact ID: ${userContact.contactid}`)

        // Check admin permissions if required
        if (entityConfig.requiresAdmin && (!userContact || !userContact.cp_portaladmin)) {
            return createAuthErrorResponse('Admin access required for this entity', 403, origin)
        }

        // Route to appropriate handler based on HTTP method and parameters
        const mode = event.queryStringParameters?.mode
        const entityId = event.queryStringParameters?.id

        switch (event.httpMethod) {
            case 'GET':
                if (mode === 'list') {
                    return await handleListRequest(accessToken, entityConfig, userContact, viewMode, origin, event)
                } else if (mode === 'form') {
                    return await handleFormMetadataRequest(accessToken, entityConfig, userContact, origin)
                } else if (mode === 'subgrid') {
                    return await handleSubgridRequest(accessToken, entityConfig, userContact, event, origin)
                } else if (entityId) {
                    return await handleSingleEntityRequest(accessToken, entityConfig, userContact, entityId, origin)
                } else {
                    return await handleListRequest(accessToken, entityConfig, userContact, viewMode, origin, event)
                }

            case 'POST':
                return await handleCreateRequest(accessToken, entityConfig, userContact, event.body, origin)

            case 'PATCH':
                if (!entityId) {
                    return createAuthErrorResponse('Entity ID is required for update', 400, origin)
                }
                return await handleUpdateRequest(accessToken, entityConfig, userContact, entityId, event.body, origin)

            case 'DELETE':
                if (!entityId) {
                    return createAuthErrorResponse('Entity ID is required for delete', 400, origin)
                }
                return await handleDeleteRequest(accessToken, entityConfig, userContact, entityId, origin)

            default:
                return createAuthErrorResponse('Method not allowed', 405, origin)
        }

    } catch (error) {
        // 🔒 SECURITY: Use safe error response that sanitizes internal details
        return createSafeErrorResponse(error, 'generic-entity-operation', origin)
    }
}

/**
 * Get entity metadata from Dataverse to understand field types and names
 */
async function getEntityMetadata(accessToken, entityLogicalName) {
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    // Get entity metadata including attributes and relationships
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/EntityDefinitions?$filter=LogicalName eq '${entityLogicalName}'&$expand=Attributes($select=LogicalName,AttributeType,AttributeTypeName),OneToManyRelationships($select=ReferencingAttribute,ReferencingEntity,ReferencingEntityNavigationPropertyName),ManyToOneRelationships($select=ReferencingAttribute,ReferencingEntity,ReferencingEntityNavigationPropertyName)`
    
    logDebug('🔍 Fetching entity metadata for:', entityLogicalName)
    logDebug('🌐 Metadata URL:', url)
    
    const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
    }, 30000)  // 30s timeout for Dataverse API calls

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch entity metadata:', response.status, errorText)
        return null
    }

    const data = await response.json()
    const entity = data.value?.[0]
    
    if (!entity) {
        console.error('Entity not found:', entityLogicalName)
        return null
    }
    
    return entity
}

/**
 * Get relationship metadata from Dataverse Metadata API
 * Finds the exact lookup field name for a relationship
 */
async function getRelationshipMetadata(accessToken, parentEntityName, relationshipName) {
    try {
        logDebug(`🔗 Getting relationship metadata: ${parentEntityName}.${relationshipName}`)
        
        // Query EntityDefinitions for the parent entity with relationship expansion
        const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/EntityDefinitions?$filter=LogicalName eq '${parentEntityName}'&$expand=OneToManyRelationships($filter=SchemaName eq '${relationshipName}';$select=SchemaName,ReferencedEntity,ReferencedAttribute,ReferencingEntity,ReferencingAttribute,ReferencingEntityNavigationPropertyName)`
        
        const response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Accept': 'application/json',
            },
        }, 30000)

        if (!response.ok) {
            const errorText = await response.text()
            logError(`Failed to fetch relationship metadata: ${response.status}`, errorText)
            return null
        }

        const data = await response.json()
        const entity = data.value?.[0]
        
        if (!entity || !entity.OneToManyRelationships || entity.OneToManyRelationships.length === 0) {
            logWarn(`⚠️ Relationship not found: ${relationshipName}`)
            return null
        }
        
        const relationship = entity.OneToManyRelationships[0]
        
        logDebug(`✅ Found relationship: ${relationship.ReferencingEntity}.${relationship.ReferencingAttribute}`)
        
        return {
            referencingEntity: relationship.ReferencingEntity,
            referencingAttribute: relationship.ReferencingAttribute,
            referencedEntity: relationship.ReferencedEntity,
            referencedAttribute: relationship.ReferencedAttribute,
            navigationProperty: relationship.ReferencingEntityNavigationPropertyName,
            schemaName: relationship.SchemaName
        }
        
    } catch (error) {
        logError('Error fetching relationship metadata:', error)
        return null
    }
}

/**
 * Handle list request - get entities with view metadata
 */
async function handleListRequest(accessToken, entityConfig, userContact, viewMode = 'personal', origin = null, event = null) {
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    // 🔒 SECURITY: Pagination limits to prevent DoS and memory exhaustion
    const MAX_RECORDS = 100  // Hard limit - never exceed this
    const DEFAULT_PAGE_SIZE = 20  // Default records per page
    
    // Get pagination parameters from query string
    let requestedTop = DEFAULT_PAGE_SIZE
    let skip = 0
    
    if (event && event.queryStringParameters) {
        // Validate and sanitize $top parameter
        if (event.queryStringParameters.$top || event.queryStringParameters.top) {
            const topParam = event.queryStringParameters.$top || event.queryStringParameters.top
            const parsedTop = parseInt(topParam, 10)
            
            if (!isNaN(parsedTop) && parsedTop > 0) {
                // Enforce maximum limit
                requestedTop = Math.min(parsedTop, MAX_RECORDS)
                logDebug(`📊 PAGINATION: Requested ${parsedTop}, enforcing ${requestedTop} (max ${MAX_RECORDS})`)
            }
        }
        
        // Validate and sanitize $skip parameter for pagination
        if (event.queryStringParameters.$skip || event.queryStringParameters.skip) {
            const skipParam = event.queryStringParameters.$skip || event.queryStringParameters.skip
            const parsedSkip = parseInt(skipParam, 10)
            
            if (!isNaN(parsedSkip) && parsedSkip >= 0) {
                skip = parsedSkip
                logDebug(`📊 PAGINATION: Skip ${skip} records`)
            }
        }
    }
    
    // Get view metadata if available
    let viewMetadata = null
    if (entityConfig.viewMainGuid) {
        viewMetadata = await getViewMetadata(accessToken, entityConfig.viewMainGuid, entityConfig)
    }
    
    // Build security filter
    const securityFilter = await buildEntitySecurityFilter(accessToken, entityConfig, userContact, viewMode)
    
    // Build query based on view or default fields
    const viewFieldInfo = viewMetadata ? await getFieldsFromViewMetadata(viewMetadata, entityConfig) : null
    const select = viewFieldInfo?.select || getDefaultEntityFields(entityConfig.entityLogicalName)
    const expand = viewFieldInfo?.expand
    
    // Safety check: if select is empty, use default fields
    const finalSelect = select && select.trim() ? select : getDefaultEntityFields(entityConfig.entityLogicalName)

    // Build the URL using unified pattern for all entities with pagination
    let url = `${process.env.DATAVERSE_URL}/api/data/v9.0/${getEntitySetName(entityConfig.entityLogicalName)}?$filter=${encodeURIComponent(securityFilter)}&$orderby=createdon desc&$top=${requestedTop}`
    
    // Add skip if pagination is used
    if (skip > 0) {
        url += `&$skip=${skip}`
    }
    
    // Add select fields if available
    if (finalSelect) {
        url += `&$select=${finalSelect}`
    }
    
    // Add expand if available
    if (expand) {
        url += `&$expand=${expand}`
    }
    
    // Add count to support pagination metadata
    url += `&$count=true`

    // DEBUG: Log the complete OData query
    logDebug(`🔍 LIST REQUEST DEBUG:`)
    logDebug(`🔍 Entity: ${entityConfig.entityLogicalName}`)
    logDebug(`🔍 Entity Set: ${getEntitySetName(entityConfig.entityLogicalName)}`)
    logDebug(`🔍 Security Filter: ${securityFilter}`)
    logDebug(`🔍 Pagination: top=${requestedTop}, skip=${skip}`)
    logDebug(`🔍 Select: ${finalSelect}`)
    logDebug(`🔍 Expand: ${expand}`)
    logDebug(`🔍 Complete URL: ${url}`)

    const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
            'Prefer': 'odata.include-annotations="*"'  // Include count
        },
    }, 30000)  // 30s timeout for Dataverse API calls

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Dataverse API Error:', response.status, errorText)
        throw new Error(`Failed to fetch entities: ${response.status}`)
    }

    const data = await response.json()
    const entities = data.value || []
    const totalCount = data['@odata.count'] !== undefined ? data['@odata.count'] : entities.length
    const nextLink = data['@odata.nextLink']

    logDebug(`✅ Successfully retrieved ${entities.length} entities (total available: ${totalCount})`)
    logDebug(`🔍 SAMPLE ENTITY DATA:`, entities[0])
    logDebug(`🔍 ENTITY KEYS:`, entities.length > 0 ? Object.keys(entities[0]) : 'No entities')
    
    // Check for expanded contact data using dynamic navigation property
    if (entities.length > 0 && entityConfig?.contactRelationField) {
        const contactNavProperty = getContactNavigationProperty(entityConfig.contactRelationField)
        if (contactNavProperty && entities[0][contactNavProperty]) {
            logDebug(`🔍 EXPANDED CONTACT DATA (${contactNavProperty}):`, entities[0][contactNavProperty])
        }
    }

    return createSuccessResponse({
        entities: entities,
        entityConfig: entityConfig,
        viewMetadata: viewMetadata,
        pagination: {
            pageSize: requestedTop,
            skip: skip,
            returned: entities.length,
            totalCount: totalCount,
            hasMore: !!nextLink,
            nextLink: nextLink
        },
        mode: 'list',
        userIsAdmin: !!userContact?.cp_portaladmin
    }, 200, origin)
}

/**
 * Handle form metadata request
 */
async function handleFormMetadataRequest(accessToken, entityConfig, userContact, origin = null) {
    logDebug(`🔍 Fetching form metadata for ${entityConfig.entityLogicalName}...`)
    
    if (!entityConfig.formGuid) {
        throw new Error('Form GUID not configured for this entity')
    }

    const formMetadata = await getFormMetadata(accessToken, entityConfig.formGuid, entityConfig.entityLogicalName)
    
    return createSuccessResponse({
        formMetadata: formMetadata,
        entityConfig: entityConfig,
        mode: 'form'
    }, 200, origin)
}

/**
 * Handle subgrid request - get related records for a parent entity
 */
async function handleSubgridRequest(accessToken, entityConfig, userContact, event, origin = null) {
    const params = event.queryStringParameters
    const parentId = params.parentId
    const relationshipField = params.relationshipField
    const viewId = params.viewId  // NEW: Get view ID for subgrid
    
    logDebug(`📋 Fetching subgrid for ${entityConfig.entityLogicalName}...`)
    logDebug(`📋 Parent ID: ${parentId}`)
    logDebug(`📋 Relationship field: ${relationshipField}`)
    logDebug(`📋 View ID: ${viewId}`)
    
    if (!parentId || !relationshipField) {
        throw new Error('parentId and relationshipField are required for subgrid mode')
    }
    
    // 🔒 SECURITY: Validate GUID format to prevent injection
    if (!isValidGuid(parentId)) {
        throw new Error('Invalid parent ID format')
    }
    
    // Build OData filter for relationship
    let filter = `${relationshipField} eq '${parentId}'`
    
    // 🔒 SECURITY: Apply contact-based filtering if entity has contact relation
    const contactRelationField = entityConfig.contactRelationField || entityConfig.cp_contactrelationfield
    if (contactRelationField && userContact && userContact.contactid) {
        const contactFilter = `_${contactRelationField}_value eq '${userContact.contactid}'`
        filter = `${filter} and ${contactFilter}`
        logDebug(`🔒 SECURITY: Applied contact filter for subgrid: ${contactFilter}`)
    }
    
    //🔒 SECURITY: Pagination limits
    const MAX_SUBGRID_RECORDS = 50  // Limit subgrid records
    const top = Math.min(parseInt(params.$top || MAX_SUBGRID_RECORDS, 10), MAX_SUBGRID_RECORDS)
    
    // REQUIRED: Get view metadata to determine exact columns for subgrid
    if (!viewId) {
        throw new Error('viewId is required for subgrid - cannot determine columns without view metadata')
    }
    
    logDebug(`📋 Fetching view metadata for subgrid view: ${viewId}`)
    const viewMetadata = await getViewMetadata(accessToken, viewId, entityConfig)
    
    if (!viewMetadata || !viewMetadata.columns || viewMetadata.columns.length === 0) {
        throw new Error(`Failed to get view metadata for subgrid view ${viewId} - cannot render subgrid without column definitions`)
    }
    
    logDebug(`📋 Got view metadata with ${viewMetadata.columns.length} columns`)
    const queryResult = await buildSmartQueryFromMetadata(viewMetadata, entityConfig)
    
    if (!queryResult.select) {
        throw new Error('Failed to build column selection from view metadata - cannot proceed without defined columns')
    }
    
    const select = queryResult.select
    const expand = queryResult.expand
    logDebug(`📋 Subgrid query from view - select: ${select}, expand: ${expand}`)
    
    // Build OData query with view-specific fields
    const selectParam = `$select=${select}`
    const expandParam = expand ? `&$expand=${expand}` : ''
    const odataParams = `$filter=${encodeURIComponent(filter)}&${selectParam}${expandParam}&$top=${top}`
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/${entityConfig.entityLogicalName}s?${odataParams}`
    
    logDebug(`📋 Subgrid OData URL: ${url}`)
    
    const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
            'Prefer': 'odata.include-annotations="*"'
        },
    }, 30000)

    if (!response.ok) {
        const errorText = await response.text()
        logError('Failed to fetch subgrid data:', response.status, errorText)
        throw new Error(`Failed to fetch subgrid data: ${response.status}`)
    }

    const data = await response.json()
    
    logDebug(`✅ Fetched ${data.value?.length || 0} subgrid records`)
    
    return createSuccessResponse({
        entities: data.value || [],
        count: data.value?.length || 0,
        mode: 'subgrid',
        viewMetadata: viewMetadata || null  // Include view metadata for frontend
    }, 200, origin)
}

/**
 * Handle single entity request - ENHANCED USER SCOPING
 */
async function handleSingleEntityRequest(accessToken, entityConfig, userContact, entityId, origin = null) {
    logDebug(`🔍 Fetching single ${entityConfig.entityLogicalName}: ${entityId} for user: ${userContact.contactid}`)
    
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    // SECURITY ENHANCEMENT: Build mandatory user-scoped security filter
    const securityFilter = await buildEntitySecurityFilter(accessToken, entityConfig, userContact, 'personal')
    const idField = getEntityIdField(entityConfig.entityLogicalName)
    const filter = `${idField} eq '${entityId}' and (${securityFilter})`
    
    logDebug(`🛡️ SECURITY: Single entity filter - ${filter}`)
    
    // ENHANCED: For edit view, we need ALL fields (not just view fields) plus lookup expansions
    // Start with all entity fields including system date fields
    const allFields = getAllEntityFields(entityConfig.entityLogicalName).split(',')
    logDebug(`🔍 SINGLE ENTITY: Starting with all fields: ${allFields.join(', ')}`)
    
    // Add dynamic fields from entity configuration
    if (entityConfig.cp_keyfields) {
        const keyFields = Array.isArray(entityConfig.cp_keyfields) ? 
            entityConfig.cp_keyfields : 
            entityConfig.cp_keyfields.split(',').map(f => f.trim())
        
        keyFields.forEach(field => {
            if (!allFields.includes(field)) {
                allFields.push(field)
                logDebug(`🔍 SINGLE ENTITY: Added key field: ${field}`)
            }
        })
    }
    
    // Get lookup expansions using smart query building for consistency
    let expand = null
    let viewMetadata = null
    
    if (entityConfig.viewMainGuid) {
        try {
            viewMetadata = await getViewMetadata(accessToken, entityConfig.viewMainGuid, entityConfig)
            logDebug(`📋 Got view metadata for lookup expansions: ${viewMetadata?.name}`)
            
            // Use smart query building ONLY for lookup expansions
            const queryResult = await buildSmartQueryFromMetadata(viewMetadata, entityConfig)
            expand = queryResult.expand
            logDebug(`🎯 SINGLE ENTITY: Using smart expansions: ${expand}`)
            
            // Also add any fields from view that aren't already included
            if (queryResult.select) {
                const viewFields = queryResult.select.split(',')
                viewFields.forEach(field => {
                    const trimmedField = field.trim()
                    if (!allFields.includes(trimmedField)) {
                        allFields.push(trimmedField)
                        logDebug(`🔍 SINGLE ENTITY: Added view field: ${trimmedField}`)
                    }
                })
            }
        } catch (error) {
            logWarn('Could not fetch view metadata for single entity:', error.message)
        }
    }
    
    // Add contact lookup field and expansion if configured
    if (entityConfig.contactRelationField) {
        const contactFieldName = `_${entityConfig.contactRelationField}_value`
        const contactNavProperty = getContactNavigationProperty(entityConfig.contactRelationField)
        
        if (!allFields.includes(contactFieldName)) {
            allFields.push(contactFieldName)
            logDebug(`🔍 SINGLE ENTITY: Added contact field: ${contactFieldName}`)
        }
        
        if (contactNavProperty) {
            const contactExpansion = `${contactNavProperty}($select=fullname)`
            if (expand) {
                if (!expand.includes(contactExpansion)) {
                    expand += `,${contactExpansion}`
                }
            } else {
                expand = contactExpansion
            }
            logDebug(`🔍 SINGLE ENTITY: Added contact expansion: ${contactExpansion}`)
        }
    }
    
    // Special handling for Contact entity's parentcustomerid (Customer lookup field)
    if (entityConfig.entityLogicalName === 'contact' && allFields.includes('_parentcustomerid_value')) {
        // Add expansion for parent account - Customer lookup can point to account or contact
        // We'll expand the account navigation property which is most common
        const parentExpansion = `parentcustomerid_account($select=name)`
        if (expand) {
            if (!expand.includes(parentExpansion)) {
                expand += `,${parentExpansion}`
            }
        } else {
            expand = parentExpansion
        }
        logDebug(`🔍 SINGLE ENTITY: Added parentcustomerid (Customer lookup) expansion: ${parentExpansion}`)
        // Note: OData annotations are automatically returned with Prefer: odata.include-annotations="*" header
    }
    
    const select = allFields.join(',')
    logDebug(`🎯 SINGLE ENTITY: Final select with ALL fields: ${select}`)
    logDebug(`🎯 SINGLE ENTITY: Final expand: ${expand}`)
    
    let url = `${process.env.DATAVERSE_URL}/api/data/v9.2/${getEntitySetName(entityConfig.entityLogicalName)}?$filter=${encodeURIComponent(filter)}&$select=${select}`
    if (expand) {
        url += `&$expand=${encodeURIComponent(expand)}`
    }
    
    logDebug(`🔍 SINGLE ENTITY: Complete URL: ${url}`)
    
    const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
            'Prefer': 'odata.include-annotations="*"'  // Include OData annotations (formatted values, lookup types, etc.)
        },
    }, 30000)  // 30s timeout

    if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Failed to fetch entity (${response.status}):`, errorText)
        console.error(`❌ Request URL was: ${url}`)
        throw new Error(`Failed to fetch entity: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const entity = data.value && data.value.length > 0 ? data.value[0] : null

    if (!entity) {
        throw new Error('Entity not found or access denied')
    }

    logDebug(`✅ SINGLE ENTITY: Retrieved ${entityConfig.entityLogicalName}: ${entityId}`)
    logDebug(`🔍 SINGLE ENTITY DATA:`, entity)
    logDebug(`🔍 SINGLE ENTITY KEYS:`, Object.keys(entity))
    
    // Debug expanded contact data for single entity like we do for list
    if (entityConfig?.contactRelationField) {
        const contactNavProperty = getContactNavigationProperty(entityConfig.contactRelationField)
        if (contactNavProperty && entity[contactNavProperty]) {
            logDebug(`🔍 SINGLE ENTITY EXPANDED CONTACT DATA (${contactNavProperty}):`, entity[contactNavProperty])
        } else {
            logDebug(`⚠️ SINGLE ENTITY: No expanded contact data found for nav property: ${contactNavProperty}`)
            logDebug(`⚠️ SINGLE ENTITY: Available nav properties:`, Object.keys(entity).filter(k => k.match(/^[a-z]/i) && !k.includes('@')))
        }
    }

    return createSuccessResponse({
        entity: entity,
        entityConfig: entityConfig,
        mode: 'single'
    }, 200, origin)
}

/**
 * Handle create request
 */
async function handleCreateRequest(accessToken, entityConfig, userContact, requestBody, origin = null) {
    logDebug(`📝 Creating new ${entityConfig.entityLogicalName}...`)
    
    if (!requestBody) {
        throw new Error('Request body is required for create operation')
    }

    const data = JSON.parse(requestBody)
    
    // Get form metadata to determine which fields are editable - REQUIRED
    if (!entityConfig.formGuid) {
        throw new Error(`Form GUID is required for entity ${entityConfig.entityLogicalName} - no fallback processing allowed`)
    }
    
    logDebug(`📋 Fetching form metadata for CREATE operation: ${entityConfig.formGuid}`)
    const formMetadata = await getFormMetadata(accessToken, entityConfig.formGuid, entityConfig.entityLogicalName)
    
    if (!formMetadata) {
        throw new Error(`Form metadata not found for GUID: ${entityConfig.formGuid}`)
    }
    
    logDebug(`✅ Form metadata loaded for CREATE: ${formMetadata.name}`)
    
    // 🔒 SECURITY: Validate field security before processing
    const fieldValidation = validateFieldSecurity(data, formMetadata, entityConfig.entityLogicalName)
    if (!fieldValidation.valid) {
        logError(`🚨 SECURITY VIOLATION in CREATE: ${fieldValidation.message}`)
        throw new Error(fieldValidation.message)
    }
    
    // Sanitize rich text fields for Dataverse compatibility with form metadata
    const sanitizedData = sanitizeDataForDataverse(data, entityConfig, formMetadata)
    
    // SECURITY: Always set user ownership - contact GUID is guaranteed at this point
    if (entityConfig.contactRelationField) {
        // Standard user entity - set contact ownership
        // CRITICAL: Use navigation property (cp_Contact) not field name (cp_contact)
        const contactLookupField = `_${entityConfig.contactRelationField}_value`
        const navigationProperty = getNavigationPropertyForLookupField(contactLookupField, entityConfig)
        const contactBindField = `${navigationProperty}@odata.bind`
        sanitizedData[contactBindField] = `/contacts(${userContact.contactid})`
        logDebug(`🛡️ SECURITY: User ownership set - ${contactBindField} = /contacts(${userContact.contactid})`)
    } else if (!userContact.cp_portaladmin) {
        // System entity requires admin access
        throw new Error('Admin access required to create this type of record')
    } else {
        // Admin creating system entity
        logDebug(`🛡️ SECURITY: Admin creating system entity ${entityConfig.entityLogicalName}`)
    }

    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/${getEntitySetName(entityConfig.entityLogicalName)}`
    
    logDebug(`🧹 Sanitized data for create:`, sanitizedData)
    
    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
        body: JSON.stringify(sanitizedData)
    }, 30000)  // 30s timeout

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to create entity:', response.status, errorText)
        throw new Error(`Failed to create entity: ${response.status}`)
    }

    // Get the created entity ID from response headers
    const entityUrl = response.headers.get('OData-EntityId')
    const entityId = entityUrl ? entityUrl.split('(')[1].split(')')[0] : null

    logDebug(`✅ Created ${entityConfig.entityLogicalName}: ${entityId}`)

    return createSuccessResponse({
        entityId: entityId,
        entityConfig: entityConfig,
        mode: 'create'
    }, 200, origin)
}

/**
 * Check if a field is a system field that shouldn't be edited
 */
function isSystemField(fieldName) {
    const systemFields = [
        'createdon', 'modifiedon', 'createdby', 'modifiedby',
        '_createdby_value', '_modifiedby_value', '_ownerid_value',
        'statecode', 'statuscode', 'versionnumber'
    ]
    return systemFields.includes(fieldName.toLowerCase()) || fieldName.endsWith('id')
}

/**
 * Sanitize data for Dataverse compatibility - only include form-editable fields
 */
function sanitizeDataForDataverse(data, entityConfig, formMetadata = null) {
    logDebug(`🧹 Starting data sanitization for entity: ${entityConfig.entityLogicalName}`)
    
    const editableData = {}
    
    // Use form metadata to determine editable fields if available
    if (formMetadata && formMetadata.structure && formMetadata.structure.tabs) {
        logDebug(`📋 Using form metadata to determine editable fields`)
        logDebug(`📋 Form structure debug:`, JSON.stringify(formMetadata.structure, null, 2))
        
        // Extract all fields from all tabs and sections
        const allFormFields = []
        formMetadata.structure.tabs.forEach(tab => {
            logDebug(`📋 Processing tab: ${tab.name} (${tab.sections?.length || 0} sections)`)
            if (tab.sections) {
                tab.sections.forEach(section => {
                    logDebug(`📋 Processing section: ${section.name}`)
                    if (section.rows) {
                        section.rows.forEach(row => {
                            if (row.cells) {
                                row.cells.forEach(cell => {
                                    if (cell.controls) {
                                        cell.controls.forEach(control => {
                                            if (control.datafieldname && control.type === 'control') {
                                                allFormFields.push({
                                                    name: control.datafieldname,
                                                    controlType: control.controlType,
                                                    displayName: control.displayName,
                                                    disabled: control.disabled,
                                                    isRichText: control.isRichText
                                                })
                                                logDebug(`📋 Found field: ${control.datafieldname} (${control.controlType})`)
                                            }
                                        })
                                    }
                                })
                            }
                        })
                    }
                })
            }
        })
        
    logDebug(`📝 Found ${allFormFields.length} fields on form`)
    logDebug(`📝 Incoming data keys:`, Object.keys(data))
    logDebug(`📝 Form fields found:`, allFormFields.map(f => ({ name: f.name, controlType: f.controlType })))
    
    if (allFormFields.length === 0) {
        console.error(`❌ No fields found in form metadata - form structure is incomplete`)
        logDebug(`📋 Full form metadata:`, JSON.stringify(formMetadata, null, 2))
        throw new Error(`Form metadata is incomplete - no fields found. Form GUID: ${entityConfig.formGuid}`)
    }        allFormFields.forEach(field => {
            const fieldName = field.name
            
            // Skip system read-only fields
            if (fieldName === 'createdon' || 
                fieldName === 'modifiedon' || 
                fieldName === 'createdby' || 
                fieldName === 'modifiedby') {
                logDebug(`⏭️ Skipping system read-only field: ${fieldName}`)
                return
            }
            
            // CRITICAL DEBUG: Log field details for lookup detection
            logDebug(`🔍 FIELD ANALYSIS: ${fieldName}`)
            logDebug(`🔍   controlType: "${field.controlType}"`)
            logDebug(`🔍   ends with _value: ${fieldName.endsWith('_value')}`)
            logDebug(`🔍   data has field: ${data.hasOwnProperty(fieldName)}`)
            logDebug(`🔍   data value: "${data[fieldName]}"`)
            
            // Handle lookup fields with proper Dataverse syntax - check both controlType and field name pattern
            if (field.controlType === 'lookup' || fieldName.endsWith('_value')) {
                logDebug(`🎯 LOOKUP FIELD DETECTED: ${fieldName} (condition met)`);
                if (data.hasOwnProperty(fieldName) && data[fieldName]) {
                    // Convert lookup field to Dataverse @odata.bind format
                    const lookupValue = data[fieldName]
                    logDebug(`🔗 Processing lookup field: ${fieldName} = ${lookupValue}`)
                    
                    // Skip empty lookup values (already handled in frontend)
                    if (!lookupValue || lookupValue === '') {
                        logDebug(`⏭️ Skipping empty lookup field: ${fieldName}`)
                        return
                    }
                    
                    // Convert to navigation property format for Dataverse
                    const navigationProperty = getNavigationPropertyForLookupField(fieldName, entityConfig)
                    const entitySetName = getEntitySetNameForLookupField(fieldName)
                    
                    logDebug(`🔍 LOOKUP CONVERSION DEBUG:`)
                    logDebug(`🔍   Input field: ${fieldName}`)
                    logDebug(`🔍   Input value: ${lookupValue}`)
                    logDebug(`🔍   Input value type: ${typeof lookupValue}`)
                    logDebug(`🔍   Navigation property: ${navigationProperty}`)
                    logDebug(`🔍   Entity set: ${entitySetName}`)
                    
                    if (navigationProperty && entitySetName) {
                        const odataBindKey = `${navigationProperty}@odata.bind`
                        const odataBindValue = `/${entitySetName}(${lookupValue})`
                        
                        logDebug(`🚀 ODATA CONVERSION EXECUTING:`)
                        logDebug(`🚀   From: ${fieldName} = ${lookupValue}`)
                        logDebug(`🚀   To: ${odataBindKey} = ${odataBindValue}`)
                        
                        editableData[odataBindKey] = odataBindValue
                        
                        logDebug(`✅ CONVERSION COMPLETE: Added to editableData`);
                        logDebug(`✅ LOOKUP CONVERTED SUCCESSFULLY:`)
                        logDebug(`✅   Original: ${fieldName} = ${lookupValue}`)
                        logDebug(`✅   Converted: ${odataBindKey} = ${odataBindValue}`)
                        logDebug(`✅   Expected pattern: "cp_Contact@odata.bind": "/contacts(12341234-1234-1234-1234-123412341234)"`)
                        logDebug(`✅   Matches WebAPI pattern: record["cp_Contact@odata.bind"] = "/contacts(guid)"`)
                    } else {
                        logDebug(`❌ LOOKUP CONVERSION FAILED:`)
                        logDebug(`❌   Could not determine navigation property for: ${fieldName}`)
                        logDebug(`❌   Navigation property: ${navigationProperty}`)
                        logDebug(`❌   Entity set: ${entitySetName}`)
                        logDebug(`❌   Available mappings:`, Object.keys(getFieldNavigationPropertyMap(entityConfig)))
                    }
                } else {
                    logDebug(`⏭️ Lookup field ${fieldName} not provided or empty - skipping`)
                }
                return
            }
            
            // CRITICAL FIX: Check if this form field corresponds to a lookup field in the incoming data
            // Form shows 'cp_contact' but data contains '_cp_contact_value'
            const correspondingLookupField = `_${fieldName}_value`
            if (data.hasOwnProperty(correspondingLookupField) && data[correspondingLookupField]) {
                logDebug(`🔧 LOOKUP FIELD MAPPING: Form field '${fieldName}' maps to data field '${correspondingLookupField}'`)
                
                const lookupValue = data[correspondingLookupField]
                logDebug(`🔗 Processing mapped lookup: ${correspondingLookupField} = ${lookupValue}`)
                
                // Convert to @odata.bind format using the actual lookup field name
                const navigationProperty = getNavigationPropertyForLookupField(correspondingLookupField, entityConfig)
                const entitySetName = getEntitySetNameForLookupField(correspondingLookupField)
                
                if (navigationProperty && entitySetName) {
                    const odataBindKey = `${navigationProperty}@odata.bind`
                    const odataBindValue = `/${entitySetName}(${lookupValue})`
                    
                    editableData[odataBindKey] = odataBindValue
                    logDebug(`✅ MAPPED LOOKUP CONVERSION: ${fieldName} (${correspondingLookupField}) → ${odataBindKey} = ${odataBindValue}`)
                } else {
                    console.error(`❌ Could not convert mapped lookup field: ${correspondingLookupField}`)
                }
                return
            }
            
            // Include the field if it exists in the data
            if (data.hasOwnProperty(fieldName)) {
                editableData[fieldName] = data[fieldName]
                
                // Apply rich text sanitization if needed
                if (field.controlType === 'richtext' && typeof editableData[fieldName] === 'string') {
                    logDebug(`🧹 Sanitizing rich text field: ${fieldName}`)
                    logDebug(`📄 Original content preview:`, editableData[fieldName].substring(0, 100))
                    editableData[fieldName] = sanitizeRichTextForDataverse(editableData[fieldName])
                    logDebug(`✅ Sanitized content preview:`, editableData[fieldName].substring(0, 100))
                }
                
                logDebug(`✅ Including form field: ${fieldName} (${field.controlType || 'text'})`)
            } else {
                logDebug(`⚠️ Form field ${fieldName} not found in request data`)
            }
        })
    }
    
    // Form metadata is required - no fallback processing allowed
    
    logDebug(`🧹 Final editable fields to update:`, Object.keys(editableData))
    logDebug(`🧹 Excluded from update:`, Object.keys(data).filter(key => !editableData.hasOwnProperty(key)))
    
    return editableData
}

/**
 * Sanitize rich text content for Dataverse
 */
function sanitizeRichTextForDataverse(html) {
    if (!html || typeof html !== 'string') return html
    
    logDebug(`🧹 Original HTML (${html.length} chars):`, html)
    
    // Be more conservative with sanitization - focus on removing only problematic elements
    let sanitized = html
    
    // Remove CKEditor-specific wrapper divs but preserve list structures
    sanitized = sanitized.replace(/<div[^>]*class="ck-content"[^>]*>/gi, '')
    sanitized = sanitized.replace(/<\/div>\s*$/gi, '')
    
    // Remove data-wrapper attributes but preserve list-related attributes
    sanitized = sanitized.replace(/\s*data-wrapper="[^"]*"/gi, '')
    
    // Remove dir attributes
    sanitized = sanitized.replace(/\s*dir="[^"]*"/gi, '')
    
    // Be more careful with style removal - only remove CKEditor-specific styles
    sanitized = sanitized.replace(/style="[^"]*--ck-[^"]*"/gi, '')
    sanitized = sanitized.replace(/style="[^"]*ck-[^"]*"/gi, '')
    
    // Clean up empty style attributes
    sanitized = sanitized.replace(/\s*style=""\s*/gi, '')

    // DON'T remove list-related HTML or font-size spans - preserve all formatting
    
    logDebug(`🧹 Sanitized HTML (${sanitized.length} chars):`, sanitized)
    
    return sanitized.trim()
}

/**
 * Handle update request
 */
async function handleUpdateRequest(accessToken, entityConfig, userContact, entityId, requestBody, origin = null) {
    logDebug(`� UPDATE REQUEST RECEIVED 🚨`)
    logDebug(`�📝 Updating ${entityConfig.entityLogicalName}: ${entityId}`)
    logDebug(`📦 Request body length: ${requestBody?.length || 0} characters`)
    
    if (!requestBody) {
        throw new Error('Request body is required for update operation')
    }

    const data = JSON.parse(requestBody)
    logDebug(`📊 Parsed data keys:`, Object.keys(data))
    
    // SECURITY ENHANCEMENT: Verify user owns the record before update (when contact available)
    if (entityConfig.contactRelationField && userContact && userContact.contactid) {
        const securityFilter = await buildEntitySecurityFilter(accessToken, entityConfig, userContact, 'personal')
        const idField = getEntityIdField(entityConfig.entityLogicalName)
        const verifyFilter = `${idField} eq '${entityId}' and (${securityFilter})`
        
        logDebug(`🛡️ SECURITY: Verifying user ownership before update - ${verifyFilter}`)
        
        const verifyUrl = `${process.env.DATAVERSE_URL}/api/data/v9.2/${getEntitySetName(entityConfig.entityLogicalName)}?$filter=${encodeURIComponent(verifyFilter)}&$select=${idField}`
        const verifyResponse = await fetchWithTimeout(verifyUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Accept': 'application/json',
            },
        })
        
        if (!verifyResponse.ok) {
            throw new Error(`Failed to verify record ownership: ${verifyResponse.status}`)
        }
        
        const verifyData = await verifyResponse.json()
        if (!verifyData.value || verifyData.value.length === 0) {
            console.error(`🛡️ SECURITY: User ${userContact.contactid} attempted to update record ${entityId} they don't own`)
            throw new Error('Access denied: You can only update records you own')
        }
        
        logDebug(`✅ SECURITY: User ownership verified for update operation`)
    } else {
        logWarn(`🛡️ SECURITY: Updating ${entityConfig.entityLogicalName} without ownership verification (no contact or no contact relation field)`)
    }
    
    // Get form metadata to determine which fields are editable - REQUIRED
    if (!entityConfig.formGuid) {
        throw new Error(`Form GUID is required for entity ${entityConfig.entityLogicalName} - no fallback processing allowed`)
    }
    
    logDebug(`📋 Fetching form metadata for GUID: ${entityConfig.formGuid}`)
    const formMetadata = await getFormMetadata(accessToken, entityConfig.formGuid, entityConfig.entityLogicalName)
    
    if (!formMetadata) {
        throw new Error(`Form metadata not found for GUID: ${entityConfig.formGuid}`)
    }
    
    logDebug(`✅ Form metadata loaded: ${formMetadata.name}`)
    
    // 🔒 SECURITY: Validate field security before processing
    const fieldValidation = validateFieldSecurity(data, formMetadata, entityConfig.entityLogicalName)
    if (!fieldValidation.valid) {
        logError(`🚨 SECURITY VIOLATION in UPDATE: ${fieldValidation.message}`)
        throw new Error(fieldValidation.message)
    }
    
    // Sanitize data based on form metadata
    const sanitizedData = sanitizeDataForDataverse(data, entityConfig, formMetadata)
    
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/${getEntitySetName(entityConfig.entityLogicalName)}(${entityId})`
    
    logDebug(`🧹 Sanitized data for update:`, sanitizedData)
    
    const response = await fetchWithTimeout(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
        body: JSON.stringify(sanitizedData)
    }, 30000)  // 30s timeout for Dataverse API calls

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to update entity:', response.status, errorText)
        console.error('Request data:', sanitizedData)
        throw new Error(`Failed to update entity: ${response.status}`)
    }

    logDebug(`✅ Updated ${entityConfig.entityLogicalName}: ${entityId}`)

    return createSuccessResponse({
        entityId: entityId,
        entityConfig: entityConfig,
        mode: 'update'
    }, 200, origin)
}

/**
 * Handle delete request - ENHANCED USER SCOPING
 */
async function handleDeleteRequest(accessToken, entityConfig, userContact, entityId, origin = null) {
    logDebug(`🗑️ Deleting ${entityConfig.entityLogicalName}: ${entityId} for user: ${userContact.contactid}`)
    
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    // SECURITY ENHANCEMENT: Verify user owns the record before delete (when contact available)
    if (entityConfig.contactRelationField && userContact && userContact.contactid) {
        const securityFilter = await buildEntitySecurityFilter(accessToken, entityConfig, userContact, 'personal')
        const idField = getEntityIdField(entityConfig.entityLogicalName)
        const verifyFilter = `${idField} eq '${entityId}' and (${securityFilter})`
        
        logDebug(`🛡️ SECURITY: Verifying user ownership before delete - ${verifyFilter}`)
        
        const verifyUrl = `${process.env.DATAVERSE_URL}/api/data/v9.2/${getEntitySetName(entityConfig.entityLogicalName)}?$filter=${encodeURIComponent(verifyFilter)}&$select=${idField}`
        const verifyResponse = await fetchWithTimeout(verifyUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Accept': 'application/json',
            },
        })
        
        if (!verifyResponse.ok) {
            throw new Error(`Failed to verify record ownership: ${verifyResponse.status}`)
        }
        
        const verifyData = await verifyResponse.json()
        if (!verifyData.value || verifyData.value.length === 0) {
            console.error(`🛡️ SECURITY: User ${userContact.contactid} attempted to delete record ${entityId} they don't own`)
            throw new Error('Access denied: You can only delete records you own')
        }
        
        logDebug(`✅ SECURITY: User ownership verified for delete operation`)
    } else {
        logWarn(`🛡️ SECURITY: Deleting ${entityConfig.entityLogicalName} without ownership verification (no contact or no contact relation field)`)
    }
    
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/${getEntitySetName(entityConfig.entityLogicalName)}(${entityId})`
    
    const response = await fetchWithTimeout(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
        },
    }, 30000)  // 30s timeout

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to delete entity:', response.status, errorText)
        throw new Error(`Failed to delete entity: ${response.status}`)
    }

    logDebug(`✅ Deleted ${entityConfig.entityLogicalName}: ${entityId}`)

    return createSuccessResponse({
        entityId: entityId,
        entityConfig: entityConfig,
        mode: 'delete'
    }, 200, origin)
}

/**
 * Get all contact IDs for the user's account (for organization view)
 * @param {string} accessToken - Dataverse access token
 * @param {string} accountGuid - Account GUID
 * @returns {Promise<string[]>} Array of contact GUIDs
 */
async function getAccountContactIds(accessToken, accountGuid) {
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    const filter = `_parentcustomerid_value eq '${accountGuid}' and statecode eq 0`
    const select = 'contactid'
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/contacts?$filter=${encodeURIComponent(filter)}&$select=${select}`
    
    try {
        const response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Accept': 'application/json',
            },
        })
        
        if (!response.ok) {
            console.error(`Failed to fetch account contacts: ${response.status}`)
            return []
        }
        
        const data = await response.json()
        const contactIds = data.value.map(contact => contact.contactid)
        logDebug(`🏢 ACCOUNT CONTACTS: Found ${contactIds.length} contacts in account ${accountGuid}`)
        return contactIds
        
    } catch (error) {
        console.error('Error fetching account contacts:', error)
        return []
    }
}

/**
 * Build security filter for entity access - SECURE CONTACT-BASED FILTERING
 * NO FALLBACKS - FAILS SECURELY
 */
async function buildEntitySecurityFilter(accessToken, entityConfig, userContact, viewMode = 'personal') {
    // SECURITY: Contact GUID is REQUIRED - no exceptions, no fallbacks
    if (!userContact || !userContact.contactid) {
        throw new Error('🛡️ SECURITY: Contact GUID required for all data access')
    }

    let filter = 'statecode eq 0' // Only active records
    
    // SECURITY: Apply user scoping based on entity configuration
    if (entityConfig.contactRelationField) {
        // PATTERN 1: Contact-owned entities (Ideas, Projects, Cases)
        const contactField = `_${entityConfig.contactRelationField}_value`
        
        if (viewMode === 'organization' && userContact.cp_portaladmin && userContact._parentcustomerid_value) {
            // ADMIN ORGANIZATION VIEW: Show all records from contacts in the same account
            logDebug(`🏢 SECURITY: Admin organization view requested for account: ${userContact._parentcustomerid_value}`)
            
            // Get all contact IDs in the same account
            const accountContactIds = await getAccountContactIds(accessToken, userContact._parentcustomerid_value)
            
            if (accountContactIds.length > 0) {
                // Build filter for multiple contacts: field eq 'id1' or field eq 'id2' or...
                const contactFilters = accountContactIds.map(contactId => `${contactField} eq '${contactId}'`).join(' or ')
                filter += ` and (${contactFilters})`
                logDebug(`🏢 SECURITY: Organization view - filtering by ${accountContactIds.length} account contacts`)
            } else {
                // No contacts found, fall back to personal view
                logWarn('⚠️  ORGANIZATION VIEW: No account contacts found, falling back to personal view')
                filter += ` and ${contactField} eq '${userContact.contactid}'`
            }
        } else {
            // PERSONAL VIEW: Show only user's own records
            filter += ` and ${contactField} eq '${userContact.contactid}'`
            logDebug(`🛡️ SECURITY: Personal view - ${contactField} eq ${userContact.contactid}`)
        }
    } else if (entityConfig.accountRelationField) {
        // PATTERN 2: Account-owned entities (Organization, Company Settings)
        const accountField = `_${entityConfig.accountRelationField}_value`
        
        if (!userContact._parentcustomerid_value) {
            throw new Error('🛡️ SECURITY: User must have account association for account-level entities')
        }
        
        filter += ` and ${accountField} eq '${userContact._parentcustomerid_value}'`
        logDebug(`🏢 SECURITY: Account scoped - ${accountField} eq ${userContact._parentcustomerid_value}`)
        
        // Account-level entities typically require admin access
        if (entityConfig.requiresAdmin && !userContact.cp_portaladmin) {
            console.error(`🛡️ SECURITY VIOLATION: Non-admin user attempted access to admin entity ${entityConfig.entityLogicalName}`)
            throw new Error('Admin access required for this entity type')
        }
    } else {
        // PATTERN 3: System/admin entities - require admin permission
        if (!userContact.cp_portaladmin) {
            console.error(`🛡️ SECURITY VIOLATION: Non-admin user attempted access to admin entity ${entityConfig.entityLogicalName}`)
            throw new Error('Admin access required for this entity type')
        }
        logDebug(`🛡️ SECURITY: Admin access granted for ${entityConfig.entityLogicalName}`)
    }
    
    return filter
}

/**
 * Get entity configuration (reuse from entity-config function)
 */
async function getEntityConfiguration(accessToken, entityName) {
    const { handler: configHandler } = await import('./entity-config.js')
    
    const configEvent = {
        httpMethod: 'GET',
        queryStringParameters: { entity: entityName },
        headers: { authorization: `Bearer ${accessToken}` }
    }
    
    const result = await configHandler(configEvent, {})
    
    if (result.statusCode === 200) {
        const data = JSON.parse(result.body)
        return data.config
    }
    
    return null
}

/**
 * Utility functions for entity metadata
 */
function getEntitySetName(entityLogicalName) {
    // Map common entity names to their set names
    const entitySetMap = {
        'contact': 'contacts',
        'account': 'accounts',
        'opportunity': 'opportunities',
        'lead': 'leads',
        'incident': 'incidents'
    }
    
    // For custom entities (cp_*), the set name is usually just the logical name with 's'
    if (entityLogicalName.startsWith('cp_')) {
        return `${entityLogicalName}s`
    }
    
    return entitySetMap[entityLogicalName] || `${entityLogicalName}s`
}

function getEntityIdField(entityLogicalName) {
    return `${entityLogicalName}id`
}

function getDefaultEntityFields(entityLogicalName) {
    // Return basic fields for any entity
    return `${entityLogicalName}id,createdon,modifiedon,statecode`
}

function getEntityFieldsWithLookups(entityConfig) {
    const entityLogicalName = entityConfig.entityLogicalName
    
    logDebug(`🔍 Building fields with lookups for entity: ${entityLogicalName}`)
    
    // Start with common fields
    const fields = [
        `${entityLogicalName}id`,
        'createdon',
        'modifiedon',
        'statecode',
        '_createdby_value',
        '_modifiedby_value'
    ]
    
    const expands = []
    
    // FULLY DYNAMIC - NO MORE HARDCODED ENTITY-SPECIFIC LOGIC
    logDebug('🔄 USING DYNAMIC FIELD DETECTION - ELIMINATED HARDCODED ENTITY CHECKS')
    
    // Add dynamic lookup fields based on entity configuration
    if (entityConfig.contactRelationField) {
        const lookupField = `_${entityConfig.contactRelationField}_value`
        fields.push(lookupField)
        expands.push(`${getNavigationPropertyForLookupField(lookupField, entityConfig)}($select=fullname)`)
        logDebug(`✅ Added contact lookup: ${lookupField}`)
    }
    
    if (entityConfig.accountRelationField) {
        const lookupField = `_${entityConfig.accountRelationField}_value`
        fields.push(lookupField)
        expands.push(`${getNavigationPropertyForLookupField(lookupField, entityConfig)}($select=name)`)
        logDebug(`✅ Added account lookup: ${lookupField}`)
    }
    
    // Dynamic field expansion based on entity configuration
    if (entityConfig.cp_keyfields) {
        // Add key fields from configuration
        const keyFields = Array.isArray(entityConfig.cp_keyfields) ? 
            entityConfig.cp_keyfields : 
            entityConfig.cp_keyfields.split(',').map(f => f.trim())
        
        fields.push(...keyFields)
    }
    
    // Add any other lookup fields that might be in the entity configuration
    if (entityConfig.cp_lookupfields) {
        const lookupFields = entityConfig.cp_lookupfields.split(',')
        lookupFields.forEach(lookupField => {
            const fieldName = lookupField.trim()
            if (fieldName && !fields.includes(fieldName)) {
                fields.push(fieldName)
                
                // Add expand for lookup fields
                if (fieldName.endsWith('_value')) {
                    // Determine the appropriate expand based on field name
                    if (fieldName.includes('contact')) {
                        expands.push(`${fieldName}($select=fullname,firstname,lastname)`)
                    } else if (fieldName.includes('account') || fieldName.includes('customer')) {
                        expands.push(`${fieldName}($select=name)`)
                    } else {
                        // Generic expand - try common display fields
                        expands.push(`${fieldName}($select=name)`)
                    }
                }
            }
        })
    }
    
    const result = {
        select: fields.join(','),
        expand: expands.length > 0 ? expands.join(',') : null
    }
    
    logDebug(`📋 Fields for ${entityLogicalName}:`, result)
    
    return result
}

function getAllEntityFields(entityLogicalName) {
    // Essential fields that all entities should have for edit view
    const commonFields = [
        `${entityLogicalName}id`,
        'createdon',           // Norwegian date field
        'modifiedon',          // Norwegian date field
        'statecode',
        'statuscode',
        '_createdby_value',
        '_modifiedby_value',
        '_ownerid_value'
    ]
    
    // FULLY DYNAMIC - NO MORE HARDCODED ENTITY-SPECIFIC FIELDS
    logDebug('🔄 DYNAMIC FIELD DETECTION - NO MORE HARDCODED ENTITY LOGIC')
    
    // Add common fields that most entities have based on type
    if (entityLogicalName === 'contact') {
        // Standard Dataverse contact fields
        commonFields.push('firstname', 'lastname', 'fullname', 'emailaddress1', 'mobilephone', '_parentcustomerid_value')
        // Note: OData annotation fields are automatically included by Dataverse when using Prefer header
        // We don't need to explicitly select them
    } else if (entityLogicalName === 'account') {
        // Standard Dataverse account fields  
        commonFields.push('name', 'emailaddress1', '_primarycontactid_value')
    } else if (entityLogicalName.startsWith('cp_')) {
        // For custom entities, add most common cp_ field
        commonFields.push('cp_name')
        
        // Note: Specific fields should come from view metadata or entity configuration
        // This function should eventually be deprecated in favor of view-metadata-driven approach
    }
    
    logDebug(`📋 All entity fields for ${entityLogicalName}: ${commonFields.join(', ')}`)
    
    return commonFields.join(',')
}

async function getFieldsFromViewMetadata(viewMetadata, entityConfig) {
    logDebug(`🔍 getFieldsFromViewMetadata called:`)
    logDebug(`🔍 viewMetadata:`, viewMetadata)
    logDebug(`🔍 viewMetadata.columns:`, viewMetadata?.columns)
    logDebug(`🔍 entityConfig:`, entityConfig?.entityLogicalName)
    
    if (viewMetadata && viewMetadata.columns && viewMetadata.columns.length > 0) {
        // Use smart metadata approach for all entities
        const result = await buildSmartQueryFromMetadata(viewMetadata, entityConfig)
        logDebug(`🔍 buildSmartQueryFromMetadata result:`, result)
        return result
    }
    
    logDebug('⚠️ No valid fields found in view metadata, using default')
    return { select: null, expand: null }
}

/**
 * Build smart query using entity metadata to resolve correct navigation property names
 */
async function buildSmartQueryFromMetadata(viewMetadata, entityConfig) {
    logDebug(`🔍 buildSmartQueryFromMetadata called`)
    logDebug(`🔍 viewMetadata.columns:`, viewMetadata.columns)
    logDebug(`🔍 ENTITY CONFIG DEBUG:`, JSON.stringify(entityConfig, null, 2))
    logDebug(`🔍 Contact relation field (contactRelationField):`, entityConfig?.contactRelationField)
    logDebug(`🔍 DYNAMIC FIELD DETECTION - NO MORE HARDCODED cp_contact!`)
    
    const fields = []
    const expands = []
    
    // Process each column from the view metadata
    viewMetadata.columns.forEach(col => {
        const fieldName = col.name
        logDebug(`🔍 Processing column: ${fieldName}`)
        
        if (!fieldName || typeof fieldName !== 'string') {
            logDebug(`🔍 Skipping invalid field: ${fieldName}`)
            return
        }
        
        // Flexible field mapping logic - works for any entity
        if (fieldName.endsWith('_value')) {
            // This is already a lookup field in _fieldname_value format
            logDebug(`🔍 Value field detected: ${fieldName}`)
            fields.push(fieldName)
            
            // Try to add expand for any lookup field dynamically
            const navigationProperty = getNavigationPropertyForLookupField(fieldName, entityConfig)
            if (navigationProperty) {
                // Use appropriate display field based on navigation property
                const displayField = navigationProperty.includes('account') ? 'name' : 'fullname'
                expands.push(`${navigationProperty}($select=${displayField})`)
                logDebug(`🔍 Added expand for ${fieldName}: ${navigationProperty}($select=${displayField})`)
            }
        } else if (fieldName.startsWith('cp_')) {
            // Check if this is a lookup field using inferFieldType
            const fieldType = inferFieldType(fieldName, entityConfig)
            logDebug(`🔍 CP FIELD CHECK: ${fieldName} -> type: ${fieldType}`)
            logDebug(`🔍 *** NEW BUILD CODE LOADED *** - TESTING contactRelationField`)
            logDebug(`🔍 CP FIELD: entityConfig.contactRelationField = ${entityConfig?.contactRelationField}`)
            logDebug(`🔍 CP FIELD: Match check = ${fieldName === entityConfig?.contactRelationField}`)
            
            if (fieldType === 'lookup') {
                // This looks like a lookup field but in display format (e.g., 'cp_contact')
                // Convert to actual lookup field format
                const lookupFieldName = `_${fieldName}_value`
                logDebug(`🔍 Lookup field converted: ${fieldName} -> ${lookupFieldName}`)
                fields.push(lookupFieldName)
                
                // Add expand for the lookup using dynamic navigation property
                const navigationProperty = getNavigationPropertyForLookupField(lookupFieldName, entityConfig)
                if (navigationProperty) {
                    // Use appropriate display field based on navigation property
                    const displayField = navigationProperty.includes('account') ? 'name' : 'fullname'
                    expands.push(`${navigationProperty}($select=${displayField})`)
                    logDebug(`🔍 Added expand for ${lookupFieldName}: ${navigationProperty}($select=${displayField})`)
                }
            } else {
                // Regular cp_ field but not lookup
                logDebug(`🔍 Regular cp_ field: ${fieldName}`)
                fields.push(fieldName)
            }
        } else {
            // Use inferFieldType to determine if this is a lookup field
            const fieldType = inferFieldType(fieldName, entityConfig)
            logDebug(`🔍 INFER BASED CHECK: ${fieldName} -> inferFieldType result: ${fieldType}`)
            
            if (fieldType === 'lookup') {
                // This field is detected as lookup by our inference logic
                const lookupFieldName = `_${fieldName}_value`
                logDebug(`🔍 Lookup field via inference: ${fieldName} -> ${lookupFieldName}`)
                fields.push(lookupFieldName)
                
                // Add expand for the lookup using dynamic navigation property
                const navigationProperty = getNavigationPropertyForLookupField(lookupFieldName, entityConfig)
                if (navigationProperty) {
                    // Use appropriate display field based on navigation property
                    const displayField = navigationProperty.includes('account') ? 'name' : 'fullname'
                    expands.push(`${navigationProperty}($select=${displayField})`)
                    logDebug(`🔍 Added expand for ${lookupFieldName}: ${navigationProperty}($select=${displayField})`)
                }
            } else if (col.type === 'lookup') {
                // Fallback: This field is marked as lookup in view metadata (e.g., parentcustomerid)
                const lookupFieldName = `_${fieldName}_value`
                logDebug(`🔍 Lookup field from metadata: ${fieldName} -> ${lookupFieldName}`)
                fields.push(lookupFieldName)
                
                // Add expand for the lookup using dynamic navigation property
                const navigationProperty = getNavigationPropertyForLookupField(lookupFieldName, entityConfig)
                if (navigationProperty) {
                    // Use appropriate display field based on navigation property
                    const displayField = navigationProperty.includes('account') ? 'name' : 'fullname'
                    expands.push(`${navigationProperty}($select=${displayField})`)
                    logDebug(`🔍 Added expand for ${lookupFieldName}: ${navigationProperty}($select=${displayField})`)
                }
            } else {
                // Regular field - add as is (works for any field name)
                logDebug(`🔍 Regular field: ${fieldName}`)
                fields.push(fieldName)
            }
        }
    })
    
    // Always include the entity ID field for actions
    const entityIdField = `${entityConfig.entityLogicalName}id`
    if (!fields.includes(entityIdField)) {
        logDebug(`🔍 Adding entity ID field: ${entityIdField}`)
        fields.push(entityIdField)
    }
    
    const result = {
        select: fields.length > 0 ? fields.join(',') : null,
        expand: expands.length > 0 ? expands.join(',') : null
    }
    
    logDebug(`🔍 buildSmartQueryFromMetadata result:`)
    logDebug(`🔍 fields array:`, fields)
    logDebug(`🔍 expands array:`, expands)
    logDebug(`🔍 final select:`, result.select)
    logDebug(`🔍 final expand:`, result.expand)
    
    return result
}

/**
 * Get view metadata (reuse from organization function)
 */
async function getViewMetadata(accessToken, viewGuid, entityConfig = null) {
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/savedqueries(${viewGuid})?$select=name,description,layoutxml,fetchxml`
    
    const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
    }, 30000)  // 30s timeout

    if (!response.ok) {
        logWarn('Failed to fetch view metadata:', response.status)
        return null
    }

    const data = await response.json()
    return parseViewMetadata(data, entityConfig)
}

/**
 * Get form metadata (reuse from organization function)
 */
async function getFormMetadata(accessToken, formGuid, entityLogicalName = null) {
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/systemforms(${formGuid})?$select=name,description,formxml`
    
    const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
    }, 30000)  // 30s timeout

    if (!response.ok) {
        logWarn('Failed to fetch form metadata:', response.status)
        return null
    }

    const data = await response.json()
    return await parseFormMetadata(data, accessToken, entityLogicalName)
}

// Import parsing functions from organization.js
function parseViewMetadata(viewData, entityConfig = null) {
    logDebug('🔍 Parsing view metadata for:', viewData.name)
    
    if (!viewData.layoutxml) {
        logWarn('⚠️ No layoutxml found in view data')
        return {
            name: viewData.name,
            columns: []
        }
    }

    try {
        // Parse the layoutxml to extract column information
        const layoutxml = viewData.layoutxml
        logDebug('📋 Layout XML length:', layoutxml.length)
        
        // DEBUG: Log a sample of the XML to understand structure
        const xmlSample = layoutxml.substring(0, 500)
        logDebug('📋 XML Sample:', xmlSample)
        
        // Also check FetchXML for additional metadata
        if (viewData.fetchxml) {
            logDebug('📋 FetchXML length:', viewData.fetchxml.length)
            const fetchSample = viewData.fetchxml.substring(0, 300)
            logDebug('📋 FetchXML Sample:', fetchSample)
        }
        
        // Extract column names from layoutxml using regex
        // This matches: <cell name="fieldname" ...>
        const columnMatches = layoutxml.match(/<cell[^>]+name="([^"]+)"/g)
        
        if (!columnMatches) {
            logWarn('⚠️ No columns found in layoutxml')
            return {
                name: viewData.name,
                columns: []
            }
        }

        const columns = columnMatches.map(match => {
            const nameMatch = match.match(/name="([^"]+)"/)
            const fieldName = nameMatch ? nameMatch[1] : null
            
            if (fieldName) {
                // Try to extract actual display name from the cell XML
                let displayName = formatDisplayName(fieldName) // fallback
                
                // Look for display name in various possible attributes
                const displayNameMatch = match.match(/displayname="([^"]+)"/) || 
                                       match.match(/Display[Nn]ame="([^"]+)"/) ||
                                       match.match(/label="([^"]+)"/) ||
                                       match.match(/Label="([^"]+)"/);
                
                if (displayNameMatch) {
                    displayName = displayNameMatch[1]
                    logDebug(`📋 FOUND DISPLAY NAME: ${fieldName} -> "${displayName}"`)
                } else {
                    logDebug(`📋 NO DISPLAY NAME FOUND FOR: ${fieldName}, using fallback: "${displayName}"`)
                }
                
                // Try to get width from the XML
                const widthMatch = match.match(/width="([^"]+)"/)
                const width = widthMatch ? widthMatch[1] : '120px'
                
                logDebug(`🔍 COLUMN PARSED: ${fieldName} -> "${displayName}" (width: ${width})`)
                
                return {
                    name: fieldName,
                    displayName: displayName,
                    type: inferFieldType(fieldName, entityConfig),
                    width: width
                }
            }
            return null
        }).filter(col => col !== null)

        return {
            name: viewData.name,
            description: viewData.description,
            columns: columns
        }
    } catch (error) {
        console.error('❌ Error parsing view metadata:', error.message)
        return {
            name: viewData.name,
            columns: []
        }
    }
}

function formatDisplayName(fieldName) {
    // ALIGNED WITH FRONTEND: Use exact same mappings as frontend formatDisplayName function
    const displayNames = {
        'contactid': 'ID',
        'accountid': 'ID',
        'fullname': 'Full Name',
        'firstname': 'First Name',
        'lastname': 'Last Name',
        'emailaddress1': 'Email',
        'mobilephone': 'Mobile',  // Match frontend: 'Mobile' not 'Mobile Phone'
        'telephone1': 'Phone',
        'name': 'Name',
        'cp_name': 'Name',
        'cp_description': 'Description',
        'createdon': 'Created',   // Match frontend: 'Created' not 'Created On'
        'modifiedon': 'Modified', // Match frontend: 'Modified' not 'Modified On'
        '_parentcustomerid_value': 'Company',
        '_primarycontactid_value': 'Primary Contact',
        'cp_portaladmin': 'Portal Admin'
    }
    
    // Check direct mapping first (aligned with frontend)
    if (displayNames[fieldName]) {
        logDebug(`📋 FRONTEND-ALIGNED DISPLAY NAME: ${fieldName} -> "${displayNames[fieldName]}"`)
        return displayNames[fieldName]
    }
    
    // Fallback: Use same logic as frontend for consistency
    const fallback = fieldName.replace(/^cp_/, '').replace(/^_/, '').replace(/_value$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    logDebug(`📋 FRONTEND-ALIGNED FALLBACK: ${fieldName} -> "${fallback}"`)
    return fallback
}

function inferFieldType(fieldName, entityConfig = null) {
    logDebug(`🔍 INFER FIELD TYPE DEBUG: fieldName=${fieldName}, entityConfig=`, entityConfig)
    logDebug(`🔍 INFER: entityConfig.contactRelationField =`, entityConfig?.contactRelationField)
    logDebug(`🔍 INFER: Match check: ${fieldName} === ${entityConfig?.contactRelationField} = ${fieldName === entityConfig?.contactRelationField}`)
    
    if (fieldName.includes('email')) return 'email'
    if (fieldName.includes('phone') || fieldName.includes('telephone')) return 'phone'
    if (fieldName.includes('createdon') || fieldName.includes('modifiedon')) return 'datetime'
    if (fieldName.endsWith('_value')) return 'lookup'
    if (fieldName === 'statuscode' || fieldName === 'statecode') return 'optionset'
    
    // Dynamic contact lookup field detection based on entity configuration
    if (entityConfig?.contactRelationField && fieldName === entityConfig.contactRelationField) {
        logDebug(`🎯 DETECTED AS LOOKUP FIELD: ${fieldName} (matches config contactRelationField)`)
        return 'lookup'
    }
    
    // Dynamic account lookup field detection based on entity configuration
    if (entityConfig?.accountRelationField && fieldName === entityConfig.accountRelationField) {
        logDebug(`🎯 DETECTED AS ACCOUNT LOOKUP FIELD: ${fieldName} (matches config accountRelationField)`)
        return 'lookup'
    }
    
    logDebug(`📝 DETECTED AS TEXT FIELD: ${fieldName}`)
    return 'text'
}

async function parseFormMetadata(formData, accessToken, entityLogicalName) {
    logDebug('🔍 Parsing form metadata for:', formData.name)
    
    if (!formData.formxml) {
        logWarn('⚠️ No formxml found in form data')
        return {
            name: formData.name,
            structure: { tabs: [] }
        }
    }

    try {
        const formxml = formData.formxml
        logDebug('📋 Form XML length:', formxml.length)
        
        // Parse tabs and subgrids from formxml
        const parseResult = parseTabsFromFormXml(formxml)
        const formTabs = parseResult.formTabs || []
        const subgrids = parseResult.subgrids || []
        
        logDebug(`📋 Parsed ${formTabs.length} form tabs, ${subgrids.length} subgrids`)
        
        // Enrich subgrids with relationship metadata
        const enrichedSubgrids = []
        if (subgrids.length > 0 && accessToken && entityLogicalName) {
            for (const subgrid of subgrids) {
                try {
                    logDebug(`🔗 Enriching subgrid: ${subgrid.displayName}`)
                    
                    // Get relationship metadata from Dataverse
                    const relationshipMeta = await getRelationshipMetadata(
                        accessToken,
                        entityLogicalName,
                        subgrid.relationshipName
                    )
                    
                    if (relationshipMeta) {
                        // Create subgrid tab with complete metadata
                        const subgridTab = {
                            type: 'subgrid',
                            name: subgrid.id,
                            displayName: subgrid.displayName,
                            targetEntity: subgrid.targetEntity,
                            relationshipName: subgrid.relationshipName,
                            relationshipField: `_${relationshipMeta.referencingAttribute}_value`,  // Exact lookup field
                            viewId: subgrid.viewId,
                            sections: []  // Subgrids don't have sections
                        }
                        
                        enrichedSubgrids.push(subgridTab)
                        logDebug(`✅ Enriched subgrid: ${subgridTab.displayName} -> ${subgridTab.relationshipField}`)
                    } else {
                        logWarn(`⚠️ Could not enrich subgrid: ${subgrid.displayName} (relationship not found)`)
                    }
                } catch (error) {
                    logError(`❌ Error enriching subgrid ${subgrid.displayName}:`, error)
                }
            }
        }
        
        // Combine form tabs + enriched subgrid tabs
        const allTabs = [...formTabs, ...enrichedSubgrids]
        
        logDebug(`✅ Total tabs (form + subgrids): ${allTabs.length}`)
        
        return {
            name: formData.name,
            description: formData.description,
            structure: { tabs: allTabs }
        }
    } catch (error) {
        console.error('❌ Error parsing form metadata:', error.message)
        return {
            name: formData.name,
            structure: { tabs: [] }
        }
    }
}

/**
 * Parse tabs and fields from Dataverse form XML
 */
function parseTabsFromFormXml(formxml) {
    const tabs = []
    const subgrids = []  // Collect subgrids found in the form
    
    try {
        // Extract tab elements using regex (basic XML parsing)
        const tabMatches = formxml.match(/<tab[^>]*>.*?<\/tab>/gs)
        
        if (!tabMatches) {
            logWarn('⚠️ No tabs found in form XML')
            return []
        }

        tabMatches.forEach((tabXml, tabIndex) => {
            // Extract tab attributes
            const nameMatch = tabXml.match(/name="([^"]*)"/)
            const labelMatch = tabXml.match(/label="([^"]*)"/)
            
            // Extract visibility attributes for tabs
            const visibleMatch = tabXml.match(/visible="([^"]*)"/)
            const showLabelMatch = tabXml.match(/showlabel="([^"]*)"/)
            const hiddenMatch = tabXml.match(/hidden="([^"]*)"/)
            const hideLabelMatch = tabXml.match(/hidelabel="([^"]*)"/)
            
            const tabName = nameMatch ? nameMatch[1] : `Tab${tabIndex + 1}`
            const tabLabel = labelMatch ? labelMatch[1] : tabName
            
            // Parse boolean values from XML attributes
            const visible = visibleMatch ? visibleMatch[1].toLowerCase() === 'true' : true
            const showLabel = showLabelMatch ? showLabelMatch[1].toLowerCase() === 'true' : true
            const hidden = hiddenMatch ? hiddenMatch[1].toLowerCase() === 'true' : false
            const hideLabel = hideLabelMatch ? hideLabelMatch[1].toLowerCase() === 'true' : false
            
            // Extract sections within this tab
            const sections = parseSectionsFromTabXml(tabXml)
            
            // Collect any subgrids found in sections
            sections.forEach(section => {
                section.rows?.forEach(row => {
                    row.cells?.forEach(cell => {
                        cell.controls?.forEach(control => {
                            if (control.type === 'subgrid') {
                                subgrids.push(control)
                            }
                        })
                    })
                })
            })
            
            tabs.push({
                type: 'form',
                name: tabName,
                displayName: tabLabel,
                visible: visible,
                showLabel: showLabel,
                hidden: hidden,
                hideLabel: hideLabel,
                sections: sections
            })
        })
        
        logDebug(`✅ Parsed ${tabs.length} form tabs from form XML`)
        logDebug(`📋 Found ${subgrids.length} subgrids in form`)
        
        // Return both tabs and subgrids for enrichment
        return { formTabs: tabs, subgrids: subgrids }
        
    } catch (error) {
        console.error('❌ Error parsing tabs from form XML:', error.message)
        return { formTabs: [], subgrids: [] }
    }
}

/**
 * Parse sections and fields from tab XML
 */
function parseSectionsFromTabXml(tabXml) {
    const sections = []
    
    try {
        // Extract section elements
        const sectionMatches = tabXml.match(/<section[^>]*>.*?<\/section>/gs)
        
        if (!sectionMatches) {
            logWarn('⚠️ No sections found in tab XML')
            return []
        }

        sectionMatches.forEach((sectionXml, sectionIndex) => {
            // Extract section attributes
            const nameMatch = sectionXml.match(/name="([^"]*)"/)
            const labelMatch = sectionXml.match(/label="([^"]*)"/)
            
            // Extract visibility attributes
            const visibleMatch = sectionXml.match(/visible="([^"]*)"/)
            const showLabelMatch = sectionXml.match(/showlabel="([^"]*)"/)
            const hiddenMatch = sectionXml.match(/hidden="([^"]*)"/)
            const hideLabelMatch = sectionXml.match(/hidelabel="([^"]*)"/)
            
            const sectionName = nameMatch ? nameMatch[1] : `Section${sectionIndex + 1}`
            const sectionLabel = labelMatch ? labelMatch[1] : sectionName
            
            // Parse boolean values from XML attributes
            const visible = visibleMatch ? visibleMatch[1].toLowerCase() === 'true' : true
            const showLabel = showLabelMatch ? showLabelMatch[1].toLowerCase() === 'true' : true
            const hidden = hiddenMatch ? hiddenMatch[1].toLowerCase() === 'true' : false
            const hideLabel = hideLabelMatch ? hideLabelMatch[1].toLowerCase() === 'true' : false
            
            // Extract rows (controls) within this section
            const rows = parseRowsFromSectionXml(sectionXml)
            
            sections.push({
                name: sectionName,
                displayName: sectionLabel,
                visible: visible,
                showLabel: showLabel,
                hidden: hidden,
                hideLabel: hideLabel,
                rows: rows
            })
        })
        
        return sections
        
    } catch (error) {
        console.error('❌ Error parsing sections from tab XML:', error.message)
        return []
    }
}

/**
 * Parse rows and controls from section XML
 */
function parseRowsFromSectionXml(sectionXml) {
    const rows = []
    
    try {
        // Extract control elements (fields)
        const controlMatches = sectionXml.match(/<control[^>]*(?:\/>|>.*?<\/control>)/gs)
        
        if (!controlMatches) {
            logWarn('⚠️ No controls found in section XML')
            return []
        }

        logDebug(`🔍 Found ${controlMatches.length} control elements in section`)

        // Group controls into rows (for simplicity, each control is its own row)
        controlMatches.forEach((controlXml, controlIndex) => {
            // Log ALL control IDs for debugging
            const idMatch = controlXml.match(/id="([^"]*)"/)
            const datafieldMatch = controlXml.match(/datafieldname="([^"]*)"/)
            logDebug(`🔍 Control ${controlIndex}: id="${idMatch?.[1] || 'none'}", datafieldname="${datafieldMatch?.[1] || 'none'}"`)
            
            // DYNAMIC SubGrid detection: Check if control has SubGrid parameters structure
            // Instead of hardcoded classid, look for the actual SubGrid metadata
            const hasSubgridParameters = controlXml.includes('<parameters>') && 
                                        (controlXml.includes('<TargetEntityType>') || 
                                         controlXml.includes('<RelationshipName>'))
            
            if (hasSubgridParameters) {
                logDebug(`📋 Found SubGrid control at index ${controlIndex} (detected by parameters structure)`)
                // Parse subgrid metadata
                const subgrid = parseSubgridFromXml(controlXml)
                if (subgrid) {
                    logDebug(`✅ Successfully parsed subgrid: ${subgrid.displayName}`)
                    rows.push({
                        cells: [{
                            controls: [subgrid]
                        }]
                    })
                } else {
                    logWarn(`⚠️ Failed to parse subgrid at index ${controlIndex}`)
                }
            } else {
                // Parse regular control
                const control = parseControlFromXml(controlXml)
                
                if (control) {
                    rows.push({
                        cells: [{
                            controls: [control]
                        }]
                    })
                }
            }
        })
        
        return rows
        
    } catch (error) {
        console.error('❌ Error parsing rows from section XML:', error.message)
        return []
    }
}

/**
 * Parse individual control from XML
 */
function parseControlFromXml(controlXml) {
    try {
        // Extract control attributes
        const datafieldnameMatch = controlXml.match(/datafieldname="([^"]*)"/)
        const labelMatch = controlXml.match(/label="([^"]*)"/)
        const disabledMatch = controlXml.match(/disabled="([^"]*)"/)
        const classtypeMatch = controlXml.match(/classtype="([^"]*)"/)
        
        if (!datafieldnameMatch) {
            // Skip controls without datafieldname (e.g., spacers, labels)
            return null
        }
        
        const fieldName = datafieldnameMatch[1]
        const fieldLabel = labelMatch ? labelMatch[1] : formatDisplayName(fieldName)
        const isDisabled = disabledMatch ? disabledMatch[1] === 'true' : false
        const classType = classtypeMatch ? classtypeMatch[1] : null
        
        // Detect rich text fields
        const isRichText = isRichTextField(controlXml, fieldName, classType)
        
        // Infer control type from field name and XML attributes
        const controlType = isRichText ? 'richtext' : inferControlType(fieldName, classType)
        
        return {
            type: 'control',
            datafieldname: fieldName,
            displayName: fieldLabel,
            controlType: controlType,
            disabled: isDisabled,
            isRichText: isRichText,
            classType: classType
        }
        
    } catch (error) {
        console.error('❌ Error parsing control from XML:', error.message)
        return null
    }
}

/**
 * Detect if a field is a rich text field
 */
function isRichTextField(controlXml, fieldName, classType) {
    // Check for rich text indicators in the XML
    if (controlXml.includes('RichTextControl') || 
        controlXml.includes('richtext') || 
        classType === 'RichTextControl') {
        return true
    }
    
    // Check for common rich text field naming patterns
    const richTextPatterns = [
        'description',
        'notes',
        'content',
        'body',
        'details',
        'comments',
        'summary'
    ]
    
    const fieldLower = fieldName.toLowerCase()
    return richTextPatterns.some(pattern => fieldLower.includes(pattern))
}

/**
 * Infer control type from field name and class type
 */
function inferControlType(fieldName, classType) {
    // First check class type for specific control types
    if (classType) {
        if (classType.includes('RichText')) return 'richtext'
        if (classType.includes('DateTime')) return 'datetime'
        if (classType.includes('Lookup')) return 'lookup'
        if (classType.includes('OptionSet')) return 'optionset'
        if (classType.includes('Boolean')) return 'boolean'
    }
    
    // Then check field name patterns
    if (fieldName.includes('email')) return 'email'
    if (fieldName.includes('phone') || fieldName.includes('telephone')) return 'phone'
    if (fieldName.includes('createdon') || fieldName.includes('modifiedon')) return 'datetime'
    if (fieldName.endsWith('_value')) return 'lookup'
    if (fieldName === 'statuscode' || fieldName === 'statecode') return 'optionset'
    if (fieldName.includes('description') || fieldName.includes('notes')) return 'multitext'
    
    // Handle boolean fields (common naming patterns)
    if (fieldName.includes('admin') || fieldName.includes('active') || fieldName.includes('enabled')) {
        return 'boolean'
    }
    
    return 'text'
}

/**
 * Parse subgrid control from XML
 * Extracts subgrid metadata including relationship name, target entity, and view ID
 */
function parseSubgridFromXml(controlXml) {
    try {
        // Extract control ID and label
        const idMatch = controlXml.match(/id="([^"]*)"/)
        const labelMatch = controlXml.match(/label="([^"]*)"/)
        
        const subgridId = idMatch ? idMatch[1] : 'subgrid'
        const subgridLabel = labelMatch ? labelMatch[1] : 'Related Records'
        
        // Extract parameters section
        const parametersMatch = controlXml.match(/<parameters>(.*?)<\/parameters>/s)
        
        if (!parametersMatch) {
            logWarn(`⚠️ No parameters found for subgrid: ${subgridId}`)
            return null
        }
        
        const parametersXml = parametersMatch[1]
        
        // Extract key metadata from parameters
        const targetEntityMatch = parametersXml.match(/<TargetEntityType>([^<]+)<\/TargetEntityType>/)
        const viewIdMatch = parametersXml.match(/<ViewId>\{?([^}<]+)\}?<\/ViewId>/)
        const relationshipMatch = parametersXml.match(/<RelationshipName>([^<]+)<\/RelationshipName>/)
        
        const targetEntity = targetEntityMatch ? targetEntityMatch[1] : null
        const viewId = viewIdMatch ? viewIdMatch[1] : null
        const relationshipName = relationshipMatch ? relationshipMatch[1] : null
        
        if (!targetEntity || !relationshipName) {
            logWarn(`⚠️ Subgrid missing required metadata: ${subgridId}`)
            return null
        }
        
        logDebug(`📋 Parsed subgrid: ${subgridId} -> ${targetEntity} (${relationshipName})`)
        
        return {
            type: 'subgrid',
            id: subgridId,
            displayName: subgridLabel,
            targetEntity: targetEntity,
            relationshipName: relationshipName,
            viewId: viewId
        }
        
    } catch (error) {
        console.error('❌ Error parsing subgrid from XML:', error.message)
        return null
    }
}

/**
 * Get user contact information by GUID - SECURE DIRECT LOOKUP
 */
async function getUserContactByGuid(accessToken, contactGuid) {
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    // Direct GUID lookup - most secure approach
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/contacts(${contactGuid})?$select=contactid,cp_portaladmin,_parentcustomerid_value`

    logDebug(`🔍 SECURITY: Looking up contact by GUID: ${contactGuid}`)
    
    const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
    }, 30000)  // 30s timeout

    if (!response.ok) {
        if (response.status === 404) {
            console.error(`🛡️ SECURITY: Contact GUID ${contactGuid} not found`)
        } else {
            console.error(`🛡️ SECURITY: Failed to fetch contact by GUID: ${response.status}`)
        }
        return null
    }

    const contact = await response.json()
    logDebug(`✅ SECURITY: Contact verified - ${contactGuid}`)
    return contact
}

/**
 * Get user contact information (legacy email-based lookup - deprecated)
 */
async function getUserContact(accessToken, userEmail) {
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    const filter = buildSecureEmailFilter(userEmail)
    const select = 'contactid,cp_portaladmin,_parentcustomerid_value'
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/contacts?$filter=${encodeURIComponent(filter)}&$select=${select}`

    const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
    }, 30000)  // 30s timeout

    if (!response.ok) {
        console.error('Failed to fetch user contact')
        return null
    }

    const data = await response.json()
    return data.value && data.value.length > 0 ? data.value[0] : null
}

/**
 * Helper function to get access token
 */
async function getAccessToken() {
    try {
        const { handler: authHandler } = await import('./auth.js')
        const authEvent = {
            httpMethod: 'POST',
            body: '',
            queryStringParameters: null,
        }
        const authResult = await authHandler(authEvent, {})
        
        if (authResult.statusCode === 200) {
            const authData = JSON.parse(authResult.body)
            return authData.access_token
        }
        return null
    } catch (error) {
        console.error('Error getting access token:', error)
        return null
    }
}

/**
 * Resolve URL path to entity logical name using entity configurations
 */
async function resolveEntityName(urlPathOrName, accessToken) {
    try {
        // Directly query Dataverse for entity configurations (bypass handler auth requirements)
        const filter = 'statecode eq 0'  // Only active configurations
        const select = 'cp_entityconfigid,cp_name,cp_entitylogicalname'
        const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/cp_entityconfigs?$filter=${encodeURIComponent(filter)}&$select=${select}`
        
        logDebug('🔍 RESOLVE ENTITY NAME: Querying Dataverse for configs...')
        
        const response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Accept': 'application/json',
            },
        })
        
        if (!response.ok) {
            logWarn('Failed to fetch entity configurations for resolution:', response.status)
            return null
        }
        
        const data = await response.json()
        const configs = data.value || []
        
        logDebug(`🔍 RESOLVE ENTITY NAME: Found ${configs.length} configurations`)
        logDebug(`🔍 RESOLVE ENTITY NAME: Looking for: "${urlPathOrName}"`)
        
        // First try direct match with logical name (backward compatibility)
        let matchedConfig = configs.find(config => config.cp_entitylogicalname === urlPathOrName)
        
        if (matchedConfig) {
            logDebug(`✅ RESOLVE ENTITY NAME: Matched by logical name: ${matchedConfig.cp_entitylogicalname}`)
            return matchedConfig.cp_entitylogicalname
        }
        
        // If no direct match, try cp_name match
        matchedConfig = configs.find(config => config.cp_name === urlPathOrName)
        
        if (matchedConfig) {
            logDebug(`✅ RESOLVE ENTITY NAME: Matched by display name: ${matchedConfig.cp_name} -> ${matchedConfig.cp_entitylogicalname}`)
            return matchedConfig.cp_entitylogicalname
        }
        
        // If still no match, try flexible plural/singular matching
        const urlLower = urlPathOrName.toLowerCase()
        matchedConfig = configs.find(config => {
            const nameLower = (config.cp_name || '').toLowerCase()
            // Try adding/removing 's' for basic plural/singular matching
            return nameLower === urlLower + 's' || 
                   nameLower === urlLower.replace(/s$/, '') ||
                   nameLower + 's' === urlLower
        })
        
        if (matchedConfig) {
            logDebug(`✅ RESOLVE ENTITY NAME: Matched by plural/singular: ${matchedConfig.cp_name} -> ${matchedConfig.cp_entitylogicalname}`)
            return matchedConfig.cp_entitylogicalname
        }
        
        logWarn(`❌ RESOLVE ENTITY NAME: No match found for "${urlPathOrName}"`)
        logWarn(`❌ Available configs:`, configs.map(c => `${c.cp_name} (${c.cp_entitylogicalname})`).join(', '))
        return null
        
    } catch (error) {
        console.error('Error resolving entity name:', error)
        return null
    }
}

/**
 * Derive navigation property name from contact relation field
 */
function getContactNavigationProperty(contactRelationField) {
    if (!contactRelationField) return null
    
    // Standard pattern: cp_contact -> cp_Contact (capitalize first letter after prefix)
    return contactRelationField.replace(/^cp_([a-z])/, (match, letter) => `cp_${letter.toUpperCase()}`)
}

/**
 * Get dynamic field to navigation property mappings based on entity configuration
 */
function getFieldNavigationPropertyMap(entityConfig) {
    const navigationPropertyMap = {
        '_contactid_value': 'contactid', 
        'contactid': 'contactid',
        '_createdby_value': 'createdby',
        '_modifiedby_value': 'modifiedby',
        '_ownerid_value': 'ownerid',
        '_parentcustomerid_value': 'parentcustomerid_account'
    }
    
    // Add configured contact field mapping if available
    if (entityConfig?.contactRelationField) {
        const contactField = entityConfig.contactRelationField
        const contactNavProperty = getContactNavigationProperty(contactField)
        
        logDebug(`🔍 NAVIGATION PROPERTY DEBUG:`)
        logDebug(`🔍   Contact field: ${contactField}`)
        logDebug(`🔍   Derived navigation property: ${contactNavProperty}`)
        
        if (contactNavProperty) {
            navigationPropertyMap[`_${contactField}_value`] = contactNavProperty
            navigationPropertyMap[contactField] = contactNavProperty
            logDebug(`🔍 Added dynamic contact mapping: ${contactField} -> ${contactNavProperty}`)
            logDebug(`🔍   Mapping _${contactField}_value -> ${contactNavProperty}`)
            logDebug(`🔍   Mapping ${contactField} -> ${contactNavProperty}`)
        }
    }
    
    logDebug(`🔍 Final navigation property map:`, navigationPropertyMap)
    
    return navigationPropertyMap
}

/**
 * Convert lookup field name to navigation property name for Dataverse @odata.bind
 * Maps field names like '_cp_contact_value' or 'cp_contact' to navigation properties like 'cp_Contact'
 */
function getNavigationPropertyForLookupField(fieldName, entityConfig = null) {
    logDebug(`🔍 LOOKUP NAVIGATION DEBUG: ${fieldName}`)
    logDebug(`🔍   EntityConfig provided:`, !!entityConfig)
    logDebug(`🔍   ContactRelationField:`, entityConfig?.contactRelationField)
    
    // Get dynamic mappings based on entity configuration
    const navigationPropertyMap = getFieldNavigationPropertyMap(entityConfig || {})
    
    logDebug(`🔍   Available mappings:`, Object.keys(navigationPropertyMap))
    logDebug(`🔍   Looking for mapping of: ${fieldName}`)
    
    // Check direct mapping first
    if (navigationPropertyMap[fieldName]) {
        logDebug(`🔍   Found direct mapping: ${fieldName} -> ${navigationPropertyMap[fieldName]}`)
        return navigationPropertyMap[fieldName]
    }
    
    // Try to auto-generate for custom lookup fields
    // Pattern: _cp_entityname_value → cp_Entityname
    const customLookupMatch = fieldName.match(/^_cp_(.+)_value$/)
    if (customLookupMatch) {
        const entityPart = customLookupMatch[1]
        // Capitalize first letter: contact → Contact, organization → Organization
        const capitalizedEntity = entityPart.charAt(0).toUpperCase() + entityPart.slice(1)
        return `cp_${capitalizedEntity}`
    }
    
    // Pattern: cp_entityname → cp_Entityname  
    const customFieldMatch = fieldName.match(/^cp_(.+)$/)
    if (customFieldMatch) {
        const entityPart = customFieldMatch[1]
        const capitalizedEntity = entityPart.charAt(0).toUpperCase() + entityPart.slice(1)
        return `cp_${capitalizedEntity}`
    }
    
    logWarn(`Could not determine navigation property for lookup field: ${fieldName}`)
    return null
}

/**
 * Get entity set name for lookup field to construct @odata.bind reference
 * Maps field names to their target entity set names
 */
function getEntitySetNameForLookupField(fieldName) {
    // Known entity set mappings - FIXED: Ensure contact lookups point to standard 'contacts' set
    const entitySetMap = {
        '_cp_contact_value': 'contacts',    // ✅ Standard contacts entity set
        'cp_contact': 'contacts',           // ✅ Standard contacts entity set  
        '_contactid_value': 'contacts',     // ✅ Standard contacts entity set
        'contactid': 'contacts',            // ✅ Standard contacts entity set
        '_createdby_value': 'systemusers',
        '_modifiedby_value': 'systemusers', 
        '_ownerid_value': 'systemusers',
        '_parentcustomerid_value': 'accounts'
    }
    
    // Check direct mapping first
    if (entitySetMap[fieldName]) {
        return entitySetMap[fieldName]
    }
    
    // Try to auto-generate for custom lookup fields
    // Pattern: _cp_entityname_value → cp_entitynames (pluralized)
    const customLookupMatch = fieldName.match(/^_cp_(.+)_value$/)
    if (customLookupMatch) {
        const entityPart = customLookupMatch[1]
        // Simple pluralization: contact → contacts, organization → organizations
        return `cp_${entityPart}s`
    }
    
    // Pattern: cp_entityname → cp_entitynames
    const customFieldMatch = fieldName.match(/^cp_(.+)$/)
    if (customFieldMatch) {
        const entityPart = customFieldMatch[1]
        return `cp_${entityPart}s`
    }
    
    logWarn(`Could not determine entity set name for lookup field: ${fieldName}`)
    return null
}
