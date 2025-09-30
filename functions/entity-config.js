/**
 * Netlify Function: entity-config.js
 * 
 * Manages dynamic entity configurations for the Community Portal.
 * Fetches entity configuration from Dataverse to enable dynamic menu generation
 * and generic entity handling.
 * 
 * GET /entity-config - List all available entity configurations
 * GET /entity-config?entity={name} - Get specific entity configuration
 * 
 * SECURITY FEATURES:
 * - Requires user authentication
 * - Filters configurations based on admin requirements
 * - Caches configurations for performance
 */

import { validateSimpleAuth, createAuthErrorResponse, createSuccessResponse, getSecureCorsHeaders, checkRateLimit, createRateLimitResponse, createSafeErrorResponse } from './auth-utils.js'
import { logDebug, logError, logWarn } from './logger.js'

// Configuration cache (in production, use Redis or similar)
const configCache = new Map()
const CACHE_TTL = 1 * 60 * 1000 // 1 minute (reduced from 5 minutes for faster updates)

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

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return createAuthErrorResponse('Method not allowed', 405, origin)
    }

    try {
        // Authenticate user (simple auth - no email required)
        const user = await validateSimpleAuth(event)
        logDebug(`✅ Entity config request from user: ${user.userId}`)
        
        // 🔒 SECURITY: Rate limiting per user ID
        const rateLimitResult = checkRateLimit(user.userId, {
            maxRequests: 30, // 30 requests per minute for config operations (lower since configs are cached)
            windowMs: 60 * 1000,
            message: 'Too many configuration requests. Please slow down.'
        })
        
        if (!rateLimitResult.allowed) {
            return createRateLimitResponse(rateLimitResult, origin)
        }

        // Get access token
        const accessToken = await getAccessToken()
        if (!accessToken) {
            return createAuthErrorResponse('Failed to obtain access token', 500, origin)
        }

        // Check if user is admin (for admin-only configurations)
        let isAdmin = false
        if (user.userEmail) {
            const userContact = await getUserContact(accessToken, user.userEmail)
            isAdmin = userContact?.cp_portaladmin || false
        }

        // Check if cache clear is requested
        const clearCache = event.queryStringParameters?.clearCache === 'true'
        if (clearCache) {
            logDebug('🧹 Clearing entity config cache...')
            configCache.clear()
        }

        // Get requested entity or all configurations
        const entityName = event.queryStringParameters?.entity
        
        if (entityName) {
            const config = await getEntityConfig(accessToken, entityName, isAdmin)
            if (!config) {
                return createAuthErrorResponse('Entity configuration not found', 404, origin)
            }
            return createSuccessResponse({
                config: config,
                userIsAdmin: isAdmin
            }, 200, origin)
        } else {
            const configs = await getAllEntityConfigs(accessToken, isAdmin)
            return createSuccessResponse({
                configs: configs,
                userIsAdmin: isAdmin,
                totalCount: configs.length
            }, 200, origin)
        }

    } catch (error) {
        // 🔒 SECURITY: Use safe error response that sanitizes internal details
        return createSafeErrorResponse(error, 'entity-config-operation', origin)
    }
}

/**
 * Get all entity configurations available to the user
 */
async function getAllEntityConfigs(accessToken, isAdmin) {
    const cacheKey = `all_configs_${isAdmin}`
    
    // Check cache first
    const cached = configCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logDebug('📋 Returning cached entity configurations')
        return cached.data
    }
    
    logDebug('🔄 Cache miss or expired - fetching fresh data')

    logDebug('🔍 Fetching entity configurations from Dataverse...')
    logDebug('🔍 User isAdmin:', isAdmin)
    
    const { DATAVERSE_URL } = process.env
    
    // Build filter based on admin status
    // Always start with active configurations that should show in menu
    let filter = 'statecode eq 0 and cp_showinmenu eq true'
    
    // For non-admins, exclude configurations that require admin privileges
    if (!isAdmin) {
        filter += ' and cp_requiresadmin ne true'
    }
    // For admins, show all configurations where cp_showinmenu = true (regardless of cp_requiresadmin)
    
    logDebug('🔍 OData Filter:', filter)
    
    const select = [
        'cp_entityconfigid',
        'cp_name', 
        'cp_entitylogicalname',
        'cp_formguid',
        'cp_viewmainguid',
        'cp_viewsubgridguid',
        'cp_contactrelationfield',
        'cp_accountrelationfield',
        'cp_showinmenu',
        'cp_menuicon',
        'cp_menuorder',
        'cp_requiresadmin',
        'cp_enablesubgridedit'
    ].join(',')

    const url = `${DATAVERSE_URL}/api/data/v9.0/cp_entityconfigs?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=cp_menuorder`
    logDebug('🔍 Full OData URL:', url)

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
        logError('Failed to fetch entity configurations:', response.status, errorText)
        throw new Error(`Failed to fetch entity configurations: ${response.status}`)
    }

    const data = await response.json()
    logDebug(`✅ Found ${data.value.length} entity configurations matching filter`)
    
    const configs = data.value.map(normalizeEntityConfig)

    // Cache the results
    configCache.set(cacheKey, {
        data: configs,
        timestamp: Date.now()
    })

    logDebug(`✅ Retrieved ${configs.length} entity configurations`)
    return configs
}

