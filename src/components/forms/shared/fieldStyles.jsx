/**
 * Shared field styling constants for consistent form appearance
 * Used by both ContactEdit and EntityEdit components
 */

// Base input styling
export const baseInputClassName = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"

// Read-only/disabled field styling
export const readOnlyFieldStyle = "bg-gray-50 border-2 border-solid border-gray-300 rounded-lg px-4 py-3 flex items-center min-h-[44px]"

// Auto-populated contact field styling (blue highlight)
export const autoPopulatedContactStyle = "bg-blue-50 border-2 border-solid border-blue-300 rounded-lg px-4 py-3 flex items-center min-h-[44px]"

// Empty field styling
export const emptyFieldStyle = "bg-gray-50 border-2 border-solid border-gray-300 rounded-lg px-4 py-3 flex items-center"

/**
 * Get appropriate styling class for disabled/readonly fields
 */
export const getDisabledFieldClass = (isContactField = false, isCreateMode = false) => {
    if (isCreateMode && isContactField) {
        return autoPopulatedContactStyle
    }
    return readOnlyFieldStyle
}

/**
 * Get appropriate text color for disabled/readonly fields
 */
export const getDisabledTextClass = (isContactField = false, isCreateMode = false) => {
    if (isCreateMode && isContactField) {
        return "text-blue-700 font-medium"
    }
    return "text-gray-800"
}

/**
 * Lock icon SVG for disabled fields
 */
export const LockIcon = ({ className = "h-4 w-4 text-gray-400 mr-2 flex-shrink-0" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
)
