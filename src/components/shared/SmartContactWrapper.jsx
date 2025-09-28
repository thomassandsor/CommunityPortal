import ContactChecker from './ContactChecker'

/**
 * Smart ContactWrapper that determines the correct validation mode based on authentication method
 */
function SmartContactWrapper({ children }) {
    // Check if this was an email verification sign-in (validate mode) 
    // vs OAuth sign-in (create mode)
    const authMethod = sessionStorage.getItem('auth_method')
    const mode = authMethod === 'email_verification' ? 'validate' : 'create'
    
    console.log('🔍 SmartContactWrapper detected auth method:', authMethod, 'using mode:', mode)
    
    return (
        <ContactChecker mode={mode}>
            {children}
        </ContactChecker>
    )
}

export default SmartContactWrapper