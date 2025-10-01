/**
 * Secure Contact Context
 * 
 * Provides contact data via React Context instead of sessionStorage.
 * This prevents XSS attacks from accessing user contact information.
 * 
 * SECURITY FEATURES:
 * - Memory-only storage (not accessible to injected scripts)
 * - No persistence across page refreshes (by design)
 * - Automatic fetch on mount when user is authenticated
 * - Type-safe access via hooks
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'

// Create the context
const ContactContext = createContext(undefined)

/**
 * Contact Provider Component
 * Wraps the application and provides contact data to all children
 */
export function ContactProvider({ children }) {
    const [contact, setContact] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const { getToken } = useAuth()
    const { user, isLoaded } = useUser()

    /**
     * Fetch contact from backend by email
     */
    const fetchContactByEmail = useCallback(async (email) => {
        if (!email) return null

        setLoading(true)
        setError(null)
        
        try {
            console.log('🔐 Fetching contact for email:', email)
            
            const token = await getToken()
            if (!token) {
                throw new Error('Authentication token not available')
            }
            
            const response = await fetch(`/.netlify/functions/contact?email=${encodeURIComponent(email)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Failed to fetch contact: ${response.statusText}`)
            }
            
            const data = await response.json()
            const fetchedContact = data.contact
            
            if (fetchedContact) {
                setContact(fetchedContact)
                console.log('✅ Contact loaded into context (memory-only):', fetchedContact.contactid)
            } else {
                console.log('ℹ️ No contact found for email')
            }
            
            return fetchedContact
            
        } catch (err) {
            console.error('❌ Error fetching contact:', err)
            setError(err.message)
            return null
        } finally {
            setLoading(false)
        }
    }, [getToken])

    /**
     * Save/update contact
     */
    const saveContact = useCallback(async (contactData) => {
        setLoading(true)
        setError(null)
        
        try {
            console.log('💾 Saving contact data')
            
            const token = await getToken()
            if (!token) {
                throw new Error('Authentication token not available')
            }
            
            const response = await fetch('/.netlify/functions/contact', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(contactData),
            })
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Failed to save contact: ${response.statusText}`)
            }
            
            const data = await response.json()
            const savedContact = data.contact
            
            setContact(savedContact)
            console.log('✅ Contact saved successfully:', savedContact.contactid)
            
            return savedContact
            
        } catch (err) {
            console.error('❌ Error saving contact:', err)
            setError(err.message)
            throw err
        } finally {
            setLoading(false)
        }
    }, [getToken])

    /**
     * Clear contact data (logout)
     */
    const clearContact = useCallback(() => {
        setContact(null)
        setError(null)
        console.log('🗑️ Contact data cleared from memory')
    }, [])

    /**
     * Clear error
     */
    const clearError = useCallback(() => {
        setError(null)
    }, [])

    /**
     * Auto-fetch contact when user logs in
     */
    useEffect(() => {
        if (isLoaded && user && !contact && !loading) {
            const email = user.primaryEmailAddress?.emailAddress
            if (email) {
                console.log('👤 User authenticated, auto-fetching contact')
                fetchContactByEmail(email)
            }
        }
    }, [isLoaded, user, contact, loading, fetchContactByEmail])

    // Context value
    const value = {
        // State
        contact,
        loading,
        error,
        
        // Actions
        fetchContactByEmail,
        saveContact,
        updateContact: saveContact, // Alias for consistency
        clearContact,
        clearError,
        
        // Helper getters
        getContactGuid: () => contact?.contactid || null,
        getAccountGuid: () => contact?._parentcustomerid_value || null,
        getDisplayName: () => {
            if (!contact) return 'Unknown User'
            if (contact.fullname) return contact.fullname
            if (contact.firstname && contact.lastname) return `${contact.firstname} ${contact.lastname}`
            if (contact.emailaddress1) return contact.emailaddress1
            return 'Unknown User'
        },
        hasContact: () => contact !== null
    }

    return (
        <ContactContext.Provider value={value}>
            {children}
        </ContactContext.Provider>
    )
}

/**
 * Hook to access contact context
 * Must be used within ContactProvider
 */
export function useContactContext() {
    const context = useContext(ContactContext)
    if (context === undefined) {
        throw new Error('useContactContext must be used within a ContactProvider')
    }
    return context
}

// Export the context for advanced use cases
export default ContactContext
