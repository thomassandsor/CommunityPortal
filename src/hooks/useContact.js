import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'

export function useContact() {
    const [contact, setContact] = useState(() => {
        // Initialize from sessionStorage if available
        const stored = sessionStorage.getItem('userContact')
        return stored ? JSON.parse(stored) : null
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const { getToken } = useAuth()

    // Store contact in sessionStorage whenever it changes
    useEffect(() => {
        if (contact) {
            sessionStorage.setItem('userContact', JSON.stringify(contact))
            console.log('🚨 STORED USER CONTACT GUID:', contact.contactid)
            
            // ENHANCEMENT: Also store account GUID for multi-level security
            if (contact._parentcustomerid_value) {
                sessionStorage.setItem('userAccountGuid', contact._parentcustomerid_value)
                console.log('🏢 STORED USER ACCOUNT GUID:', contact._parentcustomerid_value)
            }
        } else {
            sessionStorage.removeItem('userContact')
            sessionStorage.removeItem('userAccountGuid')  // Clean up account GUID too
        }
    }, [contact])

    const fetchContactByEmail = async (email) => {
        if (!email) return

        setLoading(true)
        setError(null)
        
        try {
            console.log('Fetching contact for email:', email)
            
            // Get authentication token from Clerk
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
            setContact(data.contact)
            
            console.log('Contact fetch result:', data.contact ? 'Found' : 'Not found')
            
        } catch (err) {
            console.error('Error fetching contact:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const saveContact = async (contactData) => {
        setLoading(true)
        setError(null)
        
        try {
            console.log('Saving contact data:', contactData)
            
            // Get authentication token from Clerk
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
            setContact(data.contact)
            
            console.log('Contact saved successfully:', data.contact.contactid)
            return data.contact
            
        } catch (err) {
            console.error('Error saving contact:', err)
            setError(err.message)
            throw err
        } finally {
            setLoading(false)
        }
    }

    const updateContact = async (contactData) => {
        return saveContact(contactData) // Same endpoint handles create/update
    }

    const clearError = () => setError(null)

    // Helper function to get just the contact GUID
    const getContactGuid = () => {
        return contact?.contactid || null
    }

    // Static helper to get contact GUID from sessionStorage without hook
    const getCurrentUserContactGuid = () => {
        const stored = sessionStorage.getItem('userContact')
        if (stored) {
            try {
                const contact = JSON.parse(stored)
                return contact.contactid || null
            } catch (e) {
                console.error('Error parsing stored contact:', e)
                return null
            }
        }
        return null
    }

    // ENHANCEMENT: Static helper to get account GUID from sessionStorage
    const getCurrentUserAccountGuid = () => {
        return sessionStorage.getItem('userAccountGuid') || null
    }

    // Helper function to get account GUID from contact
    const getAccountGuid = () => {
        return contact?._parentcustomerid_value || null
    }

    return {
        contact,
        loading,
        error,
        fetchContactByEmail,
        saveContact,
        updateContact,
        clearError,
        getContactGuid,
        getAccountGuid,           // NEW
        getCurrentUserContactGuid,
        getCurrentUserAccountGuid  // NEW
    }
}
