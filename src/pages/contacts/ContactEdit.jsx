import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { useContact } from '../../hooks/useContact'
import ContactForm from '../../components/forms/ContactForm'
import Sidebar from '../../components/shared/Sidebar'

function ContactEdit() {
    const { user, isLoaded } = useUser()
    const navigate = useNavigate()
    const { contact, loading, error, fetchContactByEmail, saveContact, clearError } = useContact()
    const [isEditing, setIsEditing] = useState(false)
    const [showSuccessMessage, setShowSuccessMessage] = useState(false)

    // Fetch contact data when component mounts
    useEffect(() => {
        if (isLoaded && user?.primaryEmailAddress?.emailAddress) {
            fetchContactByEmail(user.primaryEmailAddress.emailAddress)
        }
    }, [isLoaded, user])

    // Determine if we should be in edit mode
    useEffect(() => {
        if (contact) {
            // If contact exists but has minimal info, enable edit mode
            const hasMinimalInfo = !contact.firstname || !contact.lastname || !contact.mobilephone
            setIsEditing(hasMinimalInfo)
        } else {
            // No contact found, will be created when saving
            setIsEditing(true)
        }
    }, [contact])

    const handleSaveContact = async (contactData) => {
        try {
            await saveContact(contactData)
            setIsEditing(false)
            
            // Show success message instead of redirecting
            setShowSuccessMessage(true)
            
            // Auto-hide success message after 5 seconds
            setTimeout(() => {
                setShowSuccessMessage(false)
            }, 5000)
            
        } catch (err) {
            console.error('Error saving contact:', err)
            alert(`Error saving contact: ${err.message}`)
        }
    }

    const handleToggleEdit = () => {
        if (error) clearError()
        if (showSuccessMessage) setShowSuccessMessage(false)
        setIsEditing(!isEditing)
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
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">
                                {isEditing ? 'Edit Contact' : 'Contact Details'}
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                {contact?.contactid 
                                    ? 'Your information stored in Microsoft Dataverse'
                                    : 'Complete your profile information'
                                }
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            {contact && !isEditing && (
                                <button
                                    onClick={handleToggleEdit}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                >
                                    Edit Profile
                                </button>
                            )}
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
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white shadow rounded-lg">
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

                                {showSuccessMessage && (
                                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                                        <div className="flex items-center">
                                            <svg className="h-5 w-5 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div className="text-green-800">
                                                <strong>Success!</strong> Your contact information has been saved successfully.
                                            </div>
                                            <button
                                                onClick={() => setShowSuccessMessage(false)}
                                                className="ml-auto text-green-600 hover:text-green-800 transition-colors"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!loading && isEditing && (
                                    <ContactForm
                                        contact={contact}
                                        userEmail={user?.primaryEmailAddress?.emailAddress}
                                        onSave={handleSaveContact}
                                        disabled={loading}
                                    />
                                )}

                                {!loading && !isEditing && contact && (
                                    <div className="space-y-6">
                                        {/* View Mode */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    First Name
                                                </label>
                                                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">
                                                    {contact.firstname || 'Not provided'}
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Last Name
                                                </label>
                                                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">
                                                    {contact.lastname || 'Not provided'}
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Email Address
                                                </label>
                                                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">
                                                    {contact.emailaddress1}
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Mobile Phone
                                                </label>
                                                <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">
                                                    {contact.mobilephone || 'Not provided'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Record Info */}
                                        <div className="pt-4 border-t border-gray-200">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
                                                <p>
                                                    <strong>Contact ID:</strong> {contact.contactid}
                                                </p>
                                                <p>
                                                    <strong>Last Modified:</strong> {contact.modifiedon ? new Date(contact.modifiedon).toLocaleDateString() : 'Unknown'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isEditing && (
                                    <div className="flex justify-end pt-4 border-t border-gray-200">
                                        {contact && (
                                            <button
                                                onClick={handleToggleEdit}
                                                className="mr-3 px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
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

export default ContactEdit
