import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import DynamicSidebar from '../../components/shared/DynamicSidebar'
import SimpleRichTextEditor from '../../components/forms/SimpleRichTextEditor'
import SimpleRichTextViewer from '../../components/forms/SimpleRichTextViewer'

function EntityEdit() {
    // Get route parameters for backward compatibility
    const { entityName, entityId: urlEntityId } = useParams()
    const navigate = useNavigate()
    const { user } = useUser()
    const { getToken } = useAuth()
    
    const [entity, setEntity] = useState(null)
    const [entityConfig, setEntityConfig] = useState(null)
    const [formMetadata, setFormMetadata] = useState(null)
    const [formData, setFormData] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [dataInitialized, setDataInitialized] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [showSuccessMessage, setShowSuccessMessage] = useState(false)

    // Determine mode based on sessionStorage and URL
    const [selectedEntity, setSelectedEntity] = useState(null)
    const [entityId, setEntityId] = useState(null)
    const [isCreateMode, setIsCreateMode] = useState(false)
    const [modeInitialized, setModeInitialized] = useState(false)

    // Initialize mode and selected entity
    useEffect(() => {
        // Check if we have a selected entity in sessionStorage
        const storedSelection = sessionStorage.getItem(`selected_${entityName}`)
        
        if (storedSelection) {
            // Edit mode with selected entity
            const selection = JSON.parse(storedSelection)
            setSelectedEntity(selection.data)
            setEntityId(selection.id)
            setIsCreateMode(false)
            console.log('📝 Edit mode - using selected entity:', selection.data)
        } else if (urlEntityId) {
            // Fallback to URL-based entityId for backward compatibility
            setEntityId(urlEntityId)
            setIsCreateMode(false)
            console.log('📝 Edit mode - using URL entityId:', urlEntityId)
        } else {
            // Create mode (no selected entity or URL ID)
            setIsCreateMode(true)
            console.log('🆕 Create mode - no selected entity or URL ID')
        }
        
        setModeInitialized(true)
    }, [entityName, urlEntityId])

    // Single useEffect to fetch data efficiently
    useEffect(() => {
        if (user && entityName && !dataInitialized && modeInitialized) {
            console.log(`🔍 Fetching data for ${entityName}${entityId ? `: ${entityId}` : ' (create mode)'}`)
            
            const promises = [fetchFormMetadata()]
            if (!isCreateMode && entityId) {
                // Always fetch fresh data for edit mode to ensure lookup expansion
                console.log('🔄 Fetching fresh entity data to get lookup expansions')
                promises.push(fetchEntity())
            }
            
            Promise.all(promises).then(([formMetadata, entityData]) => {
                // Initialize form data immediately with both results
                // For edit mode, prefer fresh data but fall back to selectedEntity
                const dataToUse = entityData || selectedEntity
                initializeFormData(dataToUse, formMetadata)
                
                // Set edit mode: create mode = editing, edit mode = view first
                setIsEditing(isCreateMode)
                
                setDataInitialized(true)
                setLoading(false)
            }).catch(error => {
                console.error('Error during data fetching:', error)
                setError(error.message)
                setLoading(false)
            })
        }
    }, [user, entityName, entityId, dataInitialized, isCreateMode, modeInitialized, selectedEntity])

    const fetchEntity = async () => {
        if (!entityId) {
            console.error('No entity ID available for fetching')
            throw new Error('Entity ID required for fetching')
        }
        
        try {
            const token = await getToken()
            const response = await fetch(`/.netlify/functions/generic-entity?entity=${entityName}&id=${entityId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Failed to fetch ${entityName}`)
            }

            const data = await response.json()
            setEntity(data.entity)
            setEntityConfig(data.entityConfig)
            
            console.log(`✅ Loaded ${entityName}:`, data.entity)
            return data.entity

        } catch (err) {
            console.error(`Error fetching ${entityName}:`, err)
            throw err
        }
    }

    const fetchFormMetadata = async () => {
        try {
            const token = await getToken()
            const response = await fetch(`/.netlify/functions/generic-entity?entity=${entityName}&mode=form`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Failed to fetch form metadata for ${entityName}`)
            }

            const data = await response.json()
            setFormMetadata(data.formMetadata)
            setEntityConfig(data.entityConfig)
            
            console.log(`✅ Loaded form metadata for ${entityName}:`, data.formMetadata)
            return data.formMetadata

        } catch (err) {
            console.error(`Error fetching form metadata for ${entityName}:`, err)
            throw err
        }
    }

    const initializeFormData = (entityData, formMetadata) => {
        const initialData = {}
        
        if (entityData) {
            // Edit mode: populate with existing data
            Object.keys(entityData).forEach(key => {
                // Include all fields, even if they're null/undefined (we'll handle display separately)
                initialData[key] = entityData[key]
            })
        } else {
            // Create mode: initialize with default values
            console.log('🆕 Initializing form for create mode')
            if (formMetadata?.structure?.tabs) {
                extractFieldsFromStructure(formMetadata.structure.tabs).forEach(field => {
                    initialData[field.datafieldname] = getDefaultValue(field)
                })
            }
        }

        setFormData(initialData)
    }

    const extractFieldsFromStructure = (tabs) => {
        const allFields = []
        
        tabs.forEach(tab => {
            tab.sections?.forEach(section => {
                section.rows?.forEach(row => {
                    row.cells?.forEach(cell => {
                        cell.controls?.forEach(control => {
                            if (control.type === 'control' && control.datafieldname) {
                                allFields.push(control)
                            }
                        })
                    })
                })
            })
        })
        
        return allFields
    }

    const getDefaultValue = (field) => {
        switch (field.controlType) {
            case 'boolean':
                return false
            case 'datetime':
                return ''
            case 'decimal':
            case 'money':
                return 0
            default:
                return ''
        }
    }

    const handleInputChange = (fieldName, value) => {
        console.log(`📝 Field changed: ${fieldName} =`, value)
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }))
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            
            const token = await getToken()
            const method = isCreateMode ? 'POST' : 'PATCH'
            const url = isCreateMode 
                ? `/.netlify/functions/generic-entity?entity=${entityName}`
                : `/.netlify/functions/generic-entity?entity=${entityName}&id=${entityId}`

            // Prepare data for save (exclude system fields for updates)
            const saveData = { ...formData }
            if (!isCreateMode) {
                // Remove read-only system fields for updates using the correct entity logical name
                const entityIdField = entityConfig?.entityLogicalName ? `${entityConfig.entityLogicalName}id` : `${entityName}id`
                delete saveData[entityIdField]
                delete saveData.createdon
                delete saveData.modifiedon
                delete saveData._createdby_value
                delete saveData._modifiedby_value
                delete saveData.statecode
            }

            console.log(`💾 Saving ${entityName}:`, saveData)
            
            // Debug rich text fields specifically
            Object.entries(saveData).forEach(([key, value]) => {
                if (typeof value === 'string' && value.includes('<')) {
                    console.log(`🔍 Rich text field ${key}:`, value.substring(0, 200))
                    console.log(`🔍 Starts with <p tag?`, value.startsWith('<p'))
                }
            })

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(saveData)
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Failed to save ${entityName}`)
            }

            const result = await response.json()
            console.log(`✅ ${entityName} saved successfully`)

            if (isCreateMode) {
                // Navigate back to list with success message for new records
                navigate(`/entity/${entityName}?success=${encodeURIComponent(`${entityConfig?.name || entityName} created successfully`)}`)
            } else {
                // For edits, stay on page and show success message + exit edit mode
                setIsEditing(false)
                setShowSuccessMessage(true)
                
                // Auto-hide success message after 5 seconds
                setTimeout(() => {
                    setShowSuccessMessage(false)
                }, 5000)
                
                // Refresh the entity data to show updated values
                setDataInitialized(false)
            }

        } catch (err) {
            console.error(`Error saving ${entityName}:`, err)
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleToggleEdit = () => {
        if (error) setError(null)
        if (showSuccessMessage) setShowSuccessMessage(false)
        setIsEditing(!isEditing)
    }

    const handleCancel = () => {
        navigate(`/entity/${entityName}`)
    }

    // Helper function to get safe display name
    const getFieldDisplayName = (field) => {
        const result = typeof field.displayName === 'string' ? field.displayName : field.datafieldname || 'Field'
        return result
    }

    const renderField = (field) => {
        const value = formData[field.datafieldname]
        const entityIdField = entityConfig?.entityLogicalName ? `${entityConfig.entityLogicalName}id` : `${entityName}id`
        const isDisabled = field.disabled || field.datafieldname === entityIdField || field.datafieldname === 'createdon' || field.datafieldname === 'modifiedon'
        
        // In view mode, show read-only display
        if (!isEditing && !isCreateMode) {
            return renderViewField(field, value)
        }

        const baseClassName = "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        const disabledClassName = isDisabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""

        switch (field.controlType) {
            case 'multitext':
                return (
                    <textarea
                        value={value || ''}
                        onChange={(e) => handleInputChange(field.datafieldname, e.target.value)}
                        disabled={isDisabled}
                        className={`${baseClassName} ${disabledClassName}`}
                        rows={3}
                        placeholder={getFieldDisplayName(field)}
                    />
                )

            case 'boolean':
                return (
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => handleInputChange(field.datafieldname, e.target.checked)}
                            disabled={isDisabled}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label className="ml-2 text-sm text-gray-600">
                            {getFieldDisplayName(field)}
                        </label>
                    </div>
                )

            case 'datetime':
                return (
                    <input
                        type="datetime-local"
                        value={value ? new Date(value).toISOString().slice(0, 16) : ''}
                        onChange={(e) => handleInputChange(field.datafieldname, e.target.value)}
                        disabled={isDisabled}
                        className={`${baseClassName} ${disabledClassName}`}
                    />
                )

            case 'email':
                return (
                    <input
                        type="email"
                        value={value || ''}
                        onChange={(e) => handleInputChange(field.datafieldname, e.target.value)}
                        disabled={isDisabled}
                        className={`${baseClassName} ${disabledClassName}`}
                        placeholder={getFieldDisplayName(field)}
                    />
                )

            case 'phone':
                return (
                    <input
                        type="tel"
                        value={value || ''}
                        onChange={(e) => handleInputChange(field.datafieldname, e.target.value)}
                        disabled={isDisabled}
                        className={`${baseClassName} ${disabledClassName}`}
                        placeholder={getFieldDisplayName(field)}
                    />
                )

            case 'decimal':
            case 'money':
                return (
                    <input
                        type="number"
                        step="0.01"
                        value={value || ''}
                        onChange={(e) => handleInputChange(field.datafieldname, parseFloat(e.target.value) || 0)}
                        disabled={isDisabled}
                        className={`${baseClassName} ${disabledClassName}`}
                        placeholder={getFieldDisplayName(field)}
                    />
                )

            case 'lookup':
                return (
                    <div className="relative">
                        <input
                            type="text"
                            value={getLookupDisplayValue(field.datafieldname, value, formData)}
                            disabled={true}
                            className={`${baseClassName} bg-gray-50 text-gray-500 cursor-not-allowed`}
                            placeholder="Lookup field (read-only)"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                )

            case 'richtext':
                return (
                    <div>
                        <SimpleRichTextEditor
                            value={value || ''}
                            onChange={(content) => handleInputChange(field.datafieldname, content)}
                            disabled={isDisabled}
                            label={getFieldDisplayName(field)}
                            placeholder={`Enter ${getFieldDisplayName(field).toLowerCase()}...`}
                        />
                    </div>
                )

            default:
                return (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => handleInputChange(field.datafieldname, e.target.value)}
                        disabled={isDisabled}
                        className={`${baseClassName} ${disabledClassName}`}
                        placeholder={getFieldDisplayName(field)}
                    />
                )
        }
    }

    // Render field in view mode (read-only display)
    const renderViewField = (field, value) => {
        if (value === null || value === undefined || value === '') {
            return <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">Not provided</p>
        }

        switch (field.controlType) {
            case 'datetime':
                return (
                    <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">
                        {new Date(value).toLocaleString()}
                    </p>
                )
            case 'boolean':
                return (
                    <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">
                        {value ? 'Yes' : 'No'}
                    </p>
                )
            case 'email':
                return (
                    <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">
                        <a href={`mailto:${value}`} className="text-blue-600 hover:text-blue-800">{value}</a>
                    </p>
                )
            case 'phone':
                return (
                    <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">
                        <a href={`tel:${value}`} className="text-blue-600 hover:text-blue-800">{value}</a>
                    </p>
                )
            case 'lookup':
                return (
                    <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">
                        {getLookupDisplayValue(field.datafieldname, value, formData)}
                    </p>
                )
            case 'richtext':
                return (
                    <div>
                        <SimpleRichTextViewer
                            content={value}
                            label={getFieldDisplayName(field)}
                            emptyMessage="No content provided"
                        />
                    </div>
                )
            default:
                return (
                    <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md border">
                        {String(value)}
                    </p>
                )
        }
    }

    // Helper function to get display value for lookup fields
    const getLookupDisplayValue = (fieldName, value, entityData) => {
        if (!value || !entityData) {
            return 'Not provided'
        }
        
        // Map field names to their navigation property names
        const navigationPropertyMap = {
            '_cp_contact_value': 'cp_Contact',
            '_createdby_value': 'createdby',
            '_modifiedby_value': 'modifiedby',
            '_parentcustomerid_value': 'parentcustomerid'
        }
        
        // Check if we have expanded data for this lookup field using navigation property
        const navProperty = navigationPropertyMap[fieldName]
        
        if (navProperty && entityData[navProperty]) {
            const expandedData = entityData[navProperty]
            
            if (expandedData.fullname) {
                return expandedData.fullname
            } else if (expandedData.name) {
                return expandedData.name
            } else if (expandedData.firstname && expandedData.lastname) {
                const fullName = `${expandedData.firstname} ${expandedData.lastname}`
                return fullName
            }
        }
        
        // Fallback: check for formatted value (Dataverse sometimes provides this)
        const formattedValueKey = `${fieldName}@OData.Community.Display.V1.FormattedValue`
        if (entityData[formattedValueKey]) {
            return entityData[formattedValueKey]
        }
        
        // Last resort: show truncated GUID with indicator
        if (typeof value === 'string' && value.length > 8) {
            const truncated = `${value.substring(0, 8)}... (ID)`
            return truncated
        }
        
        return value || 'Not provided'
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <div className="mt-4 text-lg text-gray-600">
                        Loading {isCreateMode ? 'form' : entityName}...
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <DynamicSidebar />

            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-white shadow-sm border-b px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">
                                {isCreateMode ? `Create ${entityConfig?.name || entityName}` : 
                                 isEditing ? `Edit ${entityConfig?.name || entityName}` : 
                                 `${entityConfig?.name || entityName} Details`}
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                {isCreateMode ? 'Create a new record' : 
                                 isEditing ? 'Modify the existing record' : 
                                 'View record details'}
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            {!isCreateMode && !isEditing && (
                                <button
                                    onClick={handleToggleEdit}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                >
                                    Edit {entityConfig?.name || entityName}
                                </button>
                            )}
                            {(isCreateMode || isEditing) && (
                                <>
                                    {!isCreateMode && (
                                        <button
                                            onClick={handleToggleEdit}
                                            disabled={saving}
                                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {saving ? 'Saving...' : (isCreateMode ? 'Create' : 'Save')}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleCancel}
                                disabled={saving}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                                Back to List
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 p-6">
                    <div className="max-w-4xl mx-auto">
                        {/* Error State */}
                        {error && (
                            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                                        <div className="mt-2 text-sm text-red-700">{error}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Success State */}
                        {showSuccessMessage && (
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                                <div className="flex items-center">
                                    <svg className="h-5 w-5 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="text-green-800">
                                        <strong>Success!</strong> {entityConfig?.name || entityName} updated successfully.
                                    </div>
                                    <button
                                        onClick={() => setShowSuccessMessage(false)}
                                        className="ml-auto text-green-600 hover:text-green-800 transition-colors"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Form Content */}
                        {formMetadata?.structure?.tabs && formMetadata.structure.tabs.length > 0 ? (
                            <div className="bg-white shadow rounded-lg">
                                <div className="divide-y divide-gray-200">
                                    {formMetadata.structure.tabs.map((tab, tabIndex) => {
                                        return (
                                        <div key={tab.name} className="p-6 space-y-8">
                                            {/* Tab Header */}
                                            <div className="border-b-2 border-gray-200 pb-4">
                                                <h2 className="text-lg font-medium text-gray-900">
                                                    {(typeof tab.displayName === 'string' && tab.displayName.trim() !== '' && tab.displayName !== 'true' && tab.displayName !== 'false') ? tab.displayName : (tab.name || 'Form Section')}
                                                </h2>
                                            </div>

                                            {/* Tab Content - Mixed layout accommodating rich text fields */}
                                            <div className="space-y-6">
                                                {tab.sections?.map(section => {
                                                    // Collect all fields for this section
                                                    const allFields = []
                                                    section.rows?.forEach(row => {
                                                        row.cells?.forEach(cell => {
                                                            cell.controls?.filter(control => control.type === 'control' && control.datafieldname)
                                                                .forEach(field => {
                                                                    // Fix lookup field control types
                                                                    if (field.datafieldname && field.datafieldname.endsWith('_value')) {
                                                                        field.controlType = 'lookup'
                                                                    }
                                                                    
                                                                    // CRITICAL FIX: Handle incorrectly configured contact fields
                                                                    if (field.datafieldname === 'cp_contact') {
                                                                        field.datafieldname = '_cp_contact_value'
                                                                        field.controlType = 'lookup'
                                                                        field.displayName = field.displayName || 'Contact'
                                                                    }
                                                                    
                                                                    allFields.push(field)
                                                                })
                                                        })
                                                    })
                                                    
                                                    // Separate rich text from regular fields
                                                    const richTextFields = allFields.filter(field => 
                                                        field.controlType === 'richtext' || field.isRichText
                                                    )
                                                    const regularFields = allFields.filter(field => 
                                                        field.controlType !== 'richtext' && !field.isRichText
                                                    )
                                                    
                                                    // Check if section should be visible based on configuration
                                                    const shouldShowSection = (
                                                        section.visible !== false && 
                                                        section.hidden !== true
                                                    )
                                                    
                                                    // Get safe display name for section header
                                                    const getSectionDisplayName = (section) => {
                                                        // Check for valid displayName
                                                        if (section.displayName && typeof section.displayName === 'string' && 
                                                            section.displayName.trim() !== '' && 
                                                            section.displayName !== 'true' && 
                                                            section.displayName !== 'false') {
                                                            return section.displayName
                                                        }
                                                        
                                                        // Fallback to section name
                                                        return section.name || 'Section'
                                                    }
                                                    
                                                    // Check if section header should be shown based on hideLabel property
                                                    const shouldShowSectionHeader = (
                                                        section.showLabel !== false && 
                                                        section.hideLabel !== true &&
                                                        section.displayName !== 'false'  // Handle Dataverse 'false' string
                                                    )
                                                    
                                                    // Only render section if it should be visible
                                                    if (!shouldShowSection) {
                                                        return null
                                                    }
                                                    
                                                    return (
                                                        <div key={section.name}>
                                                            {/* Section Header - Show based on label visibility configuration */}
                                                            {shouldShowSectionHeader && (
                                                                <h4 className="text-lg font-medium text-gray-900 mb-4">
                                                                    {getSectionDisplayName(section)}
                                                                </h4>
                                                            )}
                                                            
                                                            {/* Regular fields in 2-column grid */}
                                                            {regularFields.length > 0 && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                    {regularFields.map(field => (
                                                                        <div key={field.datafieldname} className="space-y-2">
                                                                            <label className="block text-sm font-medium text-gray-700">
                                                                                {getFieldDisplayName(field)}
                                                                                {field.disabled && <span className="text-gray-400 ml-1">(read-only)</span>}
                                                                            </label>
                                                                            {renderField(field)}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            
                                                            {/* Rich text fields full width */}
                                                            {richTextFields.length > 0 && (
                                                                <div className="space-y-6">
                                                                    {richTextFields.map(field => (
                                                                        <div key={field.datafieldname} className="space-y-2">
                                                                            {renderField(field)}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                }).filter(Boolean) // Remove null entries for hidden sections
                                                }
                                            </div>
                                        </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            /* No Fallback: Require proper form configuration */
                            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">
                                            Form Configuration Required
                                        </h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            <p>
                                                No form metadata is configured for entity <strong>"{entityName}"</strong>. 
                                                This entity requires proper form structure configuration in Dataverse.
                                            </p>
                                            <div className="mt-4 space-y-2">
                                                <p className="font-medium">Required steps:</p>
                                                <ol className="list-decimal list-inside space-y-1 ml-4">
                                                    <li>Create form metadata in cp_entityconfigurations table</li>
                                                    <li>Define tabs, sections, and field structure</li>
                                                    <li>Configure field types and display properties</li>
                                                </ol>
                                            </div>
                                            <div className="mt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(-1)}
                                                    className="bg-red-100 text-red-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                                                >
                                                    Go Back
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Debug Info */}
                        {entityConfig && (
                            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-blue-800">Entity Information</h3>
                                        <div className="mt-2 text-sm text-blue-700 space-y-1">
                                            <p><strong>Entity:</strong> {entityConfig.entityLogicalName}</p>
                                            <p><strong>Mode:</strong> {isCreateMode ? 'Create' : 'Edit'}</p>
                                            <p><strong>Form:</strong> {formMetadata?.name || 'Not configured'}</p>
                                            <p><strong>Fields:</strong> {Object.keys(formData).length}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}

export default EntityEdit
