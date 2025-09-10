import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import DynamicSidebar from '../../components/shared/DynamicSidebar'

function EntityList() {
    const { entityName } = useParams()
    const navigate = useNavigate()
    const { user, isLoaded } = useUser()
    const { getToken } = useAuth()
    
    const [entities, setEntities] = useState([])
    const [entityConfig, setEntityConfig] = useState(null)
    const [viewMetadata, setViewMetadata] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (isLoaded && user && entityName) {
            fetchEntityList()
        }
    }, [isLoaded, user, entityName])

    const fetchEntityList = async () => {
        // Simple duplicate prevention - only if currently loading the same entity
        if (loading && entities.length > 0) {
            return
        }

        try {
            setLoading(true)
            setError(null)

            const token = await getToken()
            
            const apiUrl = `/.netlify/functions/generic-entity?entity=${entityName}&mode=list`
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('API Error:', errorData)
                throw new Error(errorData.error || `Failed to fetch ${entityName} list: ${response.statusText}`)
            }

            const data = await response.json()
            
            setEntities(data.entities || [])
            setEntityConfig(data.entityConfig)
            setViewMetadata(data.viewMetadata)

        } catch (err) {
            console.error(`Error fetching ${entityName} list:`, err)
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
        
        // For display names like "Ideas", we need to map back to the logical name
        const entityMappings = {
            'Ideas': 'cp_ideaid',
            'Contacts': 'contactid',
            'Accounts': 'accountid'
        }
        
        return entityMappings[entityName] || `${entityName.toLowerCase()}id`
    }

    const DynamicTable = ({ entityConfig, viewMetadata, data }) => {
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
        const columns = viewMetadata?.columns || inferColumnsFromData(data[0])

        return (
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">
                                {entityConfig?.name || entityName}
                            </h3>
                            <p className="mt-1 text-sm text-gray-600">
                                {data.length} record{data.length !== 1 ? 's' : ''}
                                {entityConfig?.description && ` • ${entityConfig.description}`}
                            </p>
                        </div>
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
                                                {formatCellValue(entity[column.name], column.type, entity, column.name)}
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
            '_cp_contact_value': 'Contact'
        }
        
        return displayNames[fieldName] || 
               fieldName.replace(/^cp_/, '').replace(/^_/, '').replace(/_value$/, '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    }

    const inferFieldType = (fieldName, value) => {
        if (fieldName.includes('email')) return 'email'
        if (fieldName.includes('phone') || fieldName.includes('telephone')) return 'phone'
        if (fieldName.includes('createdon') || fieldName.includes('modifiedon')) return 'datetime'
        if (fieldName.endsWith('_value')) return 'lookup'
        
        // Special handling for known contact lookup fields
        if (fieldName === 'cp_contact' || fieldName === entityConfig?.cp_contactrelationfield) {
            return 'lookup'
        }
        
        if (typeof value === 'boolean') return 'boolean'
        if (typeof value === 'number') return 'number'
        return 'text'
    }

    const formatCellValue = (value, type, entity, columnName) => {
        // Special handling for cp_contact column - use expanded contact data if available
        if (columnName === 'cp_contact' && entity.cp_Contact && entity.cp_Contact.fullname) {
            return (
                <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {entity.cp_Contact.fullname}
                </span>
            )
        }

        if (value === null || value === undefined || value === '') {
            return <span className="text-gray-400">—</span>
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
                // For other lookup fields, try to get the expanded data
                if (columnName && columnName.endsWith('_value')) {
                    const navProperty = columnName.replace(/^_/, '').replace(/_value$/, '')
                    const expandedData = entity[navProperty]
                    
                    if (expandedData && expandedData.fullname) {
                        return (
                            <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                {expandedData.fullname}
                            </span>
                        )
                    }
                }
                
                // Fallback: if we have a value, show shortened GUID
                if (value) {
                    return (
                        <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            {String(value).substring(0, 8)}...
                        </span>
                    )
                }
                
                return <span className="text-gray-400">—</span>
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
                                onClick={handleRefresh}
                                disabled={loading}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
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
                            <DynamicTable 
                                entityConfig={entityConfig} 
                                viewMetadata={viewMetadata} 
                                data={entities} 
                            />
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
                                            <p><strong>Admin Required:</strong> {entityConfig.requiresAdmin ? 'Yes' : 'No'}</p>
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
