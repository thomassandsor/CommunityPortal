import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import DynamicSidebar from '../../components/shared/DynamicSidebar'
import { useContactContext } from '../../contexts/ContactContext.jsx'

function EntityList() {
    const { entityName } = useParams()
    const navigate = useNavigate()
    const { user, isLoaded } = useUser()
    const { getToken } = useAuth()
    const { getContactGuid } = useContactContext()
    
    const [entities, setEntities] = useState([])
    const [entityConfig, setEntityConfig] = useState(null)
    const [viewMetadata, setViewMetadata] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [viewMode, setViewMode] = useState('personal')
    const [userIsAdmin, setUserIsAdmin] = useState(false)

    useEffect(() => {
        if (isLoaded && user && entityName) {
            fetchEntityList()
        }
    }, [isLoaded, user, entityName, viewMode])

    const fetchEntityList = async () => {
        // Simple duplicate prevention - only if currently loading the same entity
        if (loading && entities.length > 0) {
            return
        }

        console.log(`🔥 FRONTEND: Starting fetchEntityList for ${entityName}`)

        try {
            setLoading(true)
            setError(null)

            const token = await getToken()
            console.log(`🔥 FRONTEND: Got token: ${token ? 'YES' : 'NO'}`)
            
            // SECURITY: Get Contact GUID from secure context (no sessionStorage)
            const contactGuid = getContactGuid()
            console.log(`🛡️ FRONTEND: Contact GUID: ${contactGuid ? 'YES' : 'NO'}`)
            
            if (!contactGuid) {
                throw new Error('Contact GUID required for secure data access. Please refresh the page.')
            }
            
            const apiUrl = `/.netlify/functions/generic-entity?entity=${entityName}&mode=list&contactGuid=${encodeURIComponent(contactGuid)}&viewMode=${viewMode}`
            console.log(`🔥 FRONTEND: Making request to: ${apiUrl}`)
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            console.log(`🔥 FRONTEND: Response status: ${response.status}`)
            console.log(`🔥 FRONTEND: Response headers:`, Object.fromEntries([...response.headers]))

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('🔥 FRONTEND: API Error:', errorData)
                throw new Error(errorData.error || `Failed to fetch ${entityName} list: ${response.statusText}`)
            }

            const data = await response.json()
            console.log(`🔥 FRONTEND: Success! Got data:`, data)
            console.log(`🔥 FRONTEND: Entities array:`, data.entities)
            console.log(`🔥 FRONTEND: Entities count:`, data.entities?.length)
            console.log(`🔥 FRONTEND: Entity Config:`, data.entityConfig)
            console.log(`🔥 FRONTEND: Contact Relation Field:`, data.entityConfig?.contactRelationField)
            
            setEntities(data.entities || [])
            setEntityConfig(data.entityConfig)
            setViewMetadata(data.viewMetadata)
            setUserIsAdmin(data.userIsAdmin || false)
            
            console.log(`🔍 FRONTEND: Admin Status from API:`, data.userIsAdmin)

        } catch (err) {
            console.error(`🔥 FRONTEND: Error fetching ${entityName} list:`, err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = () => {
        fetchEntityList()
    }

    const handleEdit = (entity) => {
        const entityId = entity[getEntityIdField(entityName, entityConfig)]
        console.log(`✏️ Selecting entity for edit:`, entity)
        
        // Store selected entity in sessionStorage for clean URL navigation
        sessionStorage.setItem(`selected_${entityName}`, JSON.stringify({
            id: entityId,
            data: entity
        }))
        
        navigate(`/entity/${entityName}/edit`)
    }

    const handleCreate = () => {
        console.log(`➕ Navigating to create new ${entityName}`)
        navigate(`/entity/${entityName}/create`)
    }

    const getEntityIdField = (entityName, entityConfig = null) => {
        // If we have entity config, use the logical name
        if (entityConfig?.entityLogicalName) {
            return `${entityConfig.entityLogicalName}id`
        }
        
        // Handle custom entities (cp_*) vs standard entities
        if (entityName.toLowerCase().startsWith('cp_')) {
            return `${entityName}id`
        }
        
        // Generate ID field name dynamically based on entity configuration
        if (entityConfig && entityConfig.entityLogicalName) {
            return `${entityConfig.entityLogicalName}id`
        }
        
        // Fallback to generic pattern
        return `${entityName.toLowerCase()}id`
    }

    const DynamicTable = ({ entityConfig, viewMetadata, data }) => {
        console.log(`🔥 DYNAMIC TABLE: Received data:`, data)
        console.log(`🔥 DYNAMIC TABLE: Data length:`, data?.length)
        console.log(`🔥 DYNAMIC TABLE: Data is array:`, Array.isArray(data))
        
        if (!data || data.length === 0) {
            return (
                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900">
                            {entityConfig?.name || entityName}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                            No records found
                        </p>
                    </div>
                    <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No {entityConfig?.name || entityName} found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Get started by creating a new record.
                        </p>
                        <div className="mt-6">
                            <button
                                onClick={handleCreate}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                                <svg className="-ml-1 mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                New {entityConfig?.name || entityName}
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        // Use view metadata if available, otherwise infer columns from data
        console.log(`🔥 COLUMNS: viewMetadata?.columns:`, viewMetadata?.columns)
        console.log(`🔥 COLUMNS: data[0]:`, data[0])
        const inferredColumns = inferColumnsFromData(data[0])
        console.log(`🔥 COLUMNS: inferredColumns:`, inferredColumns)
        const columns = viewMetadata?.columns || inferredColumns
        console.log(`🔥 COLUMNS: final columns:`, columns)
        console.log(`🔥 COLUMNS: column names:`, columns.map(c => c.name))
        console.log(`🔥 COLUMNS: data[0] keys:`, Object.keys(data[0]))
        console.log(`🔥 COLUMNS: column/data mismatch:`, columns.map(c => ({
            column: c.name,
            existsInData: data[0].hasOwnProperty(c.name),
            dataValue: data[0][c.name]
        })))

        return (
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">
                                {entityConfig?.name || entityName}
                            </h3>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                            {/* View Mode Selector - Only show for contact-owned entities with admin users */}
                            {/* Account-only entities (like contacts) don't need view selector since all records are organization-level */}
                            {(() => {
                                console.log('🔍 VIEW SELECTOR DEBUG:', {
                                    entityConfigExists: !!entityConfig,
                                    contactRelationField: entityConfig?.contactRelationField,
                                    accountRelationField: entityConfig?.accountRelationField,
                                    userIsAdminFromAPI: userIsAdmin,
                                    isContactOwned: !!entityConfig?.contactRelationField,
                                    isAccountOnly: !!entityConfig?.accountRelationField && !entityConfig?.contactRelationField,
                                    shouldShowSelector: entityConfig?.contactRelationField && userIsAdmin
                                })
                                
                                // Only show view selector for contact-owned entities (not account-only)
                                // Account-only entities like contacts are always "organization" scope
                                return entityConfig?.contactRelationField && userIsAdmin && (
                                    <div className="flex items-center space-x-2">
                                        <label className="text-sm font-medium text-gray-700">View:</label>
                                        <select
                                            value={viewMode}
                                            onChange={(e) => setViewMode(e.target.value)}
                                            className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="personal">My Items</option>
                                            <option value="organization">All Organization Items</option>
                                        </select>
                                    </div>
                                )
                            })()}
                            
                            <button
                                onClick={handleRefresh}
                                disabled={loading}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                            >
                                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {loading ? 'Refreshing...' : 'Refresh'}
                            </button>
                            
                            <button
                                onClick={handleCreate}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <svg className="-ml-1 mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                New {entityConfig?.name?.replace(/s$/, '') || entityName}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Responsive Table Container */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {/* Selection Column */}
                                <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider z-10">
                                    <input type="checkbox" className="rounded border-gray-300" />
                                </th>
                                
                                {/* Dynamic Columns */}
                                {columns.slice(0, 6).map((column, index) => (
                                    <th 
                                        key={`header-${column.name}-${index}`}
                                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap
                                            ${index > 3 ? 'hidden xl:table-cell' : ''}
                                            ${index > 2 ? 'hidden lg:table-cell' : ''}
                                            ${index > 1 ? 'hidden md:table-cell' : ''}
                                        `}
                                        style={{ minWidth: column.width || '120px' }}
                                    >
                                        {column.displayName || column.name}
                                    </th>
                                ))}

                                {/* Actions Column */}
                                <th className="sticky right-0 bg-gray-50 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider z-10">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {data.map((entity, rowIndex) => {
                                const entityId = entity[getEntityIdField(entityName, entityConfig)]
                                
                                // Debug: Check if entityId is valid
                                if (!entityId) {
                                    console.warn('⚠️ Missing entityId for entity:', entity, 'Expected field:', getEntityIdField(entityName, entityConfig))
                                }
                                
                                return (
                                    <tr key={entityId || `row-${rowIndex}`} className="hover:bg-gray-50">
                                        {/* Selection Cell */}
                                        <td className="sticky left-0 bg-white px-6 py-4 whitespace-nowrap z-10">
                                            <input type="checkbox" className="rounded border-gray-300" />
                                        </td>

                                        {/* Dynamic Data Cells */}
                                        {columns.slice(0, 6).map((column, colIndex) => (
                                            <td 
                                                key={`cell-${entityId || rowIndex}-${column.name}-${colIndex}`}
                                                className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900
                                                    ${colIndex > 3 ? 'hidden xl:table-cell' : ''}
                                                    ${colIndex > 2 ? 'hidden lg:table-cell' : ''}
                                                    ${colIndex > 1 ? 'hidden md:table-cell' : ''}
                                                `}
                                                title={entity[column.name] ? String(entity[column.name]) : ''}
                                            >
                                                {/* Dynamic display for contact field */}
                                                {(() => {
                                                    // Check if this is the contact relation field - FIXED camelCase
                                                    const configuredContactField = entityConfig?.contactRelationField || entityConfig?.cp_contactrelationfield
                                                    if (column.name === configuredContactField) {
                                                        const contactNavProperty = configuredContactField.replace(/^cp_([a-z])/, (match, letter) => `cp_${letter.toUpperCase()}`)
                                                        
                                                        console.log('🔍 Dynamic contact field debug:', {
                                                            columnName: column.name,
                                                            contactNavProperty: contactNavProperty,
                                                            hasContact: !!entity[contactNavProperty],
                                                            fullname: entity[contactNavProperty]?.fullname,
                                                            entity: entity
                                                        })
                                                        
                                                        // Show contact name if available
                                                        if (entity[contactNavProperty]?.fullname) {
                                                            return (
                                                                <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                                    {entity[contactNavProperty].fullname}
                                                                </span>
                                                            )
                                                        }
                                                    }
                                                    
                                                    // Default cell formatting
                                                    return formatCellValue(entity[column.name], column.type, entity, column.name)
                                                })()}
                                            </td>
                                        ))}

                                        {/* Actions Cell */}
                                        <td className="sticky right-0 bg-white px-6 py-4 whitespace-nowrap text-right text-sm font-medium z-10">
                                            <button 
                                                onClick={() => handleEdit(entity)}
                                                className="text-blue-600 hover:text-blue-900 mr-3"
                                            >
                                                Edit
                                            </button>
                                            <button className="text-gray-400 hover:text-gray-600">
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden">
                    {data.map((entity, mobileIndex) => {
                        const entityId = entity[getEntityIdField(entityName, entityConfig)]
                        return (
                            <div key={entityId || `mobile-${mobileIndex}`} className="p-4 border-b border-gray-200">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        {columns.slice(0, 3).map((column, index) => (
                                            <div key={`mobile-${entityId || mobileIndex}-${column.name}-${index}`} className="mb-2">
                                                <span className="text-xs text-gray-500">{column.displayName || column.name}:</span>
                                                <span className="ml-2 text-sm text-gray-900">
                                                    {formatCellValue(entity[column.name], column.type, entity, column.name)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => handleEdit(entity)}
                                        className="ml-4 text-blue-600 hover:text-blue-900 text-sm"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    const inferColumnsFromData = (sampleEntity) => {
        if (!sampleEntity) return []
        
        return Object.keys(sampleEntity)
            .filter(key => !key.startsWith('_') || key.includes('_value')) // Include lookup _value fields
            .slice(0, 6) // Limit to 6 columns for display
            .map(key => ({
                name: key,
                displayName: formatDisplayName(key),
                type: inferFieldType(key, sampleEntity[key]),
                width: '120px'
            }))
    }

    const formatDisplayName = (fieldName) => {
        const displayNames = {
            'contactid': 'ID',
            'accountid': 'ID',
            'fullname': 'Full Name',
            'firstname': 'First Name',
            'lastname': 'Last Name',
            'emailaddress1': 'Email',
            'mobilephone': 'Mobile',
            'telephone1': 'Phone',
            'name': 'Name',
            'cp_name': 'Name',
            'cp_description': 'Description',
            'createdon': 'Created',
            'modifiedon': 'Modified',
            '_parentcustomerid_value': 'Company',
            '_primarycontactid_value': 'Primary Contact',
        }
        
        // Add dynamic contact field display name if configured - FIXED camelCase
        const configuredContactField = entityConfig?.contactRelationField || entityConfig?.cp_contactrelationfield
        if (configuredContactField) {
            const contactLookupField = `_${configuredContactField}_value`
            displayNames[contactLookupField] = 'Contact'
        }
        
        return displayNames[fieldName] || 
               fieldName.replace(/^cp_/, '').replace(/^_/, '').replace(/_value$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    }

    const inferFieldType = (fieldName, value) => {
        if (fieldName.includes('email')) return 'email'
        if (fieldName.includes('phone') || fieldName.includes('telephone')) return 'phone'
        if (fieldName.includes('createdon') || fieldName.includes('modifiedon')) return 'datetime'
        if (fieldName.endsWith('_value')) return 'lookup'
        
        // Special handling for known contact lookup fields - FIXED camelCase
        const configuredContactField = entityConfig?.contactRelationField || entityConfig?.cp_contactrelationfield
        if (fieldName === 'cp_contact' || fieldName === configuredContactField) {
            return 'lookup'
        }
        
        if (typeof value === 'boolean') return 'boolean'
        if (typeof value === 'number') return 'number'
        return 'text'
    }

    const formatCellValue = (value, type, entity, columnName) => {
        // Debug lookup field handling
        if (columnName && columnName.includes('contact')) {
            console.log(`🔍 LOOKUP DEBUG: columnName=${columnName}, value=${value}, type=${type}`)
            console.log(`🔍 LOOKUP DEBUG: entity keys:`, Object.keys(entity))
            console.log(`🔍 LOOKUP DEBUG: entity data:`, entity)
            // Add visible alert to confirm function is called
            console.log(`🚨 CONTACT FIELD PROCESSING: ${columnName} with type ${type}`)
        }

        // Dynamic handling for contact relation field - use expanded contact data if available - FIXED camelCase
        const configuredContactField = entityConfig?.contactRelationField || entityConfig?.cp_contactrelationfield
        const contactNavProperty = configuredContactField ? 
            configuredContactField.replace(/^cp_([a-z])/, (match, letter) => `cp_${letter.toUpperCase()}`) : null
        if (columnName === configuredContactField && contactNavProperty && 
            entity[contactNavProperty] && entity[contactNavProperty].fullname) {
            return (
                <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {entity[contactNavProperty].fullname}
                </span>
            )
        }

        if (value === null || value === undefined || value === '') {
            return ''
        }

        switch (type) {
            case 'datetime':
                return new Date(value).toLocaleDateString()
            case 'boolean':
                return value ? 'Yes' : 'No'
            case 'email':
                return <a href={`mailto:${value}`} className="text-blue-600 hover:text-blue-800">{value}</a>
            case 'phone':
                return <a href={`tel:${value}`} className="text-blue-600 hover:text-blue-800">{value}</a>
            case 'lookup':
                console.log(`🔍 LOOKUP CASE: columnName=${columnName}, value=${value}`)
                
                // Dynamic handling based on entity configuration - FIXED camelCase field name
                const configuredContactField = entityConfig?.contactRelationField || entityConfig?.cp_contactrelationfield
                console.log(`🔍 LIST: Configured contact field:`, configuredContactField)
                
                if (columnName === configuredContactField) {
                    console.log(`🚨 DYNAMIC CONTACT LOOKUP DETECTED! Entity:`, entity)
                }
                
                // Map view column names to actual field names
                let actualFieldName = columnName
                let navigationProperty = null
                
                // Handle dynamic mappings for configured lookup fields
                if (columnName === configuredContactField) {
                    actualFieldName = `_${configuredContactField}_value`
                    navigationProperty = configuredContactField ? 
                        configuredContactField.replace(/^cp_([a-z])/, (match, letter) => `cp_${letter.toUpperCase()}`) : null
                } else if (columnName.endsWith('_value')) {
                    // For already converted _value fields
                    actualFieldName = columnName
                    navigationProperty = columnName.replace(/^_cp_([a-z])/, (match, prefix, letter) => `cp_${letter.toUpperCase()}`).replace(/_value$/, '')
                }
                
                console.log(`🔍 LOOKUP MAPPING: ${columnName} -> field: ${actualFieldName}, nav: ${navigationProperty}`)
                
                // Get the actual field value from the entity
                const actualValue = entity[actualFieldName]
                console.log(`🔍 LOOKUP ACTUAL VALUE: ${actualValue}`)
                
                // Check if we have expanded navigation property data
                if (navigationProperty && entity[navigationProperty]) {
                    const expandedData = entity[navigationProperty]
                    console.log(`🔍 LOOKUP EXPANDED DATA:`, expandedData)
                    
                    if (expandedData && expandedData.fullname) {
                        console.log(`🔍 LOOKUP SUCCESS: Using ${navigationProperty}.fullname = ${expandedData.fullname}`)
                        return (
                            <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                {expandedData.fullname}
                            </span>
                        )
                    }
                }
                
                // Fallback: For lookup fields that end with _value, try pattern matching
                if (columnName && columnName.endsWith('_value') && !navigationProperty) {
                    // Try different navigation property mappings (keeping existing patterns for compatibility)
                    const patterns = [
                        // Pattern 1: _cp_fieldname_value -> cp_Fieldname (proper case)
                        columnName.replace(/^_cp_/, 'cp_').replace(/_value$/, '').replace(/^cp_/, 'cp_').replace(/^cp_([a-z])/, (match, letter) => 'cp_' + letter.toUpperCase()),
                        // Pattern 2: _cp_fieldname_value -> cp_fieldname (lowercase)
                        columnName.replace(/^_/, '').replace(/_value$/, ''),
                        // Pattern 3: Include configured navigation property if available - FIXED camelCase
                        configuredContactField ? 
                            configuredContactField.replace(/^cp_([a-z])/, (match, letter) => `cp_${letter.toUpperCase()}`) : null
                    ]
                    
                    console.log(`🔍 LOOKUP PATTERNS: trying patterns:`, patterns)
                    
                    for (const pattern of patterns) {
                        const expandedData = entity[pattern]
                        console.log(`🔍 LOOKUP PATTERN: ${pattern} -> ${expandedData ? 'FOUND' : 'NOT FOUND'}`)
                        
                        if (expandedData && expandedData.fullname) {
                            console.log(`🔍 LOOKUP SUCCESS: Using ${pattern}.fullname = ${expandedData.fullname}`)
                            return (
                                <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                    {expandedData.fullname}
                                </span>
                            )
                        }
                    }
                }
                
                // Display truncated GUID if no lookup display value available
                const displayValue = actualValue || value
                if (displayValue) {
                    return (
                        <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            {String(displayValue).substring(0, 8)}...
                        </span>
                    )
                }
                
                return ''
            default:
                const stringValue = String(value)
                return stringValue.length > 50 ? stringValue.substring(0, 50) + '...' : stringValue
        }
    }

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-lg text-gray-600">Loading...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <DynamicSidebar />

            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-white shadow-sm border-b px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">
                                {entityConfig?.name || entityName}
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                {entityConfig?.description || `Manage ${entityName} records`}
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => navigate('/welcome')}
                                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors border border-gray-300"
                            >
                                Back to Home
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 p-6">
                    <div className="max-w-7xl mx-auto">
                        {/* Loading State */}
                        {loading && (
                            <div className="bg-white shadow rounded-lg p-6">
                                <div className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <div className="ml-3 text-lg text-gray-600">Loading {entityName} records...</div>
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {error && !loading && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">
                                            Error loading {entityName} records
                                        </h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            {error}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}



                        {/* Success State - Dynamic Table */}
                        {!loading && !error && (
                            <>
                                {console.log(`🔥 RENDER: Passing entities to DynamicTable:`, entities)}
                                {console.log(`🔥 RENDER: Entities length:`, entities.length)}
                                <DynamicTable 
                                    entityConfig={entityConfig} 
                                    viewMetadata={viewMetadata} 
                                    data={entities} 
                                />
                            </>
                        )}

                        {/* Debug Info */}
                        {!loading && entityConfig && (
                            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-blue-800">Entity Configuration</h3>
                                        <div className="mt-2 text-sm text-blue-700 space-y-1">
                                            <p><strong>Entity:</strong> {entityConfig.entityLogicalName}</p>
                                            <p><strong>Records:</strong> {entities.length}</p>
                                            <p><strong>View Mode:</strong> {viewMode === 'personal' ? 'My Items' : 'All Organization Items'}</p>
                                            <p><strong>Admin User:</strong> {userIsAdmin ? 'Yes' : 'No'}</p>
                                            <p><strong>Contact Field:</strong> {entityConfig.contactRelationField || 'None'}</p>
                                            <p><strong>Account Field:</strong> {entityConfig.accountRelationField || 'None'}</p>
                                            {viewMetadata && <p><strong>View:</strong> {viewMetadata.name}</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}

export default EntityList
