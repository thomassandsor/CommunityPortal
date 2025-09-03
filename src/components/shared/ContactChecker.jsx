import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * ContactChecker Component
 * 
 * Handles automatic contact creation and routing logic:
 * 1. Checks if user has contact in Dataverse
 * 2. Auto-creates contact if none exists using Clerk data
 * 3. Redirects to appropriate page based on contact status
 */
function ContactChecker({ children }) {
    const { user, isLoaded } = useUser()
    const navigate = useNavigate()
    const location = useLocation()
    const [isChecking, setIsChecking] = useState(true)
    const [hasChecked, setHasChecked] = useState(false)

    useEffect(() => {
        console.log('ContactChecker useEffect triggered:', { isLoaded, hasUser: !!user, hasChecked })

        // Only run check once when user is loaded and we haven't checked yet
        if (isLoaded && user && !hasChecked) {
            // Check if we've already processed this user in this session
            const sessionKey = `contact_checked_${user.id}`
            const alreadyChecked = sessionStorage.getItem(sessionKey)

            console.log('Session check:', { sessionKey, alreadyChecked })

            if (alreadyChecked) {
                console.log('Already checked in session, skipping')
                setIsChecking(false)
                setHasChecked(true)
                return
            }

            console.log('Starting contact check/creation process')
            checkAndCreateContact()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, user, hasChecked])

    const checkAndCreateContact = async () => {
        try {
            setIsChecking(true)

            const email = user.primaryEmailAddress?.emailAddress
            if (!email) {
                console.error('No email found for user')
                setIsChecking(false)
                setHasChecked(true)
                return
            }

            // Mark as checked in session storage to prevent multiple attempts
            const sessionKey = `contact_checked_${user.id}`
            sessionStorage.setItem(sessionKey, 'true')

            console.log('Checking contact for email:', email)

            // First, check if contact exists
            const checkResponse = await fetch(`/.netlify/functions/contact?email=${encodeURIComponent(email)}`)

            if (!checkResponse.ok) {
                throw new Error(`Failed to check contact: ${checkResponse.statusText}`)
            }

            const checkData = await checkResponse.json()

            if (checkData.contact) {
                // Contact exists - redirect to welcome page (unless already on profile/success)
                console.log('Existing contact found:', checkData.contact.contactid)
                if (location.pathname === '/' || location.pathname === '/welcome') {
                    navigate('/welcome')
                }
            } else {
                // No contact found - create one automatically
                console.log('No contact found, creating new contact')

                const contactData = {
                    firstname: user.firstName || '',
                    lastname: user.lastName || '',
                    emailaddress1: email,
                    mobilephone: '' // Will be filled in on profile page
                }

                const createResponse = await fetch('/.netlify/functions/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(contactData),
                })

                if (!createResponse.ok) {
                    const errorText = await createResponse.text()
                    console.error('Failed to create contact:', errorText)
                    throw new Error(`Failed to create contact: ${createResponse.statusText}`)
                }

                const createData = await createResponse.json()
                console.log('Contact created successfully:', createData.contact.contactid)

                // Redirect to profile page to complete information
                                    navigate('/contacts/edit')
            }

        } catch (error) {
            console.error('Error in contact check/creation:', error)
            // On error, still allow user to proceed but log the issue
        } finally {
            setIsChecking(false)
            setHasChecked(true)
        }
    }

    // Show loading while checking
    if (!isLoaded || (isLoaded && user && isChecking)) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-blue-600 bg-white">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Setting up your profile...
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                        Connecting to Microsoft Dataverse
                    </p>
                </div>
            </div>
        )
    }

    // Render children when done checking
    return children
}

export default ContactChecker
