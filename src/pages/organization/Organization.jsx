import { useState, useEffect } from 'react'
import { useUser, useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/shared/Sidebar'

function Organization() {
    const { user, isLoaded } = useUser()
    const { getToken } = useAuth()
    const navigate = useNavigate()
    const [contacts, setContacts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [accountId, setAccountId] = useState(null)

    useEffect(() => {
        if (isLoaded && user) {
            fetchOrganizationContacts()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, user, getToken])

    const fetchOrganizationContacts = async () => {
        try {
            setLoading(true)
            setError(null)

            const token = await getToken()
            const response = await fetch('/.netlify/functions/organization', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Failed to fetch organization contacts: ${response.statusText}`)
            }

            const data = await response.json()
            setContacts(data.contacts || [])
            setAccountId(data.accountId)

            console.log('Organization contacts loaded:', data.contacts?.length || 0)

        } catch (err) {
            console.error('Error fetching organization contacts:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = () => {
        fetchOrganizationContacts()
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
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-white shadow-sm border-b px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">
                                Organization Contacts
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                View all contacts in your organization
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <button
                                onClick={handleRefresh}
                                disabled={loading}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Refreshing...' : 'Refresh'}
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

                {/* Main Content Area */}
                <main className="flex-1 p-6">
                    <div className="max-w-7xl mx-auto">
                        {/* Loading State */}
                        {loading && (
                            <div className="bg-white shadow rounded-lg p-6">
                                <div className="flex items-center justify-center">
                                    <div className="text-lg text-gray-600">Loading organization contacts...</div>
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
                                            Error loading organization contacts
                                        </h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            <p>{error}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Contacts List */}
                        {!loading && !error && (
                            <div className="bg-white shadow rounded-lg">
                                <div className="px-6 py-4 border-b border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Contacts ({contacts.length})
                                        </h3>
                                        {accountId && (
                                            <div className="text-sm text-gray-500">
                                                Account ID: {accountId}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {contacts.length > 0 ? (
                                    <div className="divide-y divide-gray-200">
                                        {contacts.map((contact) => (
                                            <div key={contact.contactid} className="px-6 py-4 hover:bg-gray-50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="flex-shrink-0">
                                                                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                                                    <span className="text-sm font-medium text-gray-700">
                                                                        {contact.firstname?.[0]}{contact.lastname?.[0]}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                                    {contact.firstname} {contact.lastname}
                                                                </p>
                                                                <p className="text-sm text-gray-500 truncate">
                                                                    {contact.emailaddress1}
                                                                </p>
                                                                {contact.mobilephone && (
                                                                    <p className="text-sm text-gray-500 truncate">
                                                                        {contact.mobilephone}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-4">
                                                        <div className="text-sm text-gray-500">
                                                            {contact.createdon && (
                                                                <p>Joined: {new Date(contact.createdon).toLocaleDateString()}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex-shrink-0">
                                                            {contact.cp_portaladmin ? (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                                    🔑 Admin
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                    👤 User
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Contact Details (Expandable) */}
                                                <div className="mt-3 text-xs text-gray-500">
                                                    <p>Contact ID: {contact.contactid}</p>
                                                    {contact.modifiedon && (
                                                        <p>Last Updated: {new Date(contact.modifiedon).toLocaleDateString()}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="px-6 py-12 text-center">
                                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <h3 className="mt-2 text-sm font-medium text-gray-900">No organization contacts</h3>
                                        <p className="mt-1 text-sm text-gray-500">
                                            No contacts found in your organization.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Admin Info */}
                        {!loading && (
                            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-md">
                                <h3 className="text-sm font-medium text-red-800 mb-2">🔑 Admin Access</h3>
                                <div className="text-sm text-red-700 space-y-1">
                                    <p><strong>Logged in as:</strong> {user?.primaryEmailAddress?.emailAddress}</p>
                                    <p><strong>Admin Status:</strong> ✅ Administrator</p>
                                    <p><strong>Organization Access:</strong> Viewing contacts from your associated account</p>
                                    <p><strong>Security:</strong> Only contacts in your organization are visible</p>
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
