/**
 * Netlify Function: generic-entity.js
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

import { validateSimpleAuth, createAuthErrorResponse, createSuccessResponse, buildSecureEmailFilter } from './auth-utils.js'

export const handler = async (event) => {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
            },
            body: '',
        }
    }

    try {
        // Authenticate user (simple auth - no email required)
        const user = await validateSimpleAuth(event)
        console.log(`Generic entity request from: ${user.userId}`)

        // Get entity name from query parameters
        const entitySlugOrName = event.queryStringParameters?.entity
        
        if (!entitySlugOrName) {
            return createAuthErrorResponse('Entity name is required', 400)
        }

        // Get access token
        const accessToken = await getAccessToken()
        if (!accessToken) {
            return createAuthErrorResponse('Failed to obtain access token', 500)
        }

        // Resolve URL slug to actual entity logical name
        const entityLogicalName = await resolveEntityName(entitySlugOrName, accessToken)
        if (!entityLogicalName) {
            return createAuthErrorResponse('Entity not found or not configured', 404)
        }

        // Get entity configuration
        const entityConfig = await getEntityConfiguration(accessToken, entityLogicalName)
        if (!entityConfig) {
            return createAuthErrorResponse('Entity configuration not found', 404)
        }

        // Get user contact for security filtering (if email is available)
        let userContact = null
        if (user.userEmail) {
            userContact = await getUserContact(accessToken, user.userEmail)
            if (!userContact) {
                console.warn(`User contact not found for email: ${user.userEmail}`)
            }
        } else {
            console.warn('No email available in token for user contact lookup')
        }

        // Check admin permissions if required
        if (entityConfig.requiresAdmin && (!userContact || !userContact.cp_portaladmin)) {
            return createAuthErrorResponse('Admin access required for this entity', 403)
        }

        // Route to appropriate handler based on HTTP method and parameters
        const mode = event.queryStringParameters?.mode
        const entityId = event.queryStringParameters?.id

        switch (event.httpMethod) {
            case 'GET':
                if (mode === 'list') {
                    return await handleListRequest(accessToken, entityConfig, userContact)
                } else if (mode === 'form') {
                    return await handleFormMetadataRequest(accessToken, entityConfig, userContact)
                } else if (entityId) {
                    return await handleSingleEntityRequest(accessToken, entityConfig, userContact, entityId)
                } else {
                    return await handleListRequest(accessToken, entityConfig, userContact)
                }

            case 'POST':
                return await handleCreateRequest(accessToken, entityConfig, userContact, event.body)

            case 'PATCH':
                if (!entityId) {
                    return createAuthErrorResponse('Entity ID is required for update', 400)
                }
                return await handleUpdateRequest(accessToken, entityConfig, userContact, entityId, event.body)

            case 'DELETE':
                if (!entityId) {
                    return createAuthErrorResponse('Entity ID is required for delete', 400)
                }
                return await handleDeleteRequest(accessToken, entityConfig, userContact, entityId)

            default:
                return createAuthErrorResponse('Method not allowed', 405)
        }

    } catch (error) {
        console.error('Generic entity function error:', error)
        return createAuthErrorResponse(`Internal server error: ${error.message}`, 500)
    }
}

/**
 * Get entity metadata from Dataverse to understand field types and names
 */
async function getEntityMetadata(accessToken, entityLogicalName) {
    const { DATAVERSE_URL } = process.env
    
    // Get entity metadata including attributes and relationships
    const url = `${DATAVERSE_URL}/api/data/v9.0/EntityDefinitions?$filter=LogicalName eq '${entityLogicalName}'&$expand=Attributes($select=LogicalName,AttributeType,AttributeTypeName),OneToManyRelationships($select=ReferencingAttribute,ReferencingEntity,ReferencingEntityNavigationPropertyName),ManyToOneRelationships($select=ReferencingAttribute,ReferencingEntity,ReferencingEntityNavigationPropertyName)`
    
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
async function handleListRequest(accessToken, entityConfig, userContact) {
    const { DATAVERSE_URL } = process.env
    
    // Get view metadata if available
    let viewMetadata = null
    if (entityConfig.viewMainGuid) {
        viewMetadata = await getViewMetadata(accessToken, entityConfig.viewMainGuid)
    }
    
    // Build security filter
    const securityFilter = buildEntitySecurityFilter(entityConfig, userContact)
    
    // Build query based on view or default fields
    const viewFieldInfo = viewMetadata ? getFieldsFromViewMetadata(viewMetadata, entityConfig) : null
    const select = viewFieldInfo?.select || getDefaultEntityFields(entityConfig.entityLogicalName)
    const expand = viewFieldInfo?.expand
    
    // Safety check: if select is empty, use default fields
    const finalSelect = select && select.trim() ? select : getDefaultEntityFields(entityConfig.entityLogicalName)

    // Build the URL using unified pattern for all entities
    let url = `${DATAVERSE_URL}/api/data/v9.0/${getEntitySetName(entityConfig.entityLogicalName)}?$filter=${encodeURIComponent(securityFilter)}&$orderby=createdon desc&$top=100`
    
    // Add select fields if available
    if (finalSelect) {
        url += `&$select=${finalSelect}`
    }
    
    // Add expand if available
    if (expand) {
        url += `&$expand=${expand}`
    }

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
        console.error('Dataverse API Error:', response.status, errorText)
        throw new Error(`Failed to fetch entities: ${response.status}`)
    }

    const data = await response.json()
    const entities = data.value || []

    return createSuccessResponse({
        entities: entities,
        entityConfig: entityConfig,
        viewMetadata: viewMetadata,
        totalCount: entities.length,
        mode: 'list'
    })
}

