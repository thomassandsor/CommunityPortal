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

import { validateSimpleAuth, createAuthErrorResponse, createSuccessResponse, buildSecureEmailFilter, sanitizeGuid, isValidGuid, validateContactOwnership, getSecureCorsHeaders, checkRateLimit, createRateLimitResponse, createSafeErrorResponse } from './auth-utils.js'

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

    console.log(`🚀 GENERIC-ENTITY FUNCTION CALLED v2`)
    console.log(`🚀 Method: ${event.httpMethod}`)
    console.log(`🚀 Path: ${event.path}`)
    console.log(`🚀 Query: ${JSON.stringify(event.queryStringParameters)}`)
    
    // EARLY DEBUG: Check the contact GUID from query parameters
    const contactGuidFromQuery = event.queryStringParameters?.contactGuid
    if (contactGuidFromQuery) {
        console.log(`🔍 EARLY DEBUG: Contact GUID from query: "${contactGuidFromQuery}"`)
        console.log(`🔍 EARLY DEBUG: GUID length: ${contactGuidFromQuery.length}`)
        console.log(`🔍 EARLY DEBUG: GUID segments: ${contactGuidFromQuery.split('-').map(s => s.length).join('-')}`)
    }

    try {
        // Authenticate user (simple auth - no email required)
        const user = await validateSimpleAuth(event)
        console.log(`✅ Generic entity request from: ${user.userId}`)
        
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
        console.log(`🔍 LOADING ENTITY CONFIG for: ${entityLogicalName}`)
        const entityConfig = await getEntityConfiguration(accessToken, entityLogicalName)
        console.log(`🔍 ENTITY CONFIG RESULT:`, entityConfig)
        
        if (!entityConfig) {
            console.error(`❌ ENTITY CONFIG NOT FOUND for: ${entityLogicalName}`)
            return createAuthErrorResponse(`Entity configuration not found for ${entityLogicalName}. Please create a configuration record in cp_entityconfigurations table.`, 404, origin)
        }
        
        console.log(`✅ ENTITY CONFIG LOADED:`, {
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
        console.log(`🔍 SECURITY: Validating Contact GUID: "${contactGuid}"`)
        
        try {
            // Use the new secure GUID validation function
            contactGuid = sanitizeGuid(contactGuid, 'Contact GUID')
            console.log(`✅ SECURITY: Contact GUID validated and sanitized: ${contactGuid}`)
        } catch (guidError) {
            console.error(`🛡️ SECURITY VIOLATION: ${guidError.message}`)
            return createAuthErrorResponse(guidError.message, 401, origin)
        }
        
        // 🔒 CRITICAL SECURITY: Verify the contact GUID belongs to the authenticated user
        try {
            userContact = await validateContactOwnership(contactGuid, user, accessToken)
            console.log(`✅ OWNERSHIP: Contact ${contactGuid} ownership verified for user ${user.userId}`)
        } catch (ownershipError) {
            console.error(`🛡️ OWNERSHIP VIOLATION: ${ownershipError.message}`)
            return createAuthErrorResponse(`Access denied: ${ownershipError.message}`, 403, origin)
        }
        if (!userContact || !userContact.contactid) {
            console.error(`🛡️ SECURITY VIOLATION: No contact record found for GUID: ${contactGuid}`)
            return createAuthErrorResponse('Contact record not found or invalid', 403, origin)
        }

        console.log(`🛡️ SECURITY: User verified - Contact ID: ${userContact.contactid}`)

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
    
    console.log('🔍 Fetching entity metadata for:', entityLogicalName)
    console.log('🌐 Metadata URL:', url)
    
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
                console.log(`📊 PAGINATION: Requested ${parsedTop}, enforcing ${requestedTop} (max ${MAX_RECORDS})`)
            }
        }
        
        // Validate and sanitize $skip parameter for pagination
        if (event.queryStringParameters.$skip || event.queryStringParameters.skip) {
            const skipParam = event.queryStringParameters.$skip || event.queryStringParameters.skip
            const parsedSkip = parseInt(skipParam, 10)
            
            if (!isNaN(parsedSkip) && parsedSkip >= 0) {
                skip = parsedSkip
                console.log(`📊 PAGINATION: Skip ${skip} records`)
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
    console.log(`🔍 LIST REQUEST DEBUG:`)
    console.log(`🔍 Entity: ${entityConfig.entityLogicalName}`)
    console.log(`🔍 Entity Set: ${getEntitySetName(entityConfig.entityLogicalName)}`)
    console.log(`🔍 Security Filter: ${securityFilter}`)
    console.log(`🔍 Pagination: top=${requestedTop}, skip=${skip}`)
    console.log(`🔍 Select: ${finalSelect}`)
    console.log(`🔍 Expand: ${expand}`)
    console.log(`🔍 Complete URL: ${url}`)

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
            'Prefer': 'odata.include-annotations="*"'  // Include count
        },
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Dataverse API Error:', response.status, errorText)
        throw new Error(`Failed to fetch entities: ${response.status}`)
    }

    const data = await response.json()
    const entities = data.value || []
    const totalCount = data['@odata.count'] !== undefined ? data['@odata.count'] : entities.length
    const nextLink = data['@odata.nextLink']

    console.log(`✅ Successfully retrieved ${entities.length} entities (total available: ${totalCount})`)
    console.log(`🔍 SAMPLE ENTITY DATA:`, entities[0])
    console.log(`🔍 ENTITY KEYS:`, entities.length > 0 ? Object.keys(entities[0]) : 'No entities')
    
    // Check for expanded contact data using dynamic navigation property
    if (entities.length > 0 && entityConfig?.contactRelationField) {
        const contactNavProperty = getContactNavigationProperty(entityConfig.contactRelationField)
        if (contactNavProperty && entities[0][contactNavProperty]) {
            console.log(`🔍 EXPANDED CONTACT DATA (${contactNavProperty}):`, entities[0][contactNavProperty])
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
    console.log(`🔍 Fetching form metadata for ${entityConfig.entityLogicalName}...`)
    
    if (!entityConfig.formGuid) {
        throw new Error('Form GUID not configured for this entity')
    }

    const formMetadata = await getFormMetadata(accessToken, entityConfig.formGuid)
    
    return createSuccessResponse({
        formMetadata: formMetadata,
        entityConfig: entityConfig,
        mode: 'form'
    }, 200, origin)
}

/**
 * Handle single entity request - ENHANCED USER SCOPING
 */
async function handleSingleEntityRequest(accessToken, entityConfig, userContact, entityId, origin = null) {
    console.log(`🔍 Fetching single ${entityConfig.entityLogicalName}: ${entityId} for user: ${userContact.contactid}`)
    
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    // SECURITY ENHANCEMENT: Build mandatory user-scoped security filter
    const securityFilter = await buildEntitySecurityFilter(accessToken, entityConfig, userContact, 'personal')
    const idField = getEntityIdField(entityConfig.entityLogicalName)
    const filter = `${idField} eq '${entityId}' and (${securityFilter})`
    
    console.log(`🛡️ SECURITY: Single entity filter - ${filter}`)
    
    // ENHANCED: For edit view, we need ALL fields (not just view fields) plus lookup expansions
    // Start with all entity fields including system date fields
    const allFields = getAllEntityFields(entityConfig.entityLogicalName).split(',')
    console.log(`🔍 SINGLE ENTITY: Starting with all fields: ${allFields.join(', ')}`)
    
    // Add dynamic fields from entity configuration
    if (entityConfig.cp_keyfields) {
        const keyFields = Array.isArray(entityConfig.cp_keyfields) ? 
            entityConfig.cp_keyfields : 
            entityConfig.cp_keyfields.split(',').map(f => f.trim())
        
        keyFields.forEach(field => {
            if (!allFields.includes(field)) {
                allFields.push(field)
                console.log(`🔍 SINGLE ENTITY: Added key field: ${field}`)
            }
        })
    }
    
    // Get lookup expansions using smart query building for consistency
    let expand = null
    let viewMetadata = null
    
    if (entityConfig.viewMainGuid) {
        try {
            viewMetadata = await getViewMetadata(accessToken, entityConfig.viewMainGuid, entityConfig)
            console.log(`📋 Got view metadata for lookup expansions: ${viewMetadata?.name}`)
            
            // Use smart query building ONLY for lookup expansions
            const queryResult = await buildSmartQueryFromMetadata(viewMetadata, entityConfig)
            expand = queryResult.expand
            console.log(`🎯 SINGLE ENTITY: Using smart expansions: ${expand}`)
            
            // Also add any fields from view that aren't already included
            if (queryResult.select) {
                const viewFields = queryResult.select.split(',')
                viewFields.forEach(field => {
                    const trimmedField = field.trim()
                    if (!allFields.includes(trimmedField)) {
                        allFields.push(trimmedField)
                        console.log(`🔍 SINGLE ENTITY: Added view field: ${trimmedField}`)
                    }
                })
            }
        } catch (error) {
            console.warn('Could not fetch view metadata for single entity:', error.message)
        }
    }
    
    // Add contact lookup field and expansion if configured
    if (entityConfig.contactRelationField) {
        const contactFieldName = `_${entityConfig.contactRelationField}_value`
        const contactNavProperty = getContactNavigationProperty(entityConfig.contactRelationField)
        
        if (!allFields.includes(contactFieldName)) {
            allFields.push(contactFieldName)
            console.log(`🔍 SINGLE ENTITY: Added contact field: ${contactFieldName}`)
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
            console.log(`🔍 SINGLE ENTITY: Added contact expansion: ${contactExpansion}`)
        }
    }
    
    const select = allFields.join(',')
    console.log(`🎯 SINGLE ENTITY: Final select with ALL fields: ${select}`)
    console.log(`🎯 SINGLE ENTITY: Final expand: ${expand}`)
    
    let url = `${process.env.DATAVERSE_URL}/api/data/v9.2/${getEntitySetName(entityConfig.entityLogicalName)}?$filter=${encodeURIComponent(filter)}&$select=${select}`
    if (expand) {
        url += `&$expand=${encodeURIComponent(expand)}`
    }
    
    console.log(`🔍 SINGLE ENTITY: Complete URL: ${url}`)
    
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
        console.error(`❌ Failed to fetch entity (${response.status}):`, errorText)
        console.error(`❌ Request URL was: ${url}`)
        throw new Error(`Failed to fetch entity: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const entity = data.value && data.value.length > 0 ? data.value[0] : null

    if (!entity) {
        throw new Error('Entity not found or access denied')
    }

    console.log(`✅ SINGLE ENTITY: Retrieved ${entityConfig.entityLogicalName}: ${entityId}`)
    console.log(`🔍 SINGLE ENTITY DATA:`, entity)
    console.log(`🔍 SINGLE ENTITY KEYS:`, Object.keys(entity))
    
    // Debug expanded contact data for single entity like we do for list
    if (entityConfig?.contactRelationField) {
        const contactNavProperty = getContactNavigationProperty(entityConfig.contactRelationField)
        if (contactNavProperty && entity[contactNavProperty]) {
            console.log(`🔍 SINGLE ENTITY EXPANDED CONTACT DATA (${contactNavProperty}):`, entity[contactNavProperty])
        } else {
            console.log(`⚠️ SINGLE ENTITY: No expanded contact data found for nav property: ${contactNavProperty}`)
            console.log(`⚠️ SINGLE ENTITY: Available nav properties:`, Object.keys(entity).filter(k => k.match(/^[a-z]/i) && !k.includes('@')))
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
    console.log(`📝 Creating new ${entityConfig.entityLogicalName}...`)
    
    if (!requestBody) {
        throw new Error('Request body is required for create operation')
    }

    const data = JSON.parse(requestBody)
    
    // Get form metadata to determine which fields are editable - REQUIRED
    if (!entityConfig.formGuid) {
        throw new Error(`Form GUID is required for entity ${entityConfig.entityLogicalName} - no fallback processing allowed`)
    }
    
    console.log(`📋 Fetching form metadata for CREATE operation: ${entityConfig.formGuid}`)
    const formMetadata = await getFormMetadata(accessToken, entityConfig.formGuid)
    
    if (!formMetadata) {
        throw new Error(`Form metadata not found for GUID: ${entityConfig.formGuid}`)
    }
    
    console.log(`✅ Form metadata loaded for CREATE: ${formMetadata.name}`)
    
    // Sanitize rich text fields for Dataverse compatibility with form metadata
    const sanitizedData = sanitizeDataForDataverse(data, entityConfig, formMetadata)
    
    // SECURITY: Always set user ownership - contact GUID is guaranteed at this point
    if (entityConfig.contactRelationField) {
        // Standard user entity - set contact ownership
        const contactBindField = `${entityConfig.contactRelationField}@odata.bind`
        sanitizedData[contactBindField] = `/contacts(${userContact.contactid})`
        console.log(`🛡️ SECURITY: User ownership set - ${contactBindField} = /contacts(${userContact.contactid})`)
    } else if (!userContact.cp_portaladmin) {
        // System entity requires admin access
        throw new Error('Admin access required to create this type of record')
    } else {
        // Admin creating system entity
        console.log(`🛡️ SECURITY: Admin creating system entity ${entityConfig.entityLogicalName}`)
    }

    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/${getEntitySetName(entityConfig.entityLogicalName)}`
    
    console.log(`🧹 Sanitized data for create:`, sanitizedData)
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
        body: JSON.stringify(sanitizedData)
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to create entity:', response.status, errorText)
        throw new Error(`Failed to create entity: ${response.status}`)
    }

    // Get the created entity ID from response headers
    const entityUrl = response.headers.get('OData-EntityId')
    const entityId = entityUrl ? entityUrl.split('(')[1].split(')')[0] : null

    console.log(`✅ Created ${entityConfig.entityLogicalName}: ${entityId}`)

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
    console.log(`🧹 Starting data sanitization for entity: ${entityConfig.entityLogicalName}`)
    
    const editableData = {}
    
    // Use form metadata to determine editable fields if available
    if (formMetadata && formMetadata.structure && formMetadata.structure.tabs) {
        console.log(`📋 Using form metadata to determine editable fields`)
        console.log(`📋 Form structure debug:`, JSON.stringify(formMetadata.structure, null, 2))
        
        // Extract all fields from all tabs and sections
        const allFormFields = []
        formMetadata.structure.tabs.forEach(tab => {
            console.log(`📋 Processing tab: ${tab.name} (${tab.sections?.length || 0} sections)`)
            if (tab.sections) {
                tab.sections.forEach(section => {
                    console.log(`📋 Processing section: ${section.name}`)
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
                                                console.log(`📋 Found field: ${control.datafieldname} (${control.controlType})`)
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
        
    console.log(`📝 Found ${allFormFields.length} fields on form`)
    console.log(`📝 Incoming data keys:`, Object.keys(data))
    console.log(`📝 Form fields found:`, allFormFields.map(f => ({ name: f.name, controlType: f.controlType })))
    
    if (allFormFields.length === 0) {
        console.error(`❌ No fields found in form metadata - form structure is incomplete`)
        console.log(`📋 Full form metadata:`, JSON.stringify(formMetadata, null, 2))
        throw new Error(`Form metadata is incomplete - no fields found. Form GUID: ${entityConfig.formGuid}`)
    }        allFormFields.forEach(field => {
            const fieldName = field.name
            
            // Skip system read-only fields
            if (fieldName === 'createdon' || 
                fieldName === 'modifiedon' || 
                fieldName === 'createdby' || 
                fieldName === 'modifiedby') {
                console.log(`⏭️ Skipping system read-only field: ${fieldName}`)
                return
            }
            
            // CRITICAL DEBUG: Log field details for lookup detection
            console.log(`🔍 FIELD ANALYSIS: ${fieldName}`)
            console.log(`🔍   controlType: "${field.controlType}"`)
            console.log(`🔍   ends with _value: ${fieldName.endsWith('_value')}`)
            console.log(`🔍   data has field: ${data.hasOwnProperty(fieldName)}`)
            console.log(`🔍   data value: "${data[fieldName]}"`)
            
            // Handle lookup fields with proper Dataverse syntax - check both controlType and field name pattern
            if (field.controlType === 'lookup' || fieldName.endsWith('_value')) {
                console.log(`🎯 LOOKUP FIELD DETECTED: ${fieldName} (condition met)`);
                if (data.hasOwnProperty(fieldName) && data[fieldName]) {
                    // Convert lookup field to Dataverse @odata.bind format
                    const lookupValue = data[fieldName]
                    console.log(`🔗 Processing lookup field: ${fieldName} = ${lookupValue}`)
                    
                    // Skip empty lookup values (already handled in frontend)
                    if (!lookupValue || lookupValue === '') {
                        console.log(`⏭️ Skipping empty lookup field: ${fieldName}`)
                        return
                    }
                    
                    // Convert to navigation property format for Dataverse
                    const navigationProperty = getNavigationPropertyForLookupField(fieldName, entityConfig)
                    const entitySetName = getEntitySetNameForLookupField(fieldName)
                    
                    console.log(`🔍 LOOKUP CONVERSION DEBUG:`)
                    console.log(`🔍   Input field: ${fieldName}`)
                    console.log(`🔍   Input value: ${lookupValue}`)
                    console.log(`🔍   Input value type: ${typeof lookupValue}`)
                    console.log(`🔍   Navigation property: ${navigationProperty}`)
                    console.log(`🔍   Entity set: ${entitySetName}`)
                    
                    if (navigationProperty && entitySetName) {
                        const odataBindKey = `${navigationProperty}@odata.bind`
                        const odataBindValue = `/${entitySetName}(${lookupValue})`
                        
                        console.log(`🚀 ODATA CONVERSION EXECUTING:`)
                        console.log(`🚀   From: ${fieldName} = ${lookupValue}`)
                        console.log(`🚀   To: ${odataBindKey} = ${odataBindValue}`)
                        
                        editableData[odataBindKey] = odataBindValue
                        
                        console.log(`✅ CONVERSION COMPLETE: Added to editableData`);
                        console.log(`✅ LOOKUP CONVERTED SUCCESSFULLY:`)
                        console.log(`✅   Original: ${fieldName} = ${lookupValue}`)
                        console.log(`✅   Converted: ${odataBindKey} = ${odataBindValue}`)
                        console.log(`✅   Expected pattern: "cp_Contact@odata.bind": "/contacts(12341234-1234-1234-1234-123412341234)"`)
                        console.log(`✅   Matches WebAPI pattern: record["cp_Contact@odata.bind"] = "/contacts(guid)"`)
                    } else {
                        console.log(`❌ LOOKUP CONVERSION FAILED:`)
                        console.log(`❌   Could not determine navigation property for: ${fieldName}`)
                        console.log(`❌   Navigation property: ${navigationProperty}`)
                        console.log(`❌   Entity set: ${entitySetName}`)
                        console.log(`❌   Available mappings:`, Object.keys(getFieldNavigationPropertyMap(entityConfig)))
                    }
                } else {
                    console.log(`⏭️ Lookup field ${fieldName} not provided or empty - skipping`)
                }
                return
            }
            
            // CRITICAL FIX: Check if this form field corresponds to a lookup field in the incoming data
            // Form shows 'cp_contact' but data contains '_cp_contact_value'
            const correspondingLookupField = `_${fieldName}_value`
            if (data.hasOwnProperty(correspondingLookupField) && data[correspondingLookupField]) {
                console.log(`🔧 LOOKUP FIELD MAPPING: Form field '${fieldName}' maps to data field '${correspondingLookupField}'`)
                
                const lookupValue = data[correspondingLookupField]
                console.log(`🔗 Processing mapped lookup: ${correspondingLookupField} = ${lookupValue}`)
                
                // Convert to @odata.bind format using the actual lookup field name
                const navigationProperty = getNavigationPropertyForLookupField(correspondingLookupField, entityConfig)
                const entitySetName = getEntitySetNameForLookupField(correspondingLookupField)
                
                if (navigationProperty && entitySetName) {
                    const odataBindKey = `${navigationProperty}@odata.bind`
                    const odataBindValue = `/${entitySetName}(${lookupValue})`
                    
                    editableData[odataBindKey] = odataBindValue
                    console.log(`✅ MAPPED LOOKUP CONVERSION: ${fieldName} (${correspondingLookupField}) → ${odataBindKey} = ${odataBindValue}`)
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
                    console.log(`🧹 Sanitizing rich text field: ${fieldName}`)
                    console.log(`📄 Original content preview:`, editableData[fieldName].substring(0, 100))
                    editableData[fieldName] = sanitizeRichTextForDataverse(editableData[fieldName])
                    console.log(`✅ Sanitized content preview:`, editableData[fieldName].substring(0, 100))
                }
                
                console.log(`✅ Including form field: ${fieldName} (${field.controlType || 'text'})`)
            } else {
                console.log(`⚠️ Form field ${fieldName} not found in request data`)
            }
        })
    }
    
    // Form metadata is required - no fallback processing allowed
    
    console.log(`🧹 Final editable fields to update:`, Object.keys(editableData))
    console.log(`🧹 Excluded from update:`, Object.keys(data).filter(key => !editableData.hasOwnProperty(key)))
    
    return editableData
}

/**
 * Sanitize rich text content for Dataverse
 */
function sanitizeRichTextForDataverse(html) {
    if (!html || typeof html !== 'string') return html
    
    console.log(`🧹 Original HTML (${html.length} chars):`, html)
    
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
    
    console.log(`🧹 Sanitized HTML (${sanitized.length} chars):`, sanitized)
    
    return sanitized.trim()
}

/**
 * Handle update request
 */
async function handleUpdateRequest(accessToken, entityConfig, userContact, entityId, requestBody, origin = null) {
    console.log(`� UPDATE REQUEST RECEIVED 🚨`)
    console.log(`�📝 Updating ${entityConfig.entityLogicalName}: ${entityId}`)
    console.log(`📦 Request body length: ${requestBody?.length || 0} characters`)
    
    if (!requestBody) {
        throw new Error('Request body is required for update operation')
    }

    const data = JSON.parse(requestBody)
    console.log(`📊 Parsed data keys:`, Object.keys(data))
    
    // SECURITY ENHANCEMENT: Verify user owns the record before update (when contact available)
    if (entityConfig.contactRelationField && userContact && userContact.contactid) {
        const securityFilter = await buildEntitySecurityFilter(accessToken, entityConfig, userContact, 'personal')
        const idField = getEntityIdField(entityConfig.entityLogicalName)
        const verifyFilter = `${idField} eq '${entityId}' and (${securityFilter})`
        
        console.log(`🛡️ SECURITY: Verifying user ownership before update - ${verifyFilter}`)
        
        const verifyUrl = `${process.env.DATAVERSE_URL}/api/data/v9.2/${getEntitySetName(entityConfig.entityLogicalName)}?$filter=${encodeURIComponent(verifyFilter)}&$select=${idField}`
        const verifyResponse = await fetch(verifyUrl, {
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
        
        console.log(`✅ SECURITY: User ownership verified for update operation`)
    } else {
        console.warn(`🛡️ SECURITY: Updating ${entityConfig.entityLogicalName} without ownership verification (no contact or no contact relation field)`)
    }
    
    // Get form metadata to determine which fields are editable - REQUIRED
    if (!entityConfig.formGuid) {
        throw new Error(`Form GUID is required for entity ${entityConfig.entityLogicalName} - no fallback processing allowed`)
    }
    
    console.log(`📋 Fetching form metadata for GUID: ${entityConfig.formGuid}`)
    const formMetadata = await getFormMetadata(accessToken, entityConfig.formGuid)
    
    if (!formMetadata) {
        throw new Error(`Form metadata not found for GUID: ${entityConfig.formGuid}`)
    }
    
    console.log(`✅ Form metadata loaded: ${formMetadata.name}`)
    
    // Sanitize data based on form metadata
    const sanitizedData = sanitizeDataForDataverse(data, entityConfig, formMetadata)
    
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/${getEntitySetName(entityConfig.entityLogicalName)}(${entityId})`
    
    console.log(`🧹 Sanitized data for update:`, sanitizedData)
    
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
        body: JSON.stringify(sanitizedData)
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to update entity:', response.status, errorText)
        console.error('Request data:', sanitizedData)
        throw new Error(`Failed to update entity: ${response.status}`)
    }

    console.log(`✅ Updated ${entityConfig.entityLogicalName}: ${entityId}`)

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
    console.log(`🗑️ Deleting ${entityConfig.entityLogicalName}: ${entityId} for user: ${userContact.contactid}`)
    
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    // SECURITY ENHANCEMENT: Verify user owns the record before delete (when contact available)
    if (entityConfig.contactRelationField && userContact && userContact.contactid) {
        const securityFilter = await buildEntitySecurityFilter(accessToken, entityConfig, userContact, 'personal')
        const idField = getEntityIdField(entityConfig.entityLogicalName)
        const verifyFilter = `${idField} eq '${entityId}' and (${securityFilter})`
        
        console.log(`🛡️ SECURITY: Verifying user ownership before delete - ${verifyFilter}`)
        
        const verifyUrl = `${process.env.DATAVERSE_URL}/api/data/v9.2/${getEntitySetName(entityConfig.entityLogicalName)}?$filter=${encodeURIComponent(verifyFilter)}&$select=${idField}`
        const verifyResponse = await fetch(verifyUrl, {
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
        
        console.log(`✅ SECURITY: User ownership verified for delete operation`)
    } else {
        console.warn(`🛡️ SECURITY: Deleting ${entityConfig.entityLogicalName} without ownership verification (no contact or no contact relation field)`)
    }
    
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/${getEntitySetName(entityConfig.entityLogicalName)}(${entityId})`
    
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
        },
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to delete entity:', response.status, errorText)
        throw new Error(`Failed to delete entity: ${response.status}`)
    }

    console.log(`✅ Deleted ${entityConfig.entityLogicalName}: ${entityId}`)

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
            console.error(`Failed to fetch account contacts: ${response.status}`)
            return []
        }
        
        const data = await response.json()
        const contactIds = data.value.map(contact => contact.contactid)
        console.log(`🏢 ACCOUNT CONTACTS: Found ${contactIds.length} contacts in account ${accountGuid}`)
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
            console.log(`🏢 SECURITY: Admin organization view requested for account: ${userContact._parentcustomerid_value}`)
            
            // Get all contact IDs in the same account
            const accountContactIds = await getAccountContactIds(accessToken, userContact._parentcustomerid_value)
            
            if (accountContactIds.length > 0) {
                // Build filter for multiple contacts: field eq 'id1' or field eq 'id2' or...
                const contactFilters = accountContactIds.map(contactId => `${contactField} eq '${contactId}'`).join(' or ')
                filter += ` and (${contactFilters})`
                console.log(`🏢 SECURITY: Organization view - filtering by ${accountContactIds.length} account contacts`)
            } else {
                // No contacts found, fall back to personal view
                console.warn('⚠️  ORGANIZATION VIEW: No account contacts found, falling back to personal view')
                filter += ` and ${contactField} eq '${userContact.contactid}'`
            }
        } else {
            // PERSONAL VIEW: Show only user's own records
            filter += ` and ${contactField} eq '${userContact.contactid}'`
            console.log(`🛡️ SECURITY: Personal view - ${contactField} eq ${userContact.contactid}`)
        }
    } else if (entityConfig.accountRelationField) {
        // PATTERN 2: Account-owned entities (Organization, Company Settings)
        const accountField = `_${entityConfig.accountRelationField}_value`
        
        if (!userContact._parentcustomerid_value) {
            throw new Error('🛡️ SECURITY: User must have account association for account-level entities')
        }
        
        filter += ` and ${accountField} eq '${userContact._parentcustomerid_value}'`
        console.log(`🏢 SECURITY: Account scoped - ${accountField} eq ${userContact._parentcustomerid_value}`)
        
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
        console.log(`🛡️ SECURITY: Admin access granted for ${entityConfig.entityLogicalName}`)
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
    
    console.log(`🔍 Building fields with lookups for entity: ${entityLogicalName}`)
    
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
    console.log('🔄 USING DYNAMIC FIELD DETECTION - ELIMINATED HARDCODED ENTITY CHECKS')
    
    // Add dynamic lookup fields based on entity configuration
    if (entityConfig.contactRelationField) {
        const lookupField = `_${entityConfig.contactRelationField}_value`
        fields.push(lookupField)
        expands.push(`${getNavigationPropertyForLookupField(lookupField, entityConfig)}($select=fullname)`)
        console.log(`✅ Added contact lookup: ${lookupField}`)
    }
    
    if (entityConfig.accountRelationField) {
        const lookupField = `_${entityConfig.accountRelationField}_value`
        fields.push(lookupField)
        expands.push(`${getNavigationPropertyForLookupField(lookupField, entityConfig)}($select=name)`)
        console.log(`✅ Added account lookup: ${lookupField}`)
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
    
    console.log(`📋 Fields for ${entityLogicalName}:`, result)
    
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
    console.log('🔄 DYNAMIC FIELD DETECTION - NO MORE HARDCODED ENTITY LOGIC')
    
    // Add common fields that most entities have based on type
    if (entityLogicalName === 'contact') {
        // Standard Dataverse contact fields
        commonFields.push('firstname', 'lastname', 'fullname', 'emailaddress1', 'mobilephone', '_parentcustomerid_value')
    } else if (entityLogicalName === 'account') {
        // Standard Dataverse account fields  
        commonFields.push('name', 'emailaddress1', '_primarycontactid_value')
    } else if (entityLogicalName.startsWith('cp_')) {
        // For custom entities, add most common cp_ field
        commonFields.push('cp_name')
        
        // Note: Specific fields should come from view metadata or entity configuration
        // This function should eventually be deprecated in favor of view-metadata-driven approach
    }
    
    console.log(`📋 All entity fields for ${entityLogicalName}: ${commonFields.join(', ')}`)
    
    return commonFields.join(',')
}

async function getFieldsFromViewMetadata(viewMetadata, entityConfig) {
    console.log(`🔍 getFieldsFromViewMetadata called:`)
    console.log(`🔍 viewMetadata:`, viewMetadata)
    console.log(`🔍 viewMetadata.columns:`, viewMetadata?.columns)
    console.log(`🔍 entityConfig:`, entityConfig?.entityLogicalName)
    
    if (viewMetadata && viewMetadata.columns && viewMetadata.columns.length > 0) {
        // Use smart metadata approach for all entities
        const result = await buildSmartQueryFromMetadata(viewMetadata, entityConfig)
        console.log(`🔍 buildSmartQueryFromMetadata result:`, result)
        return result
    }
    
    console.log('⚠️ No valid fields found in view metadata, using default')
    return { select: null, expand: null }
}

/**
 * Build smart query using entity metadata to resolve correct navigation property names
 */
async function buildSmartQueryFromMetadata(viewMetadata, entityConfig) {
    console.log(`🔍 buildSmartQueryFromMetadata called`)
    console.log(`🔍 viewMetadata.columns:`, viewMetadata.columns)
    console.log(`🔍 ENTITY CONFIG DEBUG:`, JSON.stringify(entityConfig, null, 2))
    console.log(`🔍 Contact relation field (contactRelationField):`, entityConfig?.contactRelationField)
    console.log(`🔍 DYNAMIC FIELD DETECTION - NO MORE HARDCODED cp_contact!`)
    
    const fields = []
    const expands = []
    
    // Process each column from the view metadata
    viewMetadata.columns.forEach(col => {
        const fieldName = col.name
        console.log(`🔍 Processing column: ${fieldName}`)
        
        if (!fieldName || typeof fieldName !== 'string') {
            console.log(`🔍 Skipping invalid field: ${fieldName}`)
            return
        }
        
        // Flexible field mapping logic - works for any entity
        if (fieldName.endsWith('_value')) {
            // This is already a lookup field in _fieldname_value format
            console.log(`🔍 Value field detected: ${fieldName}`)
            fields.push(fieldName)
            
            // Try to add expand for any lookup field dynamically
            const navigationProperty = getNavigationPropertyForLookupField(fieldName, entityConfig)
            if (navigationProperty) {
                // Use appropriate display field based on navigation property
                const displayField = navigationProperty.includes('account') ? 'name' : 'fullname'
                expands.push(`${navigationProperty}($select=${displayField})`)
                console.log(`🔍 Added expand for ${fieldName}: ${navigationProperty}($select=${displayField})`)
            }
        } else if (fieldName.startsWith('cp_')) {
            // Check if this is a lookup field using inferFieldType
            const fieldType = inferFieldType(fieldName, entityConfig)
            console.log(`🔍 CP FIELD CHECK: ${fieldName} -> type: ${fieldType}`)
            console.log(`🔍 *** NEW BUILD CODE LOADED *** - TESTING contactRelationField`)
            console.log(`🔍 CP FIELD: entityConfig.contactRelationField = ${entityConfig?.contactRelationField}`)
            console.log(`🔍 CP FIELD: Match check = ${fieldName === entityConfig?.contactRelationField}`)
            
            if (fieldType === 'lookup') {
                // This looks like a lookup field but in display format (e.g., 'cp_contact')
                // Convert to actual lookup field format
                const lookupFieldName = `_${fieldName}_value`
                console.log(`🔍 Lookup field converted: ${fieldName} -> ${lookupFieldName}`)
                fields.push(lookupFieldName)
                
                // Add expand for the lookup using dynamic navigation property
                const navigationProperty = getNavigationPropertyForLookupField(lookupFieldName, entityConfig)
                if (navigationProperty) {
                    // Use appropriate display field based on navigation property
                    const displayField = navigationProperty.includes('account') ? 'name' : 'fullname'
                    expands.push(`${navigationProperty}($select=${displayField})`)
                    console.log(`🔍 Added expand for ${lookupFieldName}: ${navigationProperty}($select=${displayField})`)
                }
            } else {
                // Regular cp_ field but not lookup
                console.log(`🔍 Regular cp_ field: ${fieldName}`)
                fields.push(fieldName)
            }
        } else {
            // Use inferFieldType to determine if this is a lookup field
            const fieldType = inferFieldType(fieldName, entityConfig)
            console.log(`🔍 INFER BASED CHECK: ${fieldName} -> inferFieldType result: ${fieldType}`)
            
            if (fieldType === 'lookup') {
                // This field is detected as lookup by our inference logic
                const lookupFieldName = `_${fieldName}_value`
                console.log(`🔍 Lookup field via inference: ${fieldName} -> ${lookupFieldName}`)
                fields.push(lookupFieldName)
                
                // Add expand for the lookup using dynamic navigation property
                const navigationProperty = getNavigationPropertyForLookupField(lookupFieldName, entityConfig)
                if (navigationProperty) {
                    // Use appropriate display field based on navigation property
                    const displayField = navigationProperty.includes('account') ? 'name' : 'fullname'
                    expands.push(`${navigationProperty}($select=${displayField})`)
                    console.log(`🔍 Added expand for ${lookupFieldName}: ${navigationProperty}($select=${displayField})`)
                }
            } else if (col.type === 'lookup') {
                // Fallback: This field is marked as lookup in view metadata (e.g., parentcustomerid)
                const lookupFieldName = `_${fieldName}_value`
                console.log(`🔍 Lookup field from metadata: ${fieldName} -> ${lookupFieldName}`)
                fields.push(lookupFieldName)
                
                // Add expand for the lookup using dynamic navigation property
                const navigationProperty = getNavigationPropertyForLookupField(lookupFieldName, entityConfig)
                if (navigationProperty) {
                    // Use appropriate display field based on navigation property
                    const displayField = navigationProperty.includes('account') ? 'name' : 'fullname'
                    expands.push(`${navigationProperty}($select=${displayField})`)
                    console.log(`🔍 Added expand for ${lookupFieldName}: ${navigationProperty}($select=${displayField})`)
                }
            } else {
                // Regular field - add as is (works for any field name)
                console.log(`🔍 Regular field: ${fieldName}`)
                fields.push(fieldName)
            }
        }
    })
    
    // Always include the entity ID field for actions
    const entityIdField = `${entityConfig.entityLogicalName}id`
    if (!fields.includes(entityIdField)) {
        console.log(`🔍 Adding entity ID field: ${entityIdField}`)
        fields.push(entityIdField)
    }
    
    const result = {
        select: fields.length > 0 ? fields.join(',') : null,
        expand: expands.length > 0 ? expands.join(',') : null
    }
    
    console.log(`🔍 buildSmartQueryFromMetadata result:`)
    console.log(`🔍 fields array:`, fields)
    console.log(`🔍 expands array:`, expands)
    console.log(`🔍 final select:`, result.select)
    console.log(`🔍 final expand:`, result.expand)
    
    return result
}

/**
 * Get view metadata (reuse from organization function)
 */
async function getViewMetadata(accessToken, viewGuid, entityConfig = null) {
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/savedqueries(${viewGuid})?$select=name,description,layoutxml,fetchxml`
    
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
        console.warn('Failed to fetch view metadata:', response.status)
        return null
    }

    const data = await response.json()
    return parseViewMetadata(data, entityConfig)
}

/**
 * Get form metadata (reuse from organization function)
 */
async function getFormMetadata(accessToken, formGuid) {
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/systemforms(${formGuid})?$select=name,description,formxml`
    
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
        console.warn('Failed to fetch form metadata:', response.status)
        return null
    }

    const data = await response.json()
    return parseFormMetadata(data)
}

// Import parsing functions from organization.js
function parseViewMetadata(viewData, entityConfig = null) {
    console.log('🔍 Parsing view metadata for:', viewData.name)
    
    if (!viewData.layoutxml) {
        console.warn('⚠️ No layoutxml found in view data')
        return {
            name: viewData.name,
            columns: []
        }
    }

    try {
        // Parse the layoutxml to extract column information
        const layoutxml = viewData.layoutxml
        console.log('📋 Layout XML length:', layoutxml.length)
        
        // DEBUG: Log a sample of the XML to understand structure
        const xmlSample = layoutxml.substring(0, 500)
        console.log('📋 XML Sample:', xmlSample)
        
        // Also check FetchXML for additional metadata
        if (viewData.fetchxml) {
            console.log('📋 FetchXML length:', viewData.fetchxml.length)
            const fetchSample = viewData.fetchxml.substring(0, 300)
            console.log('📋 FetchXML Sample:', fetchSample)
        }
        
        // Extract column names from layoutxml using regex
        // This matches: <cell name="fieldname" ...>
        const columnMatches = layoutxml.match(/<cell[^>]+name="([^"]+)"/g)
        
        if (!columnMatches) {
            console.warn('⚠️ No columns found in layoutxml')
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
                    console.log(`📋 FOUND DISPLAY NAME: ${fieldName} -> "${displayName}"`)
                } else {
                    console.log(`📋 NO DISPLAY NAME FOUND FOR: ${fieldName}, using fallback: "${displayName}"`)
                }
                
                // Try to get width from the XML
                const widthMatch = match.match(/width="([^"]+)"/)
                const width = widthMatch ? widthMatch[1] : '120px'
                
                console.log(`🔍 COLUMN PARSED: ${fieldName} -> "${displayName}" (width: ${width})`)
                
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
        console.log(`📋 FRONTEND-ALIGNED DISPLAY NAME: ${fieldName} -> "${displayNames[fieldName]}"`)
        return displayNames[fieldName]
    }
    
    // Fallback: Use same logic as frontend for consistency
    const fallback = fieldName.replace(/^cp_/, '').replace(/^_/, '').replace(/_value$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    console.log(`📋 FRONTEND-ALIGNED FALLBACK: ${fieldName} -> "${fallback}"`)
    return fallback
}

function inferFieldType(fieldName, entityConfig = null) {
    console.log(`🔍 INFER FIELD TYPE DEBUG: fieldName=${fieldName}, entityConfig=`, entityConfig)
    console.log(`🔍 INFER: entityConfig.contactRelationField =`, entityConfig?.contactRelationField)
    console.log(`🔍 INFER: Match check: ${fieldName} === ${entityConfig?.contactRelationField} = ${fieldName === entityConfig?.contactRelationField}`)
    
    if (fieldName.includes('email')) return 'email'
    if (fieldName.includes('phone') || fieldName.includes('telephone')) return 'phone'
    if (fieldName.includes('createdon') || fieldName.includes('modifiedon')) return 'datetime'
    if (fieldName.endsWith('_value')) return 'lookup'
    if (fieldName === 'statuscode' || fieldName === 'statecode') return 'optionset'
    
    // Dynamic contact lookup field detection based on entity configuration
    if (entityConfig?.contactRelationField && fieldName === entityConfig.contactRelationField) {
        console.log(`🎯 DETECTED AS LOOKUP FIELD: ${fieldName} (matches config contactRelationField)`)
        return 'lookup'
    }
    
    // Dynamic account lookup field detection based on entity configuration
    if (entityConfig?.accountRelationField && fieldName === entityConfig.accountRelationField) {
        console.log(`🎯 DETECTED AS ACCOUNT LOOKUP FIELD: ${fieldName} (matches config accountRelationField)`)
        return 'lookup'
    }
    
    console.log(`📝 DETECTED AS TEXT FIELD: ${fieldName}`)
    return 'text'
}

function parseFormMetadata(formData) {
    console.log('🔍 Parsing form metadata for:', formData.name)
    
    if (!formData.formxml) {
        console.warn('⚠️ No formxml found in form data')
        return {
            name: formData.name,
            structure: { tabs: [] }
        }
    }

    try {
        const formxml = formData.formxml
        console.log('📋 Form XML length:', formxml.length)
        
        // Parse tabs from formxml
        const tabs = parseTabsFromFormXml(formxml)
        
        return {
            name: formData.name,
            description: formData.description,
            structure: { tabs: tabs }
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
    
    try {
        // Extract tab elements using regex (basic XML parsing)
        const tabMatches = formxml.match(/<tab[^>]*>.*?<\/tab>/gs)
        
        if (!tabMatches) {
            console.warn('⚠️ No tabs found in form XML')
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
            
            tabs.push({
                name: tabName,
                displayName: tabLabel,
                visible: visible,
                showLabel: showLabel,
                hidden: hidden,
                hideLabel: hideLabel,
                sections: sections
            })
        })
        
        console.log(`✅ Parsed ${tabs.length} tabs from form XML`)
        return tabs
        
    } catch (error) {
        console.error('❌ Error parsing tabs from form XML:', error.message)
        return []
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
            console.warn('⚠️ No sections found in tab XML')
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
            console.warn('⚠️ No controls found in section XML')
            return []
        }

        // Group controls into rows (for simplicity, each control is its own row)
        controlMatches.forEach((controlXml, controlIndex) => {
            const control = parseControlFromXml(controlXml)
            
            if (control) {
                rows.push({
                    cells: [{
                        controls: [control]
                    }]
                })
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
 * Get user contact information by GUID - SECURE DIRECT LOOKUP
 */
async function getUserContactByGuid(accessToken, contactGuid) {
    // Using process.env.DATAVERSE_URL directly to avoid initialization issues
    
    // Direct GUID lookup - most secure approach
    const url = `${process.env.DATAVERSE_URL}/api/data/v9.0/contacts(${contactGuid})?$select=contactid,cp_portaladmin,_parentcustomerid_value`

    console.log(`🔍 SECURITY: Looking up contact by GUID: ${contactGuid}`)
    
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
        if (response.status === 404) {
            console.error(`🛡️ SECURITY: Contact GUID ${contactGuid} not found`)
        } else {
            console.error(`🛡️ SECURITY: Failed to fetch contact by GUID: ${response.status}`)
        }
        return null
    }

    const contact = await response.json()
    console.log(`✅ SECURITY: Contact verified - ${contactGuid}`)
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
        
        console.log('🔍 RESOLVE ENTITY NAME: Querying Dataverse for configs...')
        
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
            console.warn('Failed to fetch entity configurations for resolution:', response.status)
            return null
        }
        
        const data = await response.json()
        const configs = data.value || []
        
        console.log(`🔍 RESOLVE ENTITY NAME: Found ${configs.length} configurations`)
        console.log(`🔍 RESOLVE ENTITY NAME: Looking for: "${urlPathOrName}"`)
        
        // First try direct match with logical name (backward compatibility)
        let matchedConfig = configs.find(config => config.cp_entitylogicalname === urlPathOrName)
        
        if (matchedConfig) {
            console.log(`✅ RESOLVE ENTITY NAME: Matched by logical name: ${matchedConfig.cp_entitylogicalname}`)
            return matchedConfig.cp_entitylogicalname
        }
        
        // If no direct match, try cp_name match
        matchedConfig = configs.find(config => config.cp_name === urlPathOrName)
        
        if (matchedConfig) {
            console.log(`✅ RESOLVE ENTITY NAME: Matched by display name: ${matchedConfig.cp_name} -> ${matchedConfig.cp_entitylogicalname}`)
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
            console.log(`✅ RESOLVE ENTITY NAME: Matched by plural/singular: ${matchedConfig.cp_name} -> ${matchedConfig.cp_entitylogicalname}`)
            return matchedConfig.cp_entitylogicalname
        }
        
        console.warn(`❌ RESOLVE ENTITY NAME: No match found for "${urlPathOrName}"`)
        console.warn(`❌ Available configs:`, configs.map(c => `${c.cp_name} (${c.cp_entitylogicalname})`).join(', '))
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
        
        console.log(`🔍 NAVIGATION PROPERTY DEBUG:`)
        console.log(`🔍   Contact field: ${contactField}`)
        console.log(`🔍   Derived navigation property: ${contactNavProperty}`)
        
        if (contactNavProperty) {
            navigationPropertyMap[`_${contactField}_value`] = contactNavProperty
            navigationPropertyMap[contactField] = contactNavProperty
            console.log(`🔍 Added dynamic contact mapping: ${contactField} -> ${contactNavProperty}`)
            console.log(`🔍   Mapping _${contactField}_value -> ${contactNavProperty}`)
            console.log(`🔍   Mapping ${contactField} -> ${contactNavProperty}`)
        }
    }
    
    console.log(`🔍 Final navigation property map:`, navigationPropertyMap)
    
    return navigationPropertyMap
}

/**
 * Convert lookup field name to navigation property name for Dataverse @odata.bind
 * Maps field names like '_cp_contact_value' or 'cp_contact' to navigation properties like 'cp_Contact'
 */
function getNavigationPropertyForLookupField(fieldName, entityConfig = null) {
    console.log(`🔍 LOOKUP NAVIGATION DEBUG: ${fieldName}`)
    console.log(`🔍   EntityConfig provided:`, !!entityConfig)
    console.log(`🔍   ContactRelationField:`, entityConfig?.contactRelationField)
    
    // Get dynamic mappings based on entity configuration
    const navigationPropertyMap = getFieldNavigationPropertyMap(entityConfig || {})
    
    console.log(`🔍   Available mappings:`, Object.keys(navigationPropertyMap))
    console.log(`🔍   Looking for mapping of: ${fieldName}`)
    
    // Check direct mapping first
    if (navigationPropertyMap[fieldName]) {
        console.log(`🔍   Found direct mapping: ${fieldName} -> ${navigationPropertyMap[fieldName]}`)
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
    
    console.warn(`Could not determine navigation property for lookup field: ${fieldName}`)
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
    
    console.warn(`Could not determine entity set name for lookup field: ${fieldName}`)
    return null
}
