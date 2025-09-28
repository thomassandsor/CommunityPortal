import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'

/**
 * ContactValidator Component
 * 
 * For SIGN-IN ONLY authentication flows (like email verification):
 * 1. Validates that authenticated user has matching contact in Dataverse
 * 2. DOES NOT create contacts automatically 
 * 3. Shows error and signs out user if no matching contact found
 * 
 * This is different from ContactChecker which auto-creates contacts for OAuth flows.
 */
function ContactValidator({ children }) {
    const { user, isLoaded } = useUser()
    const navigate = useNavigate()
    const [isValidating, setIsValidating] = useState(true)
    const [hasValidated, setHasValidated] = useState(false)
    const [validationError, setValidationError] = useState('')

    useEffect(() => {
        console.log('ContactValidator useEffect triggered:', { isLoaded, hasUser: !!user, hasValidated })

        // Only run validation once when user is loaded and we haven't validated yet
        if (isLoaded && user && !hasValidated) {
            console.log('Starting contact validation (sign-in only mode)')
            validateExistingContact()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, user, hasValidated])

    const validateExistingContact = async () => {
        try {
            setIsValidating(true)
            setValidationError('')

            const email = user.primaryEmailAddress?.emailAddress
            if (!email) {
                throw new Error('No email found for authenticated user')
            }

            console.log('Validating contact exists for email:', email)

            // Check if contact exists in Dataverse
            const checkResponse = await fetch(`/.netlify/functions/contact?email=${encodeURIComponent(email)}`)

            if (!checkResponse.ok) {
                throw new Error(`Failed to validate contact: ${checkResponse.statusText}`)
            }

            const checkData = await checkResponse.json()

            if (checkData.contact) {
                // Contact exists - validation successful
                console.log('✅ Contact validation successful:', checkData.contact.contactid)
                setHasValidated(true)
            } else {
                // No contact found - this should not happen if email verification worked correctly
                // But if it does, we need to handle it gracefully
                console.error('❌ Contact validation failed: No matching contact in Dataverse')
                setValidationError('Account validation failed. Your account may have been removed. Please contact your administrator.')
                
                // Sign out the user since they shouldn't have access
                setTimeout(() => {
                    window.location.href = '/'
                }, 3000)
            }

        } catch (error) {
            console.error('Error in contact validation:', error)
            setValidationError('Unable to validate your account. Please try again or contact support.')
            
            // On validation error, redirect to landing page after delay
            setTimeout(() => {
                window.location.href = '/'
            }, 3000)
        } finally {
            setIsValidating(false)
        }
    }

    // Show validation error
    if (validationError) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Validation Failed</h2>
                    <p className="text-gray-600 mb-4">{validationError}</p>
                    <p className="text-sm text-gray-500">Redirecting to home page...</p>
                </div>
            </div>
        )
    }

    // Show loading while validating
    if (!isLoaded || (isLoaded && user && isValidating)) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-blue-600 bg-white">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Validating your account...
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                        Checking your access permissions
                    </p>
                </div>
            </div>
        )
    }

    // Render children when validation successful
    return children
}

export default ContactValidator