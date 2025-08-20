import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import ContactForm from '../components/ContactForm'
import Sidebar from '../components/Sidebar'

function MyPage() {
    const { user, isLoaded } = useUser()
    const navigate = useNavigate()
    const [contact, setContact] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Fetch contact data when component mounts
    useEffect(() => {
        if (isLoaded && user?.primaryEmailAddress?.emailAddress) {
            fetchContact(user.primaryEmailAddress.emailAddress)
        }
    }, [isLoaded, user])

    const fetchContact = async (email) => {
        try {
            setLoading(true)
            setError(null)

            const response = await fetch(`/.netlify/functions/contact?email=${encodeURIComponent(email)}`)

            if (!response.ok) {
                throw new Error(`Failed to fetch contact: ${response.statusText}`)
            }

            const data = await response.json()
            setContact(data.contact)
        } catch (err) {
            console.error('Error fetching contact:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveContact = async (contactData) => {
        try {
            setLoading(true)
            setError(null)

            const response = await fetch('/.netlify/functions/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(contactData),
            })

            if (!response.ok) {
                throw new Error(`Failed to save contact: ${response.statusText}`)
            }

            const data = await response.json()
            setContact(data.contact)

            // Redirect to success page instead of showing alert
            navigate('/success')
        } catch (err) {
            console.error('Error saving contact:', err)
            setError(err.message)
            alert(`Error saving contact: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-gray-50 flex">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center">
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
                        <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>
                        <div className="text-sm text-gray-500">
                            Manage your contact information
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 p-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white shadow rounded-lg">
                            <div className="px-6 py-4 border-b border-gray-200">
                                <h2 className="text-xl font-bold text-gray-900">Contact Information</h2>
                                <p className="text-gray-600 mt-1">
                                    {contact?.contactid
                                        ? 'Update your information stored in Microsoft Dataverse'
                                        : 'Complete your profile information in Microsoft Dataverse'
                                    }
                                </p>
                            </div>

                            <div className="px-6 py-6">
                                {loading && (
                                    <div className="flex justify-center py-8">
                                        <div className="flex items-center text-lg text-gray-600">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Loading contact information...
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                                        <div className="flex">
                                            <svg className="h-5 w-5 text-red-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div className="text-red-800">
                                                <strong>Error:</strong> {error}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!loading && (
                                    <ContactForm
                                        contact={contact}
                                        userEmail={user?.primaryEmailAddress?.emailAddress}
                                        onSave={handleSaveContact}
                                        disabled={loading}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Developer Info */}
                        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
                            <h3 className="text-sm font-medium text-blue-800 mb-2">Developer Information</h3>
                            <div className="text-sm text-blue-700 space-y-1">
                                <p><strong>Logged in as:</strong> {user?.primaryEmailAddress?.emailAddress}</p>
                                <p><strong>User ID:</strong> {user?.id}</p>
                                <p><strong>Contact ID:</strong> {contact?.contactid || 'Not found'}</p>
                                <p><strong>System:</strong> Service Principal authentication via Netlify Functions</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default MyPage