/**
 * Handle form metadata request
 */
async function handleFormMetadataRequest(accessToken, entityConfig, userContact) {
    console.log(`🔍 Fetching form metadata for ${entityConfig.entityLogicalName}...`)
    
    if (!entityConfig.formGuid) {
        throw new Error('Form GUID not configured for this entity')
    }

    const formMetadata = await getFormMetadata(accessToken, entityConfig.formGuid)
    
    return createSuccessResponse({
        formMetadata: formMetadata,
        entityConfig: entityConfig,
        mode: 'form'
    })
}

/**
 * Handle single entity request
 */
async function handleSingleEntityRequest(accessToken, entityConfig, userContact, entityId) {
    console.log(`🔍 Fetching single ${entityConfig.entityLogicalName}: ${entityId}`)
    
    const { DATAVERSE_URL } = process.env
    
    // Build security filter
    const securityFilter = buildEntitySecurityFilter(entityConfig, userContact)
    const idField = getEntityIdField(entityConfig.entityLogicalName)
    const filter = `${idField} eq '${entityId}' and ${securityFilter}`
    
    // Get all fields for editing with lookup expansions
    const { select, expand } = getEntityFieldsWithLookups(entityConfig)
    
    let url = `${DATAVERSE_URL}/api/data/v9.2/${getEntitySetName(entityConfig.entityLogicalName)}?$filter=${encodeURIComponent(filter)}&$select=${select}`
    if (expand) {
        url += `&$expand=${encodeURIComponent(expand)}`
    }
    
    console.log(`🔍 Single entity URL with lookups: ${url}`)
    
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

    console.log(`✅ Retrieved ${entityConfig.entityLogicalName}: ${entityId}`)

    return createSuccessResponse({
        entity: entity,
        entityConfig: entityConfig,
        mode: 'single'
    })
}

/**
 * Handle create request
 */
async function handleCreateRequest(accessToken, entityConfig, userContact, requestBody) {
    console.log(`📝 Creating new ${entityConfig.entityLogicalName}...`)
    
    if (!requestBody) {
        throw new Error('Request body is required for create operation')
    }

    const data = JSON.parse(requestBody)
    
    // Add security field if configured
    if (entityConfig.contactRelationField && userContact && userContact._parentcustomerid_value) {
        data[entityConfig.contactRelationField] = userContact._parentcustomerid_value
    }

    const { DATAVERSE_URL } = process.env
    const url = `${DATAVERSE_URL}/api/data/v9.0/${getEntitySetName(entityConfig.entityLogicalName)}`
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
        body: JSON.stringify(data)
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
    })
}

/**
 * Handle update request
 */
async function handleUpdateRequest(accessToken, entityConfig, userContact, entityId, requestBody) {
    console.log(`📝 Updating ${entityConfig.entityLogicalName}: ${entityId}`)
    
    if (!requestBody) {
        throw new Error('Request body is required for update operation')
    }

    const data = JSON.parse(requestBody)
    
    const { DATAVERSE_URL } = process.env
    const url = `${DATAVERSE_URL}/api/data/v9.0/${getEntitySetName(entityConfig.entityLogicalName)}(${entityId})`
    
    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            'Accept': 'application/json',
        },
        body: JSON.stringify(data)
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to update entity:', response.status, errorText)
        throw new Error(`Failed to update entity: ${response.status}`)
    }

    console.log(`✅ Updated ${entityConfig.entityLogicalName}: ${entityId}`)

    return createSuccessResponse({
        entityId: entityId,
        entityConfig: entityConfig,
        mode: 'update'
    })
}

