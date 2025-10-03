/**
 * Security utilities for input validation and sanitization
 * 
 * CRITICAL: These functions prevent injection attacks and validate user input
 * All external input (entity names, GUIDs, field names) must be validated
 */

import { logDebug, logWarn } from './logger.js'

/**
 * Escape OData filter values to prevent injection
 * OData uses single quotes as string delimiters, so we escape them by doubling
 * 
 * @param {string} value - The value to escape
 * @returns {string} - Escaped value safe for OData queries
 * 
 * @example
 * escapeODataValue("O'Brien") => "O''Brien"
 */
export function escapeODataValue(value) {
    if (value === null || value === undefined) {
        return value
    }
    
    if (typeof value !== 'string') {
        return value
    }
    
    // Escape single quotes by doubling them (OData standard)
    return value.replace(/'/g, "''")
}

/**
 * Validate entity name format to prevent injection
 * Entity names should only contain alphanumeric characters, underscores, and common prefixes
 * 
 * @param {string} entityName - The entity name to validate
 * @returns {string} - The validated entity name
 * @throws {Error} - If entity name is invalid
 * 
 * @example
 * validateEntityName("contact") => "contact"
 * validateEntityName("cp_idea") => "cp_idea"
 * validateEntityName("'; DROP TABLE--") => throws Error
 */
export function validateEntityName(entityName) {
    if (!entityName || typeof entityName !== 'string') {
        throw new Error('Invalid entity name: must be a non-empty string')
    }
    
    // Only allow alphanumeric, underscore, and common Dataverse prefixes (new_, cp_, etc.)
    // Must start with letter or underscore
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    if (!validPattern.test(entityName)) {
        logWarn(`🔒 SECURITY: Invalid entity name format rejected: ${entityName}`)
        throw new Error('Invalid entity name format: only alphanumeric and underscore allowed')
    }
    
    // Prevent overly long entity names (potential DoS attack)
    if (entityName.length > 100) {
        logWarn(`🔒 SECURITY: Entity name too long rejected: ${entityName.length} chars`)
        throw new Error('Invalid entity name: exceeds maximum length of 100 characters')
    }
    
    logDebug(`✅ Entity name validated: ${entityName}`)
    return entityName
}

/**
 * Validate GUID format to prevent injection and ensure data integrity
 * Dataverse uses standard GUID format (with or without hyphens)
 * 
 * @param {string} guid - The GUID to validate
 * @returns {string} - The validated GUID
 * @throws {Error} - If GUID is invalid
 * 
 * @example
 * validateGuid("c6821110-9b99-f011-b4cc-6045bd975a7a") => "c6821110-9b99-f011-b4cc-6045bd975a7a"
 * validateGuid("invalid-guid") => throws Error
 * validateGuid("'; DROP TABLE--") => throws Error
 */
export function validateGuid(guid) {
    if (!guid || typeof guid !== 'string') {
        throw new Error('Invalid GUID: must be a non-empty string')
    }
    
    // Standard GUID format: 8-4-4-4-12 hexadecimal characters
    // Allow both with and without braces/hyphens for flexibility
    const guidPattern = /^[{]?[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}[}]?$/
    
    if (!guidPattern.test(guid)) {
        logWarn(`🔒 SECURITY: Invalid GUID format rejected: ${guid}`)
        throw new Error('Invalid GUID format')
    }
    
    // Normalize: remove braces and ensure lowercase
    const normalizedGuid = guid.replace(/[{}]/g, '').toLowerCase()
    
    logDebug(`✅ GUID validated: ${normalizedGuid}`)
    return normalizedGuid
}

/**
 * Sanitize field list for $select queries to prevent injection
 * Ensures only valid field names are included in queries
 * 
 * @param {string[]|string} fields - Array of field names or comma-separated string
 * @returns {string[]} - Array of sanitized field names
 * @throws {Error} - If fields is not valid
 * 
 * @example
 * sanitizeFieldList(['contactid', 'firstname']) => ['contactid', 'firstname']
 * sanitizeFieldList('contactid,firstname') => ['contactid', 'firstname']
 * sanitizeFieldList(['contactid', 'DROP TABLE']) => ['contactid'] (invalid field removed)
 */
export function sanitizeFieldList(fields) {
    let fieldArray = []
    
    if (typeof fields === 'string') {
        fieldArray = fields.split(',').map(f => f.trim())
    } else if (Array.isArray(fields)) {
        fieldArray = fields
    } else {
        throw new Error('Fields must be an array or comma-separated string')
    }
    
    // Valid field names: alphanumeric, underscore, @, and . (for annotations)
    // Must start with letter, underscore, or @
    const validFieldPattern = /^[a-zA-Z_@][a-zA-Z0-9_@.]*$/
    
    const sanitized = fieldArray
        .filter(field => typeof field === 'string')
        .map(field => field.trim())
        .filter(field => {
            if (!validFieldPattern.test(field)) {
                logWarn(`🔒 SECURITY: Invalid field name rejected: ${field}`)
                return false
            }
            return true
        })
        .slice(0, 100) // Limit number of fields to prevent DoS
    
    if (sanitized.length === 0) {
        throw new Error('No valid fields provided')
    }
    
    logDebug(`✅ Sanitized ${sanitized.length} field names`)
    return sanitized
}

/**
 * Validate email address format
 * 
 * @param {string} email - The email to validate
 * @returns {string} - The validated email
 * @throws {Error} - If email is invalid
 */
export function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        throw new Error('Invalid email: must be a non-empty string')
    }
    
    // Basic email validation (not RFC 5322 compliant, but good enough for security)
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    
    if (!emailPattern.test(email)) {
        logWarn(`🔒 SECURITY: Invalid email format rejected: ${email}`)
        throw new Error('Invalid email format')
    }
    
    // Prevent overly long emails (potential DoS)
    if (email.length > 254) { // RFC 5321 max length
        throw new Error('Email address too long')
    }
    
    logDebug(`✅ Email validated: ${email}`)
    return email.toLowerCase() // Normalize to lowercase
}

