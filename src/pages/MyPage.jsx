import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import ContactForm from '../components/ContactForm'

function MyPage() {
  const { user, isLoaded } = useUser()
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
      
      // Show success message
      alert('Contact information saved successfully!')
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
      <div className="flex justify-center py-12">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">My Information</h2>
          <p className="text-gray-600 mt-1">
            Manage your contact information stored in Microsoft Dataverse
          </p>
        </div>
        
        <div className="px-6 py-6">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="text-lg text-gray-600">Loading contact information...</div>
            </div>
          )}
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="text-red-800">
                <strong>Error:</strong> {error}
              </div>
            </div>
          )}
          
          {!loading && contact !== null && (
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
        <h3 className="text-sm font-medium text-blue-800 mb-2">Developer Info</h3>
        <div className="text-sm text-blue-700">
          <p><strong>Logged in as:</strong> {user?.primaryEmailAddress?.emailAddress}</p>
          <p><strong>User ID:</strong> {user?.id}</p>
          <p><strong>Contact ID:</strong> {contact?.contactid || 'Not found'}</p>
        </div>
      </div>
    </div>
  )
}

export default MyPage
