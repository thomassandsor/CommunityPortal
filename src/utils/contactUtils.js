/**
 * Contact utility functions for accessing current user's contact information
 * 
 * 🔒 SECURITY ENHANCEMENT (Phase 2 - Task #7):
 * These functions are now DEPRECATED and should be replaced with useContactContext() hook.
 * Contact data is stored in React Context (memory-only) instead of sessionStorage
 * to prevent XSS attacks from accessing sensitive user information.
 * 
 * MIGRATION PATH:
 * - OLD: const contactGuid = getCurrentUserContactGuid()
 * - NEW: const { getContactGuid } = useContactContext(); const contactGuid = getContactGuid()
 * 
 * These legacy functions will be removed in a future version.
 */

/**
 * @deprecated Use useContactContext().getContactGuid() instead
 * 
 * Get the current logged-in user's contact GUID from sessionStorage
 * This can be called from anywhere without hooks
 * @returns {string|null} Contact GUID or null if not found
 */
export const getCurrentUserContactGuid = () => {
    console.warn('⚠️ DEPRECATED: getCurrentUserContactGuid() uses insecure sessionStorage. Use useContactContext().getContactGuid() instead.')
    try {
        const stored = sessionStorage.getItem('userContact')
        if (stored) {
            const contact = JSON.parse(stored)
            console.log('🔍 Retrieved contact GUID from storage:', contact.contactid)
            return contact.contactid || null
        }
    } catch (e) {
        console.error('Error retrieving contact GUID from storage:', e)
    }
    return null
}

/**
 * @deprecated Use useContactContext().contact instead
 * 
 * Get the current logged-in user's full contact object from sessionStorage
 * @returns {object|null} Full contact object or null if not found
 */
export const getCurrentUserContact = () => {
    console.warn('⚠️ DEPRECATED: getCurrentUserContact() uses insecure sessionStorage. Use useContactContext().contact instead.')
    try {
        const stored = sessionStorage.getItem('userContact')
        if (stored) {
            const contact = JSON.parse(stored)
            console.log('🔍 Retrieved full contact from storage:', contact.fullname || contact.emailaddress1)
            return contact
        }
    } catch (e) {
        console.error('Error retrieving contact from storage:', e)
    }
    return null
}

/**
 * @deprecated Use useContactContext().getDisplayName() instead
 * 
 * Get the current logged-in user's display name
 * @returns {string} Display name (fullname, or firstname + lastname, or email)
 */
export const getCurrentUserDisplayName = () => {
    console.warn('⚠️ DEPRECATED: getCurrentUserDisplayName() uses insecure sessionStorage. Use useContactContext().getDisplayName() instead.')
    const contact = getCurrentUserContact()
    if (!contact) return 'Unknown User'
    
    if (contact.fullname) return contact.fullname
    if (contact.firstname && contact.lastname) return `${contact.firstname} ${contact.lastname}`
    if (contact.emailaddress1) return contact.emailaddress1
    
    return 'Unknown User'
}

/**
 * @deprecated Use useContactContext().hasContact() instead
 * 
 * Check if current user has a contact record stored
 * @returns {boolean} True if contact is available
 */
export const hasCurrentUserContact = () => {
    console.warn('⚠️ DEPRECATED: hasCurrentUserContact() uses insecure sessionStorage. Use useContactContext().hasContact() instead.')
    return getCurrentUserContactGuid() !== null
}
