import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useContact } from '../../hooks/useContact'

/**
 * SubgridComponent - Displays related records in a table format
 * 
 * Props:
 * - subgrid: Subgrid configuration from form metadata
 * - parentEntity: Parent entity data
 * - parentEntityConfig: Parent entity configuration
 * - onRecordEdit: Callback when user wants to edit a record
 * - onRecordCreate: Callback when user wants to create a new record
 */
function SubgridComponent({ 
    subgrid, 
    parentEntity, 
    parentEntityConfig, 
    onRecordEdit, 
    onRecordCreate,
    isReadOnly = false 
}) {
    const { getToken } = useAuth()
    const { getCurrentUserContactGuid } = useContact()
    
    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [subgridConfig, setSubgridConfig] = useState(null)

    // Extract entity name from subgrid relationship or entity property
    const relatedEntityName = subgrid.entity || deriveEntityFromRelationship(subgrid.relationship)

    useEffect(() => {
        if (parentEntity && relatedEntityName) {
            fetchSubgridData()
        }
    }, [parentEntity, relatedEntityName, subgrid])

    const fetchSubgridData = async () => {
        if (!parentEntity || !relatedEntityName) return

        setLoading(true)
        setError(null)
        
        try {
            console.log(`🔍 SUBGRID: Fetching data for ${relatedEntityName}`)
            console.log(`🔍 SUBGRID: Parent entity:`, parentEntity)
            console.log(`🔍 SUBGRID: Subgrid config:`, subgrid)

            const contactGuid = await getCurrentUserContactGuid()
            if (!contactGuid) {
                throw new Error('User contact not found')
            }

            const token = await getToken()

            // First, get the entity configuration for the related entity
            const configResponse = await fetch(`/.netlify/functions/entity-config?entity=${relatedEntityName}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            })

            if (!configResponse.ok) {
                throw new Error(`Failed to get entity configuration for ${relatedEntityName}`)
            }

            const configData = await configResponse.json()
            const entityConfig = configData.config
            setSubgridConfig(entityConfig)

            // Build filter for related records
            const parentIdField = getEntityIdField(parentEntityConfig.entityLogicalName)
            const parentId = parentEntity[parentIdField]
            
            if (!parentId) {
                console.warn(`Parent entity ID not found for field ${parentIdField}`)
                setRecords([])
                return
            }

            // Build relationship filter based on subgrid configuration
            let relationshipFilter = ''
            if (subgrid.relationship) {
                // Use the relationship to build the filter
                const lookupField = buildLookupFieldFromRelationship(subgrid.relationship, parentEntityConfig)
                relationshipFilter = `${lookupField} eq '${parentId}'`
            } else {
                // Fallback: try to infer the relationship field
                const inferredLookupField = inferLookupField(parentEntityConfig, entityConfig)
                if (inferredLookupField) {
                    relationshipFilter = `${inferredLookupField} eq '${parentId}'`
                } else {
                    throw new Error(`Cannot determine relationship between ${parentEntityConfig.entityLogicalName} and ${relatedEntityName}`)
                }
            }

            console.log(`🔍 SUBGRID: Relationship filter: ${relationshipFilter}`)

            // Use the generic entity endpoint with subgrid mode
            const response = await fetch(`/.netlify/functions/generic-entity?entity=${relatedEntityName}&mode=subgrid&contactGuid=${contactGuid}&parentFilter=${encodeURIComponent(relationshipFilter)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to fetch subgrid data')
            }

            const data = await response.json()
            console.log(`✅ SUBGRID: Fetched ${data.entities?.length || 0} records`)
            
            setRecords(data.entities || [])

        } catch (err) {
            console.error('Subgrid fetch error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleRecordClick = (record) => {
        if (isReadOnly || !onRecordEdit) return
        
        const entityId = record[getEntityIdField(relatedEntityName)]
        onRecordEdit({
            entityName: relatedEntityName,
            entityId: entityId,
            record: record
        })
    }

    const handleCreateNew = () => {
        if (isReadOnly || !onRecordCreate) return
        
        onRecordCreate({
            entityName: relatedEntityName,
            parentEntity: parentEntity,
            parentEntityConfig: parentEntityConfig,
            subgrid: subgrid
        })
    }

    const getEntityIdField = (entityLogicalName) => {
        if (entityLogicalName.startsWith('cp_')) {
            return `${entityLogicalName}id`
        }
        return `${entityLogicalName}id`
    }

    const formatCellValue = (value, fieldName, record) => {
        if (value === null || value === undefined) return ''
        
        // Handle lookup fields - try to get display value from expanded data
        if (fieldName.endsWith('_value')) {
            // Look for expanded navigation property data
            const navigationProperty = getNavigationPropertyName(fieldName)
            if (record[navigationProperty]) {
                const lookupData = record[navigationProperty]
                return lookupData.fullname || lookupData.name || lookupData.cp_name || 'Related Record'
            }
            return value
        }

        // Handle dates
        if (typeof value === 'string' && (value.includes('T') || value.includes('Z'))) {
            try {
                const date = new Date(value)
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString('nb-NO', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                }
            } catch (e) {
                // Not a valid date, continue
            }
        }

        return value.toString()
    }

    const getNavigationPropertyName = (fieldName) => {
        // Convert _cp_contact_value to cp_Contact
        const match = fieldName.match(/^_(.+)_value$/)
        if (match) {
            const baseName = match[1]
            // Split by underscore and capitalize each part
            return baseName.split('_').map(part => 
                part.charAt(0).toUpperCase() + part.slice(1)
            ).join('')
        }
        return fieldName
    }

    const getDisplayColumns = () => {
        if (!records || records.length === 0) return []
        
        // Get sample record to infer columns
        const sampleRecord = records[0]
        const columns = []

        // Get the most important fields for display
        const fieldPriorityOrder = [
            'cp_name', 'name', 'fullname', 'title', 'subject',
            'createdon', 'modifiedon'
        ]

        const availableFields = Object.keys(sampleRecord)
        
        // Add priority fields first
        fieldPriorityOrder.forEach(field => {
            if (availableFields.includes(field)) {
                columns.push({
                    name: field,
                    displayName: formatDisplayName(field),
                    type: inferFieldType(field)
                })
            }
        })

        // Add other non-system fields
        availableFields.forEach(field => {
            if (!fieldPriorityOrder.includes(field) && !isSystemField(field) && columns.length < 5) {
                columns.push({
                    name: field,
                    displayName: formatDisplayName(field),
                    type: inferFieldType(field)
                })
            }
        })

        return columns
    }

    const formatDisplayName = (fieldName) => {
        // Convert field names to friendly display names
        return fieldName
            .replace(/^cp_/, '')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
    }

    const inferFieldType = (fieldName) => {
        if (fieldName.includes('date') || fieldName.includes('on')) return 'datetime'
        if (fieldName.endsWith('_value')) return 'lookup'
        return 'text'
    }

    const isSystemField = (fieldName) => {
        const systemFields = [
            'statecode', 'statuscode', 'versionnumber', 'timezoneruleversionnumber',
            'utcconversiontimezonecode', 'importsequencenumber', 'overriddencreatedon',
            '_createdby_value', '_modifiedby_value', '_ownerid_value'
        ]
        return systemFields.includes(fieldName) || fieldName.endsWith('id')
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading {subgrid.displayName || 'related records'}...</span>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Error loading subgrid</h3>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const displayColumns = getDisplayColumns()

    return (
        <div className="p-6">
            {/* Subgrid Header */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">
                        {subgrid.displayName || subgrid.label || 'Related Records'}
                    </h3>
                    <p className="text-sm text-gray-600">
                        {records.length} record{records.length !== 1 ? 's' : ''}
                    </p>
                </div>
                
                {!isReadOnly && subgridConfig?.enableSubgridEdit && (
                    <button
                        onClick={handleCreateNew}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        New
                    </button>
                )}
            </div>

            {/* Records Table */}
            {records.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {displayColumns.map(column => (
                                    <th
                                        key={column.name}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        {column.displayName}
                                    </th>
                                ))}
                                {!isReadOnly && (
                                    <th className="relative px-6 py-3">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {records.map((record, index) => (
                                <tr
                                    key={record[getEntityIdField(relatedEntityName)] || index}
                                    className={!isReadOnly ? "hover:bg-gray-50 cursor-pointer" : ""}
                                    onClick={() => handleRecordClick(record)}
                                >
                                    {displayColumns.map(column => (
                                        <td
                                            key={column.name}
                                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                        >
                                            {formatCellValue(record[column.name], column.name, record)}
                                        </td>
                                    ))}
                                    {!isReadOnly && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleRecordClick(record)
                                                }}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m6 0h6m-6 6v6m-6-6v6m6-6v6" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No records found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        No related records exist for this {parentEntityConfig?.name || 'entity'}.
                    </p>
                    {!isReadOnly && subgridConfig?.enableSubgridEdit && (
                        <div className="mt-6">
                            <button
                                onClick={handleCreateNew}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Create first record
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Helper functions
function deriveEntityFromRelationship(relationshipName) {
    if (!relationshipName) return null
    
    // Common relationship naming patterns in Dataverse
    // Examples: cp_contact_cp_idea, account_contact, etc.
    const parts = relationshipName.split('_')
    
    // Try to extract entity name from relationship
    if (parts.length >= 2) {
        // Look for entity patterns
        const possibleEntity = parts[parts.length - 1]
        if (possibleEntity.startsWith('cp_') || ['contact', 'account', 'user'].includes(possibleEntity)) {
            return possibleEntity
        }
    }
    
    return null
}

function buildLookupFieldFromRelationship(relationshipName, parentEntityConfig) {
    if (!relationshipName || !parentEntityConfig) return null
    
    // Build the lookup field name based on the relationship
    // This is a common pattern in Dataverse: _parententity_value
    const parentLogicalName = parentEntityConfig.entityLogicalName
    return `_${parentLogicalName}_value`
}

function inferLookupField(parentEntityConfig, childEntityConfig) {
    if (!parentEntityConfig || !childEntityConfig) return null
    
    // Try common patterns
    const parentLogicalName = parentEntityConfig.entityLogicalName
    const possibleFields = [
        `_${parentLogicalName}_value`,
        `_${parentEntityConfig.contactRelationField}_value`,
        '_parentid_value'
    ]
    
    return possibleFields[0] // Return the most likely field
}

export default SubgridComponent