/**
 * Validate integer input to prevent injection and ensure data integrity
 * 
 * @param {any} value - The value to validate as integer
 * @param {object} options - Validation options
 * @param {number} options.min - Minimum allowed value
 * @param {number} options.max - Maximum allowed value
 * @returns {number} - The validated integer
 * @throws {Error} - If value is not a valid integer
 */
export function validateInteger(value, options = {}) {
    const num = parseInt(value, 10)
    
    if (isNaN(num) || !Number.isFinite(num)) {
        throw new Error('Invalid integer value')
    }
    
    if (options.min !== undefined && num < options.min) {
        throw new Error(`Value must be at least ${options.min}`)
    }
    
    if (options.max !== undefined && num > options.max) {
        throw new Error(`Value must be at most ${options.max}`)
    }
    
    return num
}

/**
 * Build safe OData filter with proper escaping
 * 
 * @param {string} fieldName - The field name (will be validated)
 * @param {string} operator - The OData operator (eq, ne, gt, lt, etc.)
 * @param {any} value - The value to filter by
 * @returns {string} - Safe OData filter string
 */
export function buildSafeODataFilter(fieldName, operator, value) {
    // Validate field name
    const safeFields = sanitizeFieldList([fieldName])
    const safeFieldName = safeFields[0]
    
    // Validate operator (whitelist only)
    const validOperators = ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'contains', 'startswith', 'endswith']
    if (!validOperators.includes(operator)) {
        throw new Error(`Invalid OData operator: ${operator}`)
    }
    
    // Handle different value types
    if (typeof value === 'string') {
        // Escape string values
        const escapedValue = escapeODataValue(value)
        return `${safeFieldName} ${operator} '${escapedValue}'`
    } else if (typeof value === 'number') {
        return `${safeFieldName} ${operator} ${value}`
    } else if (typeof value === 'boolean') {
        return `${safeFieldName} ${operator} ${value}`
    } else if (value === null) {
        return `${safeFieldName} eq null`
    } else {
        throw new Error('Unsupported value type for OData filter')
    }
}
