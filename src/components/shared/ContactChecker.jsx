import { useState, useEffect } from 'react'
import { useUser, useAuth } from '@clerk/clerk-react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * ContactChecker Component
 * 
 * Handles contact validation and optional creation:
 * 1. Checks if user has contact in Dataverse
 * 2. In 'create' mode: Auto-creates contact if none exists (for OAuth flows)
 * 3. In 'validate' mode: Rejects access if contact doesn't exist (for email verification flows)
 * 4. Syncs Clerk profile with Dataverse contact data when possible
 * 
 * @param {string} mode - 'create' (default) or 'validate'
 */
function ContactChecker({ children, mode = 'create' }) {
    const { user, isLoaded } = useUser()
    const { getToken } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [isChecking, setIsChecking] = useState(true)
    const [hasChecked, setHasChecked] = useState(false)
    const [validationError, setValidationError] = useState('')

    console.log('🚨 ContactChecker initialized with mode:', mode, 'for user:', user?.primaryEmailAddress?.emailAddress)

    // Helper function to make authenticated API calls
    const makeAuthenticatedRequest = async (url, options = {}) => {
        const token = await getToken()
        return fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        })
    }

    useEffect(() => {
        // Only run check once when user is loaded and we haven't checked yet
        if (isLoaded && user && !hasChecked) {
            // Check if we've already processed this user in this session (only for create mode)
            const sessionKey = `contact_checked_${user.id}`
            const alreadyChecked = sessionStorage.getItem(sessionKey)

            // In validate mode, always check fresh (don't use session cache)
            if (alreadyChecked && mode === 'create') {
                console.log('Already checked in session, skipping (create mode)')
                setIsChecking(false)
                setHasChecked(true)
                return
            }

            if (mode === 'validate') {
                console.log('🔄 VALIDATE MODE: Forcing fresh contact lookup')
            }

            console.log('Starting contact check/creation process')
            checkAndCreateContact()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, user, hasChecked, mode])

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

            // Mark as checked in session storage to prevent multiple attempts (only in create mode)
            const sessionKey = `contact_checked_${user.id}`
            if (mode === 'create') {
                sessionStorage.setItem(sessionKey, 'true')
            }

            console.log('Checking contact for email:', email)

            // First, check if contact exists (with authentication)
            const checkResponse = await makeAuthenticatedRequest(`/.netlify/functions/contact?email=${encodeURIComponent(email)}`)

            if (!checkResponse.ok) {
                throw new Error(`Failed to check contact: ${checkResponse.statusText}`)
            }

            const checkData = await checkResponse.json()

            if (checkData.contact) {
                // Contact exists - handle profile sync and routing
                console.log('Existing contact found:', checkData.contact.contactid)
                
                // Smart Profile Sync - Update Clerk profile with Dataverse contact data
                const contact = checkData.contact
                
                // Check if profile sync should be attempted based on mode
                if (mode === 'validate') {
                    console.log('🔍 VALIDATE MODE: Testing if Clerk profile updates are possible after email verification...')
                    await syncClerkProfile(contact)
                } else {
                    console.log('🔍 CREATE MODE: Attempting Clerk profile sync for OAuth user...')
                    await syncClerkProfile(contact)
                }
                
                setIsChecking(false)
                setHasChecked(true)
                if (location.pathname === '/' || location.pathname === '/welcome') {
                    navigate('/welcome')
                }
            } else if (mode === 'create') {
                // CREATE MODE: No contact found - create one automatically (OAuth flows)
                console.log('No contact found, creating new contact (create mode)')

                const contactData = {
                    firstname: user.firstName || '',
                    lastname: user.lastName || '',
                    emailaddress1: email,
                    mobilephone: '' // Will be filled in on profile page
                }

                const createResponse = await makeAuthenticatedRequest('/.netlify/functions/contact', {
                    method: 'POST',
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
            } else {
                // VALIDATE MODE: No contact found - reject access (email verification flows)
                console.error('❌ Contact validation failed: No matching contact in Dataverse')
                setValidationError('Your email address is not authorized for this portal. Please contact your administrator to request access.')
                setIsChecking(false) // Stop checking but don't set hasChecked
                setTimeout(() => {
                    window.location.href = '/'
                }, 3000)
                return
            }

        } catch (error) {
            console.error('Error in contact check/creation:', error)
            
            if (mode === 'validate') {
                // In validate mode, show error and redirect away
                setValidationError('Unable to validate your account. Please try again or contact support.')
                setIsChecking(false) // Stop checking but don't set hasChecked
                setTimeout(() => {
                    window.location.href = '/'
                }, 3000)
                return
            }
            
            // In create mode, still allow user to proceed but log the issue
            setIsChecking(false)
            setHasChecked(true)
        }
    }

    // Simplified Profile Sync - Update Clerk with Dataverse data (source of truth)
    const syncClerkProfile = async (contact) => {
        if (!contact.firstname || !contact.lastname) {
            console.log('ℹ️ Skipping profile sync - no name data in Dataverse contact')
            return
        }

        const needsUpdate = !user.firstName || !user.lastName || 
                          user.firstName !== contact.firstname || 
                          user.lastName !== contact.lastname

        if (!needsUpdate) {
            console.log('ℹ️ Profile already synchronized with Dataverse')
            return
        }

        console.log('🔄 Syncing Clerk profile with Dataverse data:', {
            from: `${user.firstName || 'missing'} ${user.lastName || 'missing'}`,
            to: `${contact.firstname} ${contact.lastname}`
        })

        try {
            await user.update({
                firstName: contact.firstname,
                lastName: contact.lastname
            })
            
            console.log('✅ Clerk profile updated successfully')
            
        } catch (updateError) {
            console.log('⚠️ Clerk profile update failed (this is expected for some auth methods):', updateError.message)
            // Don't block the flow - Dataverse is still the source of truth
        }
    }

    // Show validation error for validate mode
    if (validationError && mode === 'validate') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Not Authorized</h2>
                    <p className="text-gray-600 mb-6">{validationError}</p>
                    <div className="space-y-3">
                        <p className="text-sm text-gray-500">
                            Email: {user?.primaryEmailAddress?.emailAddress}
                        </p>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            Return to Sign In
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-4">Redirecting automatically in a few seconds...</p>
                </div>
            </div>
        )
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
