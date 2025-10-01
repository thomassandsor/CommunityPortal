import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { useContactContext } from '../../contexts/ContactContext.jsx'
import DynamicSidebar from '../../components/shared/DynamicSidebar'
import SimpleRichTextViewer from '../../components/forms/SimpleRichTextViewer'
import { 
    TextField, 
    EmailField, 
    PhoneField, 
    MultiTextField, 
    DateTimeField, 
    BooleanField, 
    DecimalField, 
    RichTextField,
    DisabledFieldDisplay,
    LookupFieldDisplay,
    formatNorwegianDateTime
} from '../../components/forms/shared/FieldRenderer'

function EntityEdit() {
    // Get route parameters and location for mode detection
    const { entityName, entityId: urlEntityId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useUser()
    const { getToken } = useAuth()
    
    // SECURITY: Get current user's contact from secure context (no sessionStorage)
    const { contact: userContact, getContactGuid, getAccountGuid, getDisplayName } = useContactContext()
    
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
        // Detect create mode from URL path
        const isCreatePath = location.pathname.includes('/create')
        
        if (isCreatePath) {
            // Explicit create mode from URL
            setIsCreateMode(true)
            setEntityId(null)
            setSelectedEntity(null)
            console.log('🆕 Create mode - detected from URL path:', location.pathname)
        } else {
            // Edit mode - check for selected entity in sessionStorage
            const storedSelection = sessionStorage.getItem(`selected_${entityName}`)
            
            if (storedSelection) {
                // Edit mode with selected entity
                const selection = JSON.parse(storedSelection)
                setSelectedEntity(selection.data)
                setEntityId(selection.id)
                setIsCreateMode(false)
                console.log('📝 Edit mode - using selected entity:', selection.data)
            } else if (urlEntityId) {
                // URL-based entityId for direct links
                setEntityId(urlEntityId)
                setIsCreateMode(false)
                console.log('📝 Edit mode - using URL entityId:', urlEntityId)
            } else {
                // Default to create mode when no entity context is available
                setIsCreateMode(true)
                console.log('🆕 Create mode - no entity context available')
            }
        }
        
        setModeInitialized(true)
    }, [entityName, urlEntityId, location.pathname])

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
            
            Promise.all(promises).then(([formResult, entityData]) => {
                // formResult contains both formMetadata and entityConfig
                const formMetadata = formResult.formMetadata
                const formEntityConfig = formResult.entityConfig
                
                // Initialize form data immediately with both results
                // For edit mode, prefer fresh data or use cached selectedEntity
                const dataToUse = entityData || selectedEntity
                
                // CRITICAL: Pass entityConfig to initializeFormData
                initializeFormData(dataToUse, formMetadata, formEntityConfig)
                
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

    // CRITICAL: Re-initialize form data when user contact becomes available in context
    useEffect(() => {
        const currentContactGuid = getContactGuid()
        const currentContact = userContact
        
        if (currentContactGuid && isCreateMode && dataInitialized && formMetadata && entityConfig) {
            console.log('🚨 STORED USER CONTACT AVAILABLE - Re-initializing form data')
            console.log('🚨 Stored contact GUID:', currentContactGuid)
            console.log('🚨 Entity config available:', {
                hasConfig: !!entityConfig,
                contactRelationField: entityConfig?.contactRelationField || entityConfig?.cp_contactrelationfield
            })
            
            // Re-initialize form data with the stored contact
            setFormData(prev => {
                const updated = { ...prev }
                
                // Find contact fields and populate them
                if (formMetadata?.structure?.tabs) {
                    const fields = extractFieldsFromStructure(formMetadata.structure.tabs)
                    const contactRelationField = entityConfig?.contactRelationField || entityConfig?.cp_contactrelationfield
                    
                    fields.forEach(field => {
                        if (isContactField(field.datafieldname, entityConfig)) {
                            console.log(`🚨 Processing contact field: ${field.datafieldname}`)
                            
                            // Use the same logic as initializeFormData
                            if (field.datafieldname === contactRelationField) {
                                // Form shows "cp_contact" but we need to populate "_cp_contact_value"
                                const lookupFieldName = `_${contactRelationField}_value`
                                updated[lookupFieldName] = currentContactGuid
                                console.log(`🚨 RE-POPULATED contact lookup field: ${lookupFieldName} = ${currentContactGuid}`)
                            } else if (field.datafieldname.endsWith('_value')) {
                                // Already in lookup format
                                updated[field.datafieldname] = currentContactGuid
                                console.log(`🚨 RE-POPULATED lookup field: ${field.datafieldname} = ${currentContactGuid}`)
                            } else {
                                // Other contact-related fields
                                updated[field.datafieldname] = currentContactGuid
                                console.log(`🚨 RE-POPULATED contact field: ${field.datafieldname} = ${currentContactGuid}`)
                            }
                        }
                    })
                }
                
                console.log('🚨 Updated form data with stored contact:', updated)
                return updated
            })
        }
    }, [isCreateMode, dataInitialized, formMetadata, entityConfig]) // Added entityConfig dependency

    const fetchEntity = async () => {
        if (!entityId) {
            console.error('No entity ID available for fetching')
            throw new Error('Entity ID required for fetching')
        }
        
        try {
            const token = await getToken()
            
            // SECURITY: Get Contact GUID from secure context for data access
            const contactGuid = getContactGuid()
            if (!contactGuid) {
                throw new Error('Contact GUID required for secure data access')
            }
            
            const response = await fetch(`/.netlify/functions/generic-entity?entity=${entityName}&id=${entityId}&contactGuid=${encodeURIComponent(contactGuid)}`, {
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
            
            // SECURITY: Get Contact GUID from secure context for data access
            const contactGuid = getContactGuid()
            if (!contactGuid) {
                throw new Error('Contact GUID required for secure data access')
            }
            
            const response = await fetch(`/.netlify/functions/generic-entity?entity=${entityName}&mode=form&contactGuid=${encodeURIComponent(contactGuid)}`, {
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
            console.log(`✅ Loaded entity config for ${entityName}:`, data.entityConfig)
            
            // Return BOTH so they can be used together before state updates
            return {
                formMetadata: data.formMetadata,
                entityConfig: data.entityConfig
            }

        } catch (err) {
            console.error(`Error fetching form metadata for ${entityName}:`, err)
            throw err
        }
    }

    const initializeFormData = (entityData, formMetadata, passedEntityConfig = null) => {
        const initialData = {}
        
        // Use passed entityConfig if available, otherwise fall back to state
        const configToUse = passedEntityConfig || entityConfig
        
        console.log('🎯 initializeFormData called with config:', {
            hasPassedConfig: !!passedEntityConfig,
            hasStateConfig: !!entityConfig,
            contactRelationField: configToUse?.contactRelationField || configToUse?.cp_contactrelationfield
        })
        
        if (entityData) {
            // Edit mode: populate with existing data
            Object.keys(entityData).forEach(key => {
                // Include all fields, even if they're null/undefined (we'll handle display separately)
                initialData[key] = entityData[key]
            })
        } else {
            // Create mode: initialize with default values and auto-populate contact fields
            console.log('🆕 Initializing form for create mode')
            console.log('🆕 User contact available:', userContact ? 'YES' : 'NO', userContact)
            console.log('🆕 🚨 CRITICAL DEBUG - Stored contact details:')
            const storedContact = userContact
            const storedGuid = getContactGuid()
            console.log('🆕 🚨 storedContact object:', JSON.stringify(storedContact, null, 2))
            console.log('🆕 🚨 storedContact GUID:', storedGuid)
            console.log('🆕 🚨 typeof storedContact GUID:', typeof storedGuid)
            
            if (formMetadata?.structure?.tabs) {
                const fields = extractFieldsFromStructure(formMetadata.structure.tabs)
                console.log('🆕 Extracted fields:', fields.map(f => f.datafieldname))
                
                fields.forEach(field => {
                    const fieldName = field.datafieldname
                    console.log(`🔍 Processing field: ${fieldName} (type: ${field.controlType})`)
                    
                    // Skip system fields that users can't edit
                    if (isSystemField(fieldName)) {
                        console.log(`⚠️ Skipping system field: ${fieldName}`)
                        return
                    }
                    
                    // Auto-populate contact fields with current user's contact
                    const currentContactGuid = getContactGuid()
                    const currentContact = userContact
                    
                    if (isContactField(fieldName, configToUse) && currentContactGuid) {
                        // Use the original field name - conversion will happen during rendering
                        // Dynamic contact field handling using entity configuration
                        const contactRelationField = configToUse?.contactRelationField || configToUse?.cp_contactrelationfield
                        
                        console.log(`🎯 CONTACT FIELD DETECTED in initializeFormData:`, {
                            fieldName,
                            contactRelationField,
                            currentContactGuid
                        })
                        
                        // CRITICAL FIX: Handle both form field name (cp_contact) and lookup field name (_cp_contact_value)
                        if (fieldName === contactRelationField) {
                            // Form shows "cp_contact" but we need to populate "_cp_contact_value"
                            const lookupFieldName = `_${contactRelationField}_value`
                            initialData[lookupFieldName] = currentContactGuid
                            console.log(`👤 🚨 AUTO-POPULATED contact lookup field: ${lookupFieldName} = ${currentContactGuid}`)
                        } else if (fieldName.endsWith('_value')) {
                            // Already in lookup format
                            initialData[fieldName] = currentContactGuid
                            console.log(`👤 Auto-populated contact lookup field ${fieldName} with stored GUID: ${currentContactGuid}`)
                        } else {
                            // Other contact-related fields
                            initialData[fieldName] = currentContactGuid
                            console.log(`👤 Auto-populated contact field ${fieldName} with stored GUID: ${currentContactGuid}`)
                        }
                        console.log(`👤 Contact GUID type: ${typeof currentContactGuid}`)
                        console.log(`👤 Contact info from storage:`, { 
                            contactid: currentContact?.contactid, 
                            fullname: currentContact?.fullname,
                            email: currentContact?.emailaddress1 
                        })
                        
                        // CRITICAL: Return early to prevent setting default value
                        return
                    } else {
                        // Use default value for other fields
                        const defaultValue = getDefaultValue(field)
                        initialData[fieldName] = defaultValue
                        console.log(`📝 Set default value for ${fieldName}: ${defaultValue}`)
                    }
                })
                
                console.log('🆕 Final initialized form data:', initialData)
                console.log('🆕 Form data keys:', Object.keys(initialData))
                console.log('🆕 Has _cp_contact_value?', '_cp_contact_value' in initialData)
                console.log('🆕 _cp_contact_value value:', initialData['_cp_contact_value'])
            } else {
                console.log('⚠️ No form metadata structure available')
            }
        }

        setFormData(initialData)
        console.log('🆕 setFormData called with:', initialData)
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

    // Helper function to identify system fields that users cannot edit
    const isSystemField = (fieldName) => {
        const systemFields = [
            'createdon',
            'modifiedon', 
            '_createdby_value',
            '_modifiedby_value',
            '_ownerid_value', // Owner is typically managed by system
            'statecode',
            'statuscode',
            'versionnumber',
            'timezoneruleversionnumber',
            'utcconversiontimezonecode',
            'importsequencenumber',
            'overriddencreatedon',
            'fullname',  // Computed field (firstname + lastname)
            'yominame',  // Computed field (phonetic name)
        ]
        
        // Also check for entity-specific ID fields (dynamic based on entity name)
        const entityIdPattern = new RegExp(`^${entityName}id$`, 'i')
        const entityConfigIdPattern = entityConfig?.entityLogicalName ? 
            new RegExp(`^${entityConfig.entityLogicalName}id$`, 'i') : null
        
        return systemFields.includes(fieldName.toLowerCase()) ||
               entityIdPattern.test(fieldName) ||
               (entityConfigIdPattern && entityConfigIdPattern.test(fieldName))
    }

    // Helper function to identify contact lookup fields (dynamic based on entity config)
    const isContactField = (fieldName, configOverride = null) => {
        // Use the configured contact relation field from entity config
        // Try both camelCase and underscore versions for backward compatibility
        const config = configOverride || entityConfig
        const configuredContactField = config?.contactRelationField || config?.cp_contactrelationfield
        
        const contactFieldPatterns = [
            '_contactid_value',     // Standard Dataverse contact lookup
            'contactid'             // Standard contact ID field
        ]
        
        // Add the configured contact field and its lookup variant if available
        if (configuredContactField) {
            contactFieldPatterns.push(configuredContactField)
            contactFieldPatterns.push(`_${configuredContactField}_value`)
        }
        
        const isMatch = contactFieldPatterns.some(pattern => 
            fieldName.toLowerCase() === pattern.toLowerCase()
        )
        
        if (isMatch) {
            console.log(`🔍 Detected contact field: ${fieldName} (configured: ${configuredContactField})`)
        }
        
        return isMatch
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

            // Prepare data for save - filter out system fields dynamically
            console.log(`🔍 Full form data before filtering:`, formData)
            const saveData = {}
            Object.entries(formData).forEach(([key, value]) => {
                // Skip navigation property objects (e.g., cp_Contact, cp_Organization)
                // These are read-only expanded entities from Dataverse
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Check if it's a navigation property (has contactid, accountid, etc.)
                    if (value.contactid || value.accountid || value.organizationid) {
                        console.log(`⚠️ SKIPPING navigation property object: ${key}`)
                        return
                    }
                }
                
                if (!isSystemField(key)) {
                    // Handle contact fields - only include the proper _value fields
                    if (isContactField(key)) {
                        // Skip the original form field name, only send the lookup _value field
                        const configuredContactField = entityConfig?.cp_contactrelationfield
                        if (key === configuredContactField) {
                            console.log(`⚠️ SKIPPING form field name: ${key} (not a Dataverse field)`)
                            return
                        }
                        
                        // Only include _value lookup fields if they have values
                        if (key.endsWith('_value') && value && value !== '' && value !== null && value !== undefined) {
                            console.log(`✅ Including lookup contact field: ${key} = ${value}`)
                            saveData[key] = value
                        } else if (key.endsWith('_value')) {
                            console.log(`⚠️ Skipping empty lookup contact field: ${key}`)
                        } else {
                            console.log(`⚠️ Skipping non-lookup contact field: ${key}`)
                        }
                        return
                    }
                    
                    // Handle other lookup fields - skip if empty
                    if (key.endsWith('_value') && (value === '' || value === null || value === undefined)) {
                        console.log(`⚠️ Skipping empty lookup field: ${key}`)
                        return
                    }
                    
                    saveData[key] = value
                }
            })
            
            console.log(`📝 Filtered save data (removed ${Object.keys(formData).length - Object.keys(saveData).length} system fields):`, Object.keys(saveData))

            console.log(`💾 Saving ${entityName}:`, saveData)
            
            // Debug contact field specifically
            Object.entries(saveData).forEach(([key, value]) => {
                if (key.includes('contact')) {
                    console.log(`🔍 Contact field debug: ${key} = ${value} (type: ${typeof value})`)
                }
            })
            
            // Debug rich text fields specifically
            Object.entries(saveData).forEach(([key, value]) => {
                if (typeof value === 'string' && value.includes('<')) {
                    console.log(`🔍 Rich text field ${key}:`, value.substring(0, 200))
                    console.log(`🔍 Starts with <p tag?`, value.startsWith('<p'))
                }
            })

            // SECURITY: Get Contact GUID from secure context for save operation
            const contactGuid = getContactGuid()
            if (!contactGuid) {
                throw new Error('Contact GUID required for secure save operation')
            }
            
            // Add Contact GUID to save data for server-side verification
            const secureData = {
                ...saveData,
                contactGuid: contactGuid
            }

            // Log the complete request details
            const requestBody = JSON.stringify(secureData)
            console.log(`📡 ${method} Request Details:`)
            console.log(`📡 URL: ${url}`)
            console.log(`📡 Headers:`, {
                'Authorization': `Bearer ${token ? '[TOKEN_PRESENT]' : '[NO_TOKEN]'}`,
                'Content-Type': 'application/json'
            })
            console.log(`📡 Body (${requestBody.length} chars):`, requestBody)
            console.log(`📡 Parsed Body:`, secureData)
            console.log(`🛡️ Contact GUID included: ${contactGuid}`)

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: requestBody
            })

            // Log response details
            console.log(`📥 Response Status: ${response.status} ${response.statusText}`)
            console.log(`📥 Response Headers:`, Object.fromEntries([...response.headers]))

            if (!response.ok) {
                const errorText = await response.text()
                console.log(`❌ Error Response Body:`, errorText)
                
                let errorData = {}
                try {
                    errorData = JSON.parse(errorText)
                } catch (e) {
                    console.log(`❌ Could not parse error as JSON:`, e.message)
                    errorData = { error: errorText || `HTTP ${response.status}` }
                }
                
                throw new Error(errorData.error || errorText || `Failed to save ${entityName}`)
            }

            const result = await response.json()
            console.log(`✅ ${entityName} saved successfully:`, result)

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
        const fieldName = field.datafieldname
        
        // Hide system fields in create mode
        if (isCreateMode && isSystemField(fieldName)) {
            return null
        }
        
        // Determine if field should be disabled
        const isSystemFieldDisabled = isSystemField(fieldName)
        const isContactFieldReadOnly = isContactField(fieldName) && (isCreateMode || !isEditing)
        const isDisabled = field.disabled || isSystemFieldDisabled || isContactFieldReadOnly
        
        // In view mode, show read-only display
        if (!isEditing && !isCreateMode) {
            return renderViewField(field, value)
        }
        
        // For disabled fields, use shared DisabledFieldDisplay component
        if (isDisabled) {
            let displayValue = value || 'Not provided'
            
            // Format datetime fields with Norwegian locale
            if (field.controlType === 'datetime' && value) {
                displayValue = formatNorwegianDateTime(value)
            }
            
            // Special handling for contact lookup fields in create mode
            if (isCreateMode && isContactField(fieldName) && userContact) {
                displayValue = userContact.fullname || 
                             `${userContact.firstname} ${userContact.lastname}` || 
                             userContact.emailaddress1 || 
                             'Your Contact'
                console.log('🎨 RENDERING contact field with user name:', displayValue)
            }
            
            return (
                <DisabledFieldDisplay
                    value={value}
                    displayValue={displayValue}
                    isContactField={isContactField(fieldName)}
                    isCreateMode={isCreateMode}
                />
            )
        }

        // Editable fields - use shared field components
        const placeholder = getFieldDisplayName(field)
        
        switch (field.controlType) {
            case 'multitext':
                return (
                    <MultiTextField
                        value={value}
                        onChange={handleInputChange}
                        disabled={isDisabled}
                        placeholder={placeholder}
                        rows={3}
                        fieldName={fieldName}
                    />
                )

            case 'boolean':
                return (
                    <BooleanField
                        value={value}
                        onChange={handleInputChange}
                        disabled={isDisabled}
                        label={placeholder}
                        fieldName={fieldName}
                    />
                )

            case 'datetime':
                return (
                    <DateTimeField
                        value={value}
                        onChange={handleInputChange}
                        disabled={isDisabled}
                        fieldName={fieldName}
                    />
                )

            case 'email':
                return (
                    <EmailField
                        value={value}
                        onChange={handleInputChange}
                        disabled={isDisabled}
                        placeholder={placeholder}
                        fieldName={fieldName}
                    />
                )

            case 'phone':
                return (
                    <PhoneField
                        value={value}
                        onChange={handleInputChange}
                        disabled={isDisabled}
                        placeholder={placeholder}
                        fieldName={fieldName}
                    />
                )

            case 'decimal':
            case 'money':
                return (
                    <DecimalField
                        value={value}
                        onChange={handleInputChange}
                        disabled={isDisabled}
                        placeholder={placeholder}
                        fieldName={fieldName}
                    />
                )

            case 'lookup':
                // CRITICAL FIX: Determine the actual lookup field name to check for data
                // Form might show "cp_contact" but data is stored as "_cp_contact_value"
                const contactRelationField = entityConfig?.contactRelationField || entityConfig?.cp_contactrelationfield
                let actualLookupFieldName = field.datafieldname
                
                // If this is the contact relation field without _value suffix, add it
                if (contactRelationField && field.datafieldname === contactRelationField) {
                    actualLookupFieldName = `_${contactRelationField}_value`
                    console.log(`🔧 LOOKUP FIELD MAPPING: ${field.datafieldname} → ${actualLookupFieldName}`)
                }
                
                // Get the value from the actual lookup field name
                const actualLookupValue = formData[actualLookupFieldName] || value
                const lookupDisplayValue = getLookupDisplayValue(actualLookupFieldName, actualLookupValue, formData)
                const isAutoPopulatedContact = isContactField(actualLookupFieldName) && isCreateMode && getContactGuid()
                
                console.log(`🔍 LOOKUP RENDER DEBUG:`, {
                    formFieldName: field.datafieldname,
                    actualLookupFieldName,
                    actualLookupValue,
                    lookupDisplayValue,
                    isAutoPopulatedContact
                })
                
                return (
                    <LookupFieldDisplay
                        displayValue={lookupDisplayValue}
                        isAutoPopulated={isAutoPopulatedContact}
                    />
                )

            case 'richtext':
                return (
                    <RichTextField
                        value={value}
                        onChange={handleInputChange}
                        disabled={isDisabled}
                        placeholder={`Enter ${placeholder.toLowerCase()}...`}
                        fieldName={fieldName}
                    />
                )

            default:
                return (
                    <TextField
                        value={value}
                        onChange={handleInputChange}
                        disabled={isDisabled}
                        placeholder={placeholder}
                        fieldName={fieldName}
                    />
                )
        }
    }

    // Render field in view mode (read-only display)
    const renderViewField = (field, value) => {
        // Special handling for rich text fields - they need their own null display
        if (field.controlType === 'richtext') {
            return (
                <SimpleRichTextViewer
                    content={value || ''}
                    emptyMessage="No content provided"
                />
            )
        }
        
        // Empty value display using shared component
        if (value === null || value === undefined || value === '') {
            return <DisabledFieldDisplay value={null} />
        }

        // Format values for special field types
        let displayValue = value
        
        switch (field.controlType) {
            case 'datetime':
                displayValue = formatNorwegianDateTime(value)
                break
            case 'boolean':
                displayValue = value ? 'Yes' : 'No'
                break
            case 'email':
                return (
                    <DisabledFieldDisplay 
                        value={value}
                        displayValue={
                            <a href={`mailto:${value}`} className="text-blue-600 hover:text-blue-800 font-medium">{value}</a>
                        }
                    />
                )
            case 'phone':
                return (
                    <DisabledFieldDisplay 
                        value={value}
                        displayValue={
                            <a href={`tel:${value}`} className="text-blue-600 hover:text-blue-800 font-medium">{value}</a>
                        }
                    />
                )
            case 'lookup':
                displayValue = getLookupDisplayValue(field.datafieldname, value, formData)
                break
            default:
                displayValue = String(value)
        }

        return <DisabledFieldDisplay value={value} displayValue={displayValue} />
    }

    // Helper function to get display value for lookup fields
    const getLookupDisplayValue = (fieldName, value, entityData) => {
        console.log('🔍 FRONTEND LOOKUP DEBUG:', {
            fieldName,
            value,
            hasEntityData: !!entityData,
            entityKeys: entityData ? Object.keys(entityData) : [],
            configuredContactField: entityConfig?.cp_contactrelationfield,
            isCreateMode,
            hasUserContact: !!userContact
        })

        // Special handling for auto-populated contact fields in create mode
        const isContactLookup = isContactField(fieldName)
        console.log('🔍 FRONTEND: Is contact field?', isContactLookup, 'for field:', fieldName)
        
        if (isCreateMode && isContactLookup) {
            const currentContact = userContact
            console.log('🔍 FRONTEND: Contact data:', currentContact)
            
            if (currentContact) {
                const displayName = currentContact.fullname || 
                                  `${currentContact.firstname} ${currentContact.lastname}` || 
                                  currentContact.emailaddress1 || 
                                  'Your Contact'
                console.log('✅ FRONTEND: Returning user contact name:', displayName)
                return displayName
            } else {
                console.log('⚠️ FRONTEND: No user contact available in context')
            }
        }
        
        // Dynamic contact field override using entity configuration
        const configuredContactField = entityConfig?.cp_contactrelationfield || entityConfig?.contactRelationField
        // Derive navigation property: cp_contact -> cp_Contact
        const configuredContactNavProperty = configuredContactField ? 
            configuredContactField.replace(/^cp_([a-z])/, (match, letter) => `cp_${letter.toUpperCase()}`) : null
        
        console.log('🔍 FRONTEND: Contact field mapping:', {
            configuredContactField,
            configuredContactNavProperty,
            fieldName,
            lookingForNavProp: configuredContactNavProperty,
            hasNavPropData: !!(configuredContactNavProperty && entityData?.[configuredContactNavProperty])
        })
        
        // Try the configured contact navigation property first
        if (configuredContactField && fieldName === `_${configuredContactField}_value` && 
            configuredContactNavProperty && entityData?.[configuredContactNavProperty]) {
            const contactData = entityData[configuredContactNavProperty]
            console.log('🎯 FRONTEND: Using dynamic contact lookup:', contactData)
            if (contactData.fullname) {
                return contactData.fullname
            }
        }
        
        if (!value || !entityData) {
            console.log('🔍 FRONTEND: No value or no entity data - returning Not provided')
            return 'Not provided'
        }
        
        // Comprehensive navigation property mapping
        const navigationPropertyMap = {
            '_createdby_value': 'createdby',
            '_modifiedby_value': 'modifiedby',
            '_parentcustomerid_value': 'parentcustomerid',
            '_cp_contact_value': 'cp_Contact',  // Standard cp_contact mapping
            'cp_contact': 'cp_Contact'           // Form field mapping
        }
        
        // Add configured contact field mapping if available
        if (configuredContactField && configuredContactNavProperty) {
            navigationPropertyMap[`_${configuredContactField}_value`] = configuredContactNavProperty
            navigationPropertyMap[configuredContactField] = configuredContactNavProperty
        }
        
        console.log('🔍 FRONTEND: Navigation property map:', navigationPropertyMap)
        console.log('🔍 FRONTEND: Looking for field:', fieldName)
        
        // Check if we have expanded data for this lookup field using navigation property
        const navProperty = navigationPropertyMap[fieldName]
        console.log('🔍 FRONTEND: Found nav property:', navProperty)
        
        if (navProperty && entityData[navProperty]) {
            const expandedData = entityData[navProperty]
            console.log('🔍 FRONTEND: Found expanded data:', { navProperty, expandedData })
            
            if (expandedData.fullname) {
                console.log('✅ FRONTEND: Returning fullname:', expandedData.fullname)
                return expandedData.fullname
            } else if (expandedData.name) {
                console.log('✅ FRONTEND: Returning name:', expandedData.name)
                return expandedData.name
            } else if (expandedData.firstname && expandedData.lastname) {
                const fullName = `${expandedData.firstname} ${expandedData.lastname}`
                console.log('✅ FRONTEND: Returning constructed fullname:', fullName)
                return fullName
            }
        }
        
        // Check for Dataverse formatted value (standard OData annotation)
        const formattedValueKey = `${fieldName}@OData.Community.Display.V1.FormattedValue`
        if (entityData[formattedValueKey]) {
            console.log('✅ FRONTEND: Returning formatted value:', entityData[formattedValueKey])
            return entityData[formattedValueKey]
        }
        
        // Last resort: show truncated GUID with indicator
        if (typeof value === 'string' && value.length > 8) {
            const truncated = `${value.substring(0, 8)}... (ID)`
            console.log('✅ FRONTEND: Returning truncated GUID:', truncated)
            return truncated
        }
        
        console.log('✅ FRONTEND: Returning fallback value:', value || 'Not provided')
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
                                                                        console.log(`🔧 Converting field name: cp_contact → _cp_contact_value`)
                                                                        console.log(`🔧 Current formData.cp_contact:`, formData['cp_contact'])
                                                                        console.log(`� Current formData._cp_contact_value:`, formData['_cp_contact_value'])
                                                                        
                                                                        // PRESERVE THE VALUE during field conversion
                                                                        const existingValue = formData['cp_contact'] || formData['_cp_contact_value']
                                                                        if (existingValue && !formData['_cp_contact_value']) {
                                                                            console.log(`🔧 PRESERVING contact value during conversion:`, existingValue)
                                                                            setFormData(prev => ({
                                                                                ...prev,
                                                                                '_cp_contact_value': existingValue
                                                                            }))
                                                                        }
                                                                        
                                                                        field.datafieldname = '_cp_contact_value'
                                                                        field.controlType = 'lookup'
                                                                        field.displayName = field.displayName || 'Contact'
                                                                    }
                                                                    
                                                                    allFields.push(field)
                                                                })
                                                        })
                                                    })
                                                    
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
                                                        
                                                        // Use section name when display name unavailable
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
                                                            
                                                            {/* Render fields in original order with proper layout */}
                                                            <div className="space-y-6">
                                                                {/* Group consecutive regular fields into grid rows */}
                                                                {(() => {
                                                                    const fieldGroups = []
                                                                    let currentGroup = []
                                                                    
                                                                    allFields.forEach(field => {
                                                                        const isRichText = field.controlType === 'richtext' || field.isRichText
                                                                        
                                                                        if (isRichText) {
                                                                            // Flush current group if exists
                                                                            if (currentGroup.length > 0) {
                                                                                fieldGroups.push({ type: 'grid', fields: currentGroup })
                                                                                currentGroup = []
                                                                            }
                                                                            // Add rich text field as standalone
                                                                            fieldGroups.push({ type: 'richtext', field })
                                                                        } else {
                                                                            // Add to current group
                                                                            currentGroup.push(field)
                                                                        }
                                                                    })
                                                                    
                                                                    // Flush any remaining group
                                                                    if (currentGroup.length > 0) {
                                                                        fieldGroups.push({ type: 'grid', fields: currentGroup })
                                                                    }
                                                                    
                                                                    return fieldGroups.map((group, index) => {
                                                                        if (group.type === 'grid') {
                                                                            return (
                                                                                <div key={`grid-${index}`} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                                    {group.fields.map(field => (
                                                                                        <div key={field.datafieldname} className="space-y-2">
                                                                                            <label className="block text-sm font-medium text-gray-700">
                                                                                                {getFieldDisplayName(field)}
                                                                                                {field.disabled && <span className="text-gray-400 ml-1">(read-only)</span>}
                                                                                            </label>
                                                                                            {renderField(field)}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )
                                                                        } else if (group.type === 'richtext') {
                                                                            return (
                                                                                <div key={`richtext-${group.field.datafieldname}`} className="space-y-2">
                                                                                    <label className="block text-sm font-medium text-gray-700">
                                                                                        {getFieldDisplayName(group.field)}
                                                                                        {group.field.disabled && <span className="text-gray-400 ml-1">(read-only)</span>}
                                                                                    </label>
                                                                                    {renderField(group.field)}
                                                                                </div>
                                                                            )
                                                                        }
                                                                        return null
                                                                    })
                                                                })()}
                                                            </div>
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
