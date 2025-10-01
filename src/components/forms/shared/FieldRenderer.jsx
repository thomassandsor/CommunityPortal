/**
 * Reusable field rendering components
 * Shared between ContactEdit and EntityEdit for consistent UX
 */

import SimpleRichTextEditor from '../SimpleRichTextEditor'
import { 
    baseInputClassName, 
    getDisabledFieldClass, 
    getDisabledTextClass,
    LockIcon 
} from './fieldStyles.jsx'

/**
 * Text input field (single line)
 */
export const TextField = ({ 
    value, 
    onChange, 
    disabled = false, 
    placeholder = '',
    fieldName 
}) => {
    return (
        <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(fieldName, e.target.value)}
            disabled={disabled}
            className={baseInputClassName}
            placeholder={placeholder}
        />
    )
}

/**
 * Email input field with validation
 */
export const EmailField = ({ 
    value, 
    onChange, 
    disabled = false, 
    placeholder = '',
    fieldName 
}) => {
    return (
        <input
            type="email"
            value={value || ''}
            onChange={(e) => onChange(fieldName, e.target.value)}
            disabled={disabled}
            className={baseInputClassName}
            placeholder={placeholder}
        />
    )
}

/**
 * Phone input field
 */
export const PhoneField = ({ 
    value, 
    onChange, 
    disabled = false, 
    placeholder = '',
    fieldName 
}) => {
    return (
        <input
            type="tel"
            value={value || ''}
            onChange={(e) => onChange(fieldName, e.target.value)}
            disabled={disabled}
            className={baseInputClassName}
            placeholder={placeholder}
        />
    )
}

/**
 * Multi-line text area
 */
export const MultiTextField = ({ 
    value, 
    onChange, 
    disabled = false, 
    placeholder = '',
    rows = 3,
    fieldName 
}) => {
    return (
        <textarea
            value={value || ''}
            onChange={(e) => onChange(fieldName, e.target.value)}
            disabled={disabled}
            className={baseInputClassName}
            rows={rows}
            placeholder={placeholder}
        />
    )
}

/**
 * DateTime picker
 */
export const DateTimeField = ({ 
    value, 
    onChange, 
    disabled = false,
    fieldName 
}) => {
    // Convert ISO string to datetime-local format
    const dateValue = value ? new Date(value).toISOString().slice(0, 16) : ''
    
    return (
        <input
            type="datetime-local"
            value={dateValue}
            onChange={(e) => onChange(fieldName, e.target.value)}
            disabled={disabled}
            className={baseInputClassName}
        />
    )
}

/**
 * Boolean checkbox
 */
export const BooleanField = ({ 
    value, 
    onChange, 
    disabled = false,
    label = '',
    fieldName 
}) => {
    return (
        <div className="flex items-center">
            <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(fieldName, e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            {label && (
                <label className="ml-2 text-sm text-gray-600">
                    {label}
                </label>
            )}
        </div>
    )
}

/**
 * Decimal/Money input
 */
export const DecimalField = ({ 
    value, 
    onChange, 
    disabled = false, 
    placeholder = '',
    fieldName 
}) => {
    return (
        <input
            type="number"
            step="0.01"
            value={value || ''}
            onChange={(e) => onChange(fieldName, parseFloat(e.target.value) || 0)}
            disabled={disabled}
            className={baseInputClassName}
            placeholder={placeholder}
        />
    )
}

/**
 * Rich text editor
 */
export const RichTextField = ({ 
    value, 
    onChange, 
    disabled = false, 
    placeholder = '',
    fieldName 
}) => {
    return (
        <SimpleRichTextEditor
            value={value || ''}
            onChange={(content) => onChange(fieldName, content)}
            disabled={disabled}
            placeholder={placeholder}
        />
    )
}

/**
 * Disabled/Read-only field display
 * Used for system fields, auto-populated fields, and view mode
 */
export const DisabledFieldDisplay = ({ 
    value, 
    displayValue = null,
    isContactField = false,
    isCreateMode = false
}) => {
    const finalDisplayValue = displayValue || value || 'Not provided'
    const containerClass = getDisabledFieldClass(isContactField, isCreateMode)
    const textClass = getDisabledTextClass(isContactField, isCreateMode)
    
    return (
        <div className={containerClass}>
            <LockIcon />
            <span className={textClass}>{finalDisplayValue}</span>
        </div>
    )
}

/**
 * Lookup field display (read-only)
 */
export const LookupFieldDisplay = ({ 
    displayValue,
    isAutoPopulated = false
}) => {
    const containerClass = isAutoPopulated 
        ? "flex items-center bg-blue-50 border-2 border-solid border-blue-300 rounded-lg px-4 py-3 min-h-[44px]"
        : "flex items-center bg-gray-50 border-2 border-solid border-gray-300 rounded-lg px-4 py-3 min-h-[44px]"
    
    const textClass = isAutoPopulated 
        ? "text-blue-700 font-medium"
        : "text-gray-800"
    
    const fallbackText = isAutoPopulated 
        ? "Auto-populated with your contact" 
        : "Lookup field (read-only)"
    
    return (
        <div className="relative">
            <div className={containerClass}>
                <LockIcon />
                <span className={textClass}>
                    {displayValue || fallbackText}
                </span>
            </div>
        </div>
    )
}

/**
 * Helper to format datetime for Norwegian locale
 */
export const formatNorwegianDateTime = (dateValue) => {
    if (!dateValue) return ''
    
    try {
        const date = new Date(dateValue)
        return date.toLocaleString('nb-NO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Oslo'
        })
    } catch (error) {
        console.error('Error formatting date:', error)
        return dateValue.toString()
    }
}
