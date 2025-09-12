/**
 * Contact utility functions for accessing current user's contact information
 */

/**
 * Get the current logged-in user's contact GUID from sessionStorage
 * This can be called from anywhere without hooks
 * @returns {string|null} Contact GUID or null if not found
 */
export const getCurrentUserContactGuid = () => {
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
 * Get the current logged-in user's full contact object from sessionStorage
 * @returns {object|null} Full contact object or null if not found
 */
export const getCurrentUserContact = () => {
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
 * Get the current logged-in user's display name
 * @returns {string} Display name (fullname, or firstname + lastname, or email)
 */
export const getCurrentUserDisplayName = () => {
    const contact = getCurrentUserContact()
    if (!contact) return 'Unknown User'
    
    if (contact.fullname) return contact.fullname
    if (contact.firstname && contact.lastname) return `${contact.firstname} ${contact.lastname}`
    if (contact.emailaddress1) return contact.emailaddress1
    
    return 'Unknown User'
}

/**
 * Check if current user has a contact record stored
 * @returns {boolean} True if contact is available
 */
export const hasCurrentUserContact = () => {
    return getCurrentUserContactGuid() !== null
}