/**
 * Handle delete request
 */
async function handleDeleteRequest(accessToken, entityConfig, userContact, entityId) {
    console.log(`🗑️ Deleting ${entityConfig.entityLogicalName}: ${entityId}`)
    
    const { DATAVERSE_URL } = process.env
    const url = `${DATAVERSE_URL}/api/data/v9.0/${getEntitySetName(entityConfig.entityLogicalName)}(${entityId})`
    
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
    })
}

/**
 * Build security filter for entity access
 */
function buildEntitySecurityFilter(entityConfig, userContact) {
    let filter = 'statecode eq 0' // Only active records
    
    // Use the configured contact relation field from entity config
    if (entityConfig.contactRelationField && userContact && userContact.contactid) {
        const contactField = `_${entityConfig.contactRelationField}_value`
        filter += ` and ${contactField} eq ${userContact.contactid}`
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
    
    // Add entity-specific fields with lookup expansions
    if (entityLogicalName === 'contact') {
        fields.push('firstname', 'lastname', 'emailaddress1', 'mobilephone', '_parentcustomerid_value')
        expands.push('_parentcustomerid_value($select=name)')
    } else if (entityLogicalName === 'account') {
        fields.push('name', 'telephone1', 'emailaddress1', '_primarycontactid_value')
        expands.push('_primarycontactid_value($select=fullname)')
    } else if (entityLogicalName === 'cp_idea') {
        fields.push('cp_name', 'cp_description', '_cp_contact_value')
        // Use navigation property name, not field name
        expands.push('cp_Contact($select=fullname)', 'createdby($select=fullname)')
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
    // In production, this would fetch from entity metadata
    // For now, return common fields
    const commonFields = [
        `${entityLogicalName}id`,
        'createdon',
        'modifiedon',
        'statecode',
        '_createdby_value',
        '_modifiedby_value'
    ]
    
    // Add entity-specific fields
    if (entityLogicalName === 'contact') {
        commonFields.push('firstname', 'lastname', 'emailaddress1', 'mobilephone', '_parentcustomerid_value')
    } else if (entityLogicalName === 'account') {
        commonFields.push('name', 'telephone1', 'emailaddress1', '_primarycontactid_value')
    }
    
    return commonFields.join(',')
}

function getFieldsFromViewMetadata(viewMetadata, entityConfig) {
    if (viewMetadata && viewMetadata.columns && viewMetadata.columns.length > 0) {
        // For cp_idea entity, use the proven working pattern from Dataverse REST Builder
        if (entityConfig.entityLogicalName === 'cp_idea') {
            // Build select fields from view metadata
            const fields = []
            
            viewMetadata.columns.forEach(col => {
                const fieldName = col.name
                if (!fieldName || typeof fieldName !== 'string') return
                
                if (fieldName === 'cp_contact') {
                    // Include the _value field for display and filtering
                    fields.push('_cp_contact_value')
                } else {
                    // Regular field - add as-is
                    fields.push(fieldName)
                }
            })
            
            const result = {
                select: fields.length > 0 ? fields.join(',') : 'cp_ideaid,cp_name,createdon',
                expand: 'cp_Contact($select=fullname)'
            }
            
            return result
        }
        
        // Smart approach for other entities - use entity metadata to get correct navigation properties
        return buildSmartQueryFromMetadata(viewMetadata, entityConfig)
    }
    
    console.log('⚠️ No valid fields found in view metadata, using default')
    return { select: null, expand: null }
}

/**
 * Build smart query using entity metadata to resolve correct navigation property names
 */
async function buildSmartQueryFromMetadata(viewMetadata, entityConfig) {
    const fields = []
    const expands = []
    
    // Get entity metadata to understand navigation properties
    let entityMetadata = null
    try {
        const accessToken = await getAccessToken()
        if (accessToken) {
            entityMetadata = await getEntityMetadata(accessToken, entityConfig.entityLogicalName)
        }
    } catch (error) {
        console.warn('Could not fetch entity metadata for smart query building:', error.message)
    }
    
    // Build a map of lookup fields to their correct navigation property names
    const navigationMap = new Map()
    if (entityMetadata?.ManyToOneRelationships) {
        entityMetadata.ManyToOneRelationships.forEach(rel => {
            if (rel.ReferencingAttribute && rel.ReferencingEntityNavigationPropertyName) {
                navigationMap.set(rel.ReferencingAttribute, rel.ReferencingEntityNavigationPropertyName)
            }
        })
    }
    
    viewMetadata.columns.forEach(col => {
        const fieldName = col.name
        if (!fieldName || typeof fieldName !== 'string') return
        
        // Check if this is a lookup field
        if (navigationMap.has(fieldName)) {
            // This is a lookup field - use the correct navigation property
            const navProperty = navigationMap.get(fieldName)
            fields.push(`_${fieldName}_value`) // Add the value field for selection
            expands.push(`${navProperty}($select=fullname)`) // Use correct navigation property
        } else if (fieldName.includes('_value')) {
            // This is already a lookup field in _fieldname_value format
            fields.push(fieldName)
            
            // Extract the base field name and try to find navigation property
            const baseField = fieldName.replace(/^_/, '').replace(/_value$/, '')
            const navProperty = navigationMap.get(baseField) || baseField
            expands.push(`${navProperty}($select=fullname)`)
        } else {
            // Regular field - add as-is
            fields.push(fieldName)
        }
    })
    
    const result = {
        select: fields.length > 0 ? fields.join(',') : null,
        expand: expands.length > 0 ? expands.join(',') : null
    }
    
    return result
}

/**
 * Get view metadata (reuse from organization function)
 */
async function getViewMetadata(accessToken, viewGuid) {
    const { DATAVERSE_URL } = process.env
    
    const url = `${DATAVERSE_URL}/api/data/v9.0/savedqueries(${viewGuid})?$select=name,description,layoutxml,fetchxml`
    
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
    return parseViewMetadata(data)
}

/**
 * Get form metadata (reuse from organization function)
 */
async function getFormMetadata(accessToken, formGuid) {
    const { DATAVERSE_URL } = process.env
    
    const url = `${DATAVERSE_URL}/api/data/v9.0/systemforms(${formGuid})?$select=name,description,formxml`
    
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
function parseViewMetadata(viewData) {
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
                return {
                    name: fieldName,
                    displayName: formatDisplayName(fieldName),
                    type: inferFieldType(fieldName),
                    width: '120px'
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
    const displayNames = {
        'cp_ideaid': 'ID',
        'cp_name': 'Name',
        'cp_description': 'Description',
        'createdon': 'Created',
        'modifiedon': 'Modified',
        'statuscode': 'Status',
        'statecode': 'State'
    }
    
    return displayNames[fieldName] || 
           fieldName.replace(/^cp_/, '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
}

function inferFieldType(fieldName) {
    if (fieldName.includes('email')) return 'email'
    if (fieldName.includes('phone') || fieldName.includes('telephone')) return 'phone'
    if (fieldName.includes('createdon') || fieldName.includes('modifiedon')) return 'datetime'
    if (fieldName.endsWith('_value')) return 'lookup'
    if (fieldName === 'statuscode' || fieldName === 'statecode') return 'optionset'
    
    // Handle known contact lookup fields
    if (fieldName === 'cp_contact') return 'lookup'
    
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
 * Get user contact information
 */
async function getUserContact(accessToken, userEmail) {
    const { DATAVERSE_URL } = process.env
    
    const filter = buildSecureEmailFilter(userEmail)
    const select = 'contactid,cp_portaladmin,_parentcustomerid_value'
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
        // Import entity-config function
        const { handler: entityConfigHandler } = await import('./entity-config.js')
        
        // Create fake auth headers for the call (we already have valid access token)
        const configEvent = {
            httpMethod: 'GET',
            queryStringParameters: null,
            headers: { authorization: `Bearer ${accessToken}` }
        }
        
        const configResult = await entityConfigHandler(configEvent, {})
        
        if (configResult.statusCode !== 200) {
            console.warn('Failed to fetch entity configurations for resolution')
            return null
        }
        
        const configData = JSON.parse(configResult.body)
        const configs = configData.configs || []
        
        // First try direct match with logical name (backward compatibility)
        let matchedConfig = configs.find(config => config.entityLogicalName === urlPathOrName)
        
        // If no direct match, try cp_name match
        if (!matchedConfig) {
            matchedConfig = configs.find(config => config.name === urlPathOrName)
        }
        
        // If still no match, try flexible plural/singular matching
        if (!matchedConfig) {
            const urlLower = urlPathOrName.toLowerCase()
            matchedConfig = configs.find(config => {
                const nameLower = config.name.toLowerCase()
                // Try adding/removing 's' for basic plural/singular matching
                return nameLower === urlLower + 's' || 
                       nameLower === urlLower.replace(/s$/, '') ||
                       nameLower + 's' === urlLower
            })
        }
        
        return matchedConfig ? matchedConfig.entityLogicalName : null
        
    } catch (error) {
        console.error('Error resolving entity name:', error)
        return null
    }
}