/**
 * Get specific entity configuration
 */
async function getEntityConfig(accessToken, entityName, isAdmin) {
    const cacheKey = `config_${entityName}_${isAdmin}`
    
    // Check cache first
    const cached = configCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logDebug(`📋 Returning cached config for: ${entityName}`)
        return cached.data
    }

    logDebug(`🔍 Fetching configuration for entity: ${entityName}`)
    
    const { DATAVERSE_URL } = process.env
    
    // Build filter for specific entity
    let filter = `statecode eq 0 and cp_entitylogicalname eq '${entityName}'`
    // Note: For single entity lookup, we don't filter by cp_showinmenu 
    // because this is used for entity operations, not just menu display
    if (!isAdmin) {
        filter += ' and cp_requiresadmin ne true'
    }
    
    const select = [
        'cp_entityconfigid',
        'cp_name', 
        'cp_entitylogicalname',
        'cp_formguid',
        'cp_viewmainguid',
        'cp_viewsubgridguid',
        'cp_contactrelationfield',
        'cp_accountrelationfield',
        'cp_showinmenu',
        'cp_menuicon',
        'cp_menuorder',
        'cp_requiresadmin',
        'cp_enablesubgridedit'
    ].join(',')

    const url = `${DATAVERSE_URL}/api/data/v9.0/cp_entityconfigs?$filter=${encodeURIComponent(filter)}&$select=${select}`

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
        logError('Failed to fetch entity configuration:', response.status, errorText)
        throw new Error(`Failed to fetch entity configuration: ${response.status}`)
    }

    const data = await response.json()
    logDebug(`🔍 RAW ENTITY CONFIG from Dataverse for ${entityName}:`, data.value[0])
    
    const config = data.value && data.value.length > 0 ? normalizeEntityConfig(data.value[0]) : null
    logDebug(`🔍 NORMALIZED ENTITY CONFIG:`, config)

    if (config) {
        // Cache the result
        configCache.set(cacheKey, {
            data: config,
            timestamp: Date.now()
        })
        logDebug(`✅ Found configuration for: ${entityName}`)
    } else {
        logDebug(`❌ No configuration found for: ${entityName}`)
    }

    return config
}

/**
 * Normalize entity configuration from Dataverse format
 */
function normalizeEntityConfig(rawConfig) {
    // Use cp_name directly as URL path (clean and simple)
    const urlPath = rawConfig.cp_name || rawConfig.cp_entitylogicalname
    
    return {
        id: rawConfig.cp_entityconfigid,
        name: rawConfig.cp_name,
        entityLogicalName: rawConfig.cp_entitylogicalname,
        urlPath: urlPath, // Direct use of cp_name for URLs
        formGuid: rawConfig.cp_formguid,
        viewMainGuid: rawConfig.cp_viewmainguid,
        viewSubgridGuid: rawConfig.cp_viewsubgridguid,
        contactRelationField: rawConfig.cp_contactrelationfield,
        accountRelationField: rawConfig.cp_accountrelationfield,
        showInMenu: rawConfig.cp_showinmenu,
        menuIcon: rawConfig.cp_menuicon,
        menuOrder: rawConfig.cp_menuorder,
        requiresAdmin: rawConfig.cp_requiresadmin,
        enableSubgridEdit: rawConfig.cp_enablesubgridedit,
        description: rawConfig.cp_description || null,
        // Computed properties using cp_name directly
        listPath: `/entity/${urlPath}`,
        editPath: `/entity/${urlPath}/edit`,
        createPath: `/entity/${urlPath}/create`
    }
}

/**
 * Get user contact information
 */
async function getUserContact(accessToken, userEmail) {
    const { DATAVERSE_URL } = process.env
    
    const filter = `emailaddress1 eq '${userEmail.replace(/'/g, "''")}'`
    const select = 'contactid,cp_portaladmin,_parentcustomerid_value'
    const url = `${DATAVERSE_URL}/api/data/v9.0/contacts?$filter=${encodeURIComponent(filter)}&$select=${select}`

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
            logWarn('Failed to fetch user contact for admin check')
            return null
        }

        const data = await response.json()
        return data.value && data.value.length > 0 ? data.value[0] : null
    } catch (error) {
        logWarn('Error fetching user contact:', error)
        return null
    }
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
        logError('Error getting access token:', error)
        return null
    }
}
