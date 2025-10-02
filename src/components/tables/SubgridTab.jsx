/**
 * SubgridTab Component
 * 
 * Renders a subgrid of related records in a tabbed interface.
 * Fetches related records using relationship fields and displays them in a table.
 * 
 * Props:
 * - subgrid: Subgrid metadata from backend (targetEntity, relationshipField, viewId, displayName)
 * - parentEntityId: Parent record GUID
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useContactContext } from '../../contexts/ContactContext'

function SubgridTab({ subgrid, parentEntityId }) {
    const { getToken } = useAuth()
    const { getContactGuid } = useContactContext()
    
    const [records, setRecords] = useState([])
    const [viewMetadata, setViewMetadata] = useState(null)  // NEW: Store view metadata
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchSubgridRecords()
    }, [subgrid, parentEntityId])

    const fetchSubgridRecords = async () => {
        try {
            setLoading(true)
            setError(null)

            const token = await getToken()
            const contactGuid = getContactGuid()

            if (!contactGuid) {
                throw new Error('Contact GUID required for data access')
            }

            // Build query parameters for subgrid
            const params = new URLSearchParams({
                entity: subgrid.targetEntity,
                mode: 'subgrid',
                parentId: parentEntityId,
                relationshipField: subgrid.relationshipField,
                contactGuid: contactGuid
            })

            // Add viewId if available
            if (subgrid.viewId) {
                params.append('viewId', subgrid.viewId)
            }

            const response = await fetch(`/.netlify/functions/generic-entity?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to fetch subgrid data')
            }

            const data = await response.json()
            setRecords(data.entities || [])
            
            // Store view metadata from backend
            if (data.viewMetadata) {
                setViewMetadata(data.viewMetadata)
            }

        } catch (err) {
            console.error(`Error fetching subgrid ${subgrid.displayName}:`, err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Format cell values for display - ALIGNED WITH EntityList.jsx lookup handling
    const formatCellValue = (record, column) => {
        const columnName = column.name
        const type = column.type
        let value = record[columnName]
        
        // Debug lookup field handling - MORE DETAILED
        if (type === 'lookup') {
            console.log(`\n🔍 SUBGRID LOOKUP FIELD PROCESSING:`)
            console.log(`  📌 Column Name: ${columnName}`)
            console.log(`  📌 Column Type: ${type}`)
            console.log(`  📌 Direct Value (record[columnName]): ${value}`)
            console.log(`  � All record keys:`, Object.keys(record))
            console.log(`  📌 Full record:`, record)
        }
        
        // CRITICAL: Don't return early for lookup fields - they need special handling
        // even if record[columnName] is undefined (the actual field is _columnName_value)
        if (type !== 'lookup' && (value === null || value === undefined || value === '')) {
            return <span className="text-gray-400 italic">-</span>
        }

        switch (type) {
            case 'datetime':
                try {
                    const date = new Date(value)
                    if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString('nb-NO', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        })
                    }
                } catch (e) {
                    return value
                }
                break
                
            case 'boolean':
                return value ? 'Yes' : 'No'
                
            case 'email':
                return <a href={`mailto:${value}`} className="text-blue-600 hover:text-blue-800">{value}</a>
                
            case 'phone':
                return <a href={`tel:${value}`} className="text-blue-600 hover:text-blue-800">{value}</a>
                
            case 'lookup':
                // Determine navigation property from column name
                let navigationProperty
                if (columnName.endsWith('_value')) {
                    // _cp_contact_value -> cp_Contact
                    navigationProperty = columnName
                        .replace(/^_/, '')
                        .replace(/_value$/, '')
                        .replace(/^cp_([a-z])/, (match, letter) => `cp_${letter.toUpperCase()}`)
                } else {
                    // cp_contact -> cp_Contact
                    navigationProperty = columnName.replace(/^cp_([a-z])/, (match, letter) => `cp_${letter.toUpperCase()}`)
                }
                
                // Check for expanded navigation property data
                if (navigationProperty && record[navigationProperty]) {
                    const expandedData = record[navigationProperty]
                    if (expandedData && (expandedData.fullname || expandedData.name)) {
                        return (
                            <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                {expandedData.fullname || expandedData.name}
                            </span>
                        )
                    }
                }
                
                return <span className="text-gray-400 italic">-</span>
                
            case 'number':
                if (typeof value === 'number') {
                    return value.toLocaleString('nb-NO', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2
                    })
                }
                break
                
            default:
                // Handle text and other types
                const str = String(value)
                return str.length > 50 ? `${str.substring(0, 50)}...` : str
        }
        
        return value
    }

    // Get columns from view metadata
    const getColumns = () => {
        if (!viewMetadata || !viewMetadata.columns || viewMetadata.columns.length === 0) {
            throw new Error('View metadata required for subgrid rendering')
        }
        
        return viewMetadata.columns.map(col => ({
            name: col.name,
            displayName: col.displayName || col.name.replace(/_/g, ' ').replace(/^cp /, '').replace(/\b\w/g, l => l.toUpperCase()),
            width: col.width || 100,
            type: col.type  // CRITICAL: Must include type for formatCellValue
        }))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading {subgrid.displayName}...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Error Loading Subgrid</h3>
                        <div className="mt-2 text-sm text-red-700">{error}</div>
                        <div className="mt-2 text-xs text-red-600">
                            This error indicates the subgrid configuration is incomplete or invalid. Check that the view exists and has columns defined.
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // REQUIRED: Must have view metadata before rendering
    if (!viewMetadata) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">Missing View Metadata</h3>
                        <div className="mt-2 text-sm text-yellow-700">
                            Cannot render subgrid without view metadata. The backend must return viewMetadata with column definitions.
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (records.length === 0) {
        return (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No {subgrid.displayName} found</h3>
                <p className="mt-1 text-sm text-gray-500">
                    No related records exist yet.
                </p>
            </div>
        )
    }

    const columns = getColumns()

    return (
        <div>
            <div className="mb-4 flex justify-between items-center">
                <div>
                    <p className="text-sm text-gray-600">
                        Showing {records.length} {subgrid.displayName.toLowerCase()}
                    </p>
                    {viewMetadata && (
                        <p className="text-xs text-gray-500 mt-1">
                            View: {viewMetadata.name}
                        </p>
                    )}
                </div>
                <button
                    onClick={fetchSubgridRecords}
                    className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                    🔄 Refresh
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {columns.map((column, index) => (
                                    <th
                                        key={`header-${column.name}-${index}`}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        {column.displayName}
                                    </th>
                                ))}
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {records.map((record, rowIndex) => {
                                const recordId = record[`${subgrid.targetEntity}id`]
                                return (
                                    <tr key={recordId || `row-${rowIndex}`} className="hover:bg-gray-50 transition-colors">
                                        {columns.map((column, colIndex) => (
                                            <td
                                                key={`cell-${recordId || rowIndex}-${column.name}-${colIndex}`}
                                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                            >
                                                {formatCellValue(record, column)}
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className="text-blue-600 hover:text-blue-900 transition-colors">
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default SubgridTab
