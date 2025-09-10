import { useState, useEffect } from 'react'
import { useUser, useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import DynamicSidebar from '../../components/shared/DynamicSidebar'

function Organization() {
    const { user, isLoaded } = useUser()
    const { getToken } = useAuth()
    const navigate = useNavigate()
    const [viewData, setViewData] = useState(null)
    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [accountId, setAccountId] = useState(null)

    useEffect(() => {
        if (isLoaded && user) {
            fetchDynamicView()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, user, getToken])

    const fetchDynamicView = async () => {
        try {
            setLoading(true)
            setError(null)

            const token = await getToken()
            const response = await fetch('/.netlify/functions/organization?mode=dynamic', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Failed to fetch dynamic view: ${response.statusText}`)
            }

            const data = await response.json()
            setViewData(data.viewMetadata)
            setContacts(data.contacts || [])
            setAccountId(data.accountId)

            console.log('Dynamic view loaded:', {
                columns: data.viewMetadata?.columns?.length || 0,
                contacts: data.contacts?.length || 0
            })

        } catch (err) {
            console.error('Error fetching dynamic view:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = () => {
        fetchDynamicView()
    }

    const handleEditContact = (contact) => {
        console.log('✏️ Navigating to edit contact:', contact.fullname)
        navigate(`/organization/edit/${contact.contactid}`)
    }

    const DynamicTable = ({ viewMetadata, data }) => {
        if (!viewMetadata || !viewMetadata.columns) {
            return <div className="text-gray-500">No view metadata available</div>
        }

        return (
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">
                        {viewMetadata.displayName || 'Organization Contacts'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                        {data.length} contact{data.length !== 1 ? 's' : ''} • View: {viewMetadata.name}
                    </p>
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
                                {viewMetadata.columns.map((column, index) => (
                                    <th 
                                        key={column.name}
                                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap
                                            ${index > 2 ? 'hidden xl:table-cell' : ''}
                                            ${index > 1 ? 'hidden lg:table-cell' : ''}
                                            ${index > 0 ? 'hidden md:table-cell' : ''}
                                        `}
                                        style={{ minWidth: column.width || '120px' }}
                                    >
                                        {column.displayName}
                                    </th>
                                ))}

                                {/* Actions Column */}
                                <th className="sticky right-0 bg-gray-50 px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider z-10">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {data.map((contact, rowIndex) => (
                                <tr key={contact.contactid} className="hover:bg-gray-50">
                                    {/* Selection Cell */}
                                    <td className="sticky left-0 bg-white px-6 py-4 whitespace-nowrap z-10">
                                        <input type="checkbox" className="rounded border-gray-300" />
                                    </td>

                                    {/* Dynamic Data Cells */}
                                    {viewMetadata.columns.map((column, colIndex) => (
                                        <td 
                                            key={`${contact.contactid}-${column.name}`}
                                            className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900
                                                ${colIndex > 2 ? 'hidden xl:table-cell' : ''}
                                                ${colIndex > 1 ? 'hidden lg:table-cell' : ''}
                                                ${colIndex > 0 ? 'hidden md:table-cell' : ''}
                                            `}
                                            title={contact[column.name] ? String(contact[column.name]) : ''}
                                        >
                                            {formatCellValue(contact[column.name], column.type, contact, column.name)}
                                        </td>
                                    ))}

                                    {/* Actions Cell */}
                                    <td className="sticky right-0 bg-white px-6 py-4 whitespace-nowrap text-right text-sm font-medium z-10">
                                        <button 
                                            onClick={() => handleEditContact(contact)}
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
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden">
                    {data.map((contact) => (
                        <div key={contact.contactid} className="p-4 border-b border-gray-200">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    {viewMetadata.columns.slice(0, 3).map((column) => (
                                        <div key={column.name} className="mb-2">
                                            <span className="text-xs text-gray-500">{column.displayName}:</span>
                                            <span className="ml-2 text-sm text-gray-900">
                                                {formatCellValue(contact[column.name], column.type, contact, column.name)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => handleEditContact(contact)}
                                    className="ml-4 text-blue-600 hover:text-blue-900 text-sm"
                                >
                                    Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {data.length === 0 && (
                    <div className="text-center py-12">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No contacts found</h3>
                        <p className="mt-1 text-sm text-gray-500">No contacts match the current view criteria.</p>
                    </div>
                )}
            </div>
        )
    }

    const formatCellValue = (value, type, contact, fieldName) => {
        // Handle field name mapping for lookup fields
        let actualValue = value
        if (fieldName === 'parentcustomerid' && contact._parentcustomerid_value) {
            // Map view field name to actual data field name
            actualValue = contact._parentcustomerid_value
        }
        
        if (actualValue === null || actualValue === undefined || actualValue === '') {
            return <span className="text-gray-400">—</span>
        }

        switch (type) {
            case 'datetime':
                return new Date(actualValue).toLocaleDateString()
            case 'boolean':
                return actualValue ? 'Yes' : 'No'
            case 'email':
                return <a href={`mailto:${actualValue}`} className="text-blue-600 hover:text-blue-800">{actualValue}</a>
            case 'phone':
                return <a href={`tel:${actualValue}`} className="text-blue-600 hover:text-blue-800">{actualValue}</a>
            case 'lookup':
                return formatLookupField(fieldName, actualValue, contact)
            default:
                return String(actualValue).length > 50 ? String(actualValue).substring(0, 50) + '...' : String(actualValue)
        }
    }

    // Handle different lookup field types
    const formatLookupField = (fieldName, value, contact) => {
        // Handle Customer lookup (parentcustomerid) - can be Account OR Contact
        if (fieldName === '_parentcustomerid_value' || fieldName === 'parentcustomerid') {
            // Customer lookup can be Account OR Contact - check enriched data
            if (contact.parentcustomerid) {
                const parentCustomer = contact.parentcustomerid
                
                // Display the parent customer info based on entity type
                let customerName = 'Unknown Customer'
                
                if (parentCustomer.entityType === 'account') {
                    customerName = parentCustomer.name || 'Unknown Account'
                } else if (parentCustomer.entityType === 'contact') {
                    customerName = parentCustomer.fullname || 'Unknown Contact'
                } else {
                    // Fallback - try both name patterns
                    customerName = parentCustomer.name || parentCustomer.fullname || 'Unknown Customer'
                }
                
                return (
                    <div className="text-sm font-medium text-blue-600">
                        {customerName}
                    </div>
                )
            }
            
            // Fallback: show shortened GUID with label
            return (
                <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    Customer: {String(value).substring(0, 8)}...
                </span>
            )
        }

        // Generic lookup handling
        return (
            <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {String(value).substring(0, 8)}...
            </span>
        )
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
                                Organization Contacts
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Dynamic view powered by Dataverse
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
                                    <div className="ml-3 text-lg text-gray-600">Loading dynamic view...</div>
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
                                            Error loading dynamic view
                                        </h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            {error}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Success State - Dynamic Table */}
                        {!loading && !error && viewData && (
                            <DynamicTable viewMetadata={viewData} data={contacts} />
                        )}

                        {/* Admin Info */}
                        {!loading && viewData && (
                            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-blue-800">Dynamic View Information</h3>
                                        <div className="mt-2 text-sm text-blue-700 space-y-1">
                                            <p><strong>Logged in as:</strong> {user?.primaryEmailAddress?.emailAddress}</p>
                                            <p><strong>View:</strong> {viewData.displayName}</p>
                                            <p><strong>Columns:</strong> {viewData.columns?.length || 0}</p>
                                            <p><strong>Records:</strong> {contacts.length}</p>
                                            <p><strong>Account ID:</strong> {accountId?.substring(0, 8)}...</p>
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

export default Organization
