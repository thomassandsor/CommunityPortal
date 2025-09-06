import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import Sidebar from '../../components/shared/Sidebar'

function OrganizationContactEdit() {
    const { contactId } = useParams()
    const navigate = useNavigate()
    const { user } = useUser()
    const { getToken } = useAuth()
    
    const [contact, setContact] = useState(null)
    const [formMetadata, setFormMetadata] = useState(null)
    const [formData, setFormData] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [dataInitialized, setDataInitialized] = useState(false)

    // Single useEffect to fetch data efficiently
    useEffect(() => {
        if (user && contactId && !dataInitialized) {
            console.log(`🔍 Fetching data for contact: ${contactId}`)
            
            Promise.all([
                fetchContact(),
                fetchFormMetadata()
            ]).then(([contactData, formMetadata]) => {
                // Initialize form data immediately with both results
                initializeFormData(contactData, formMetadata)
                setDataInitialized(true)
                setLoading(false)
            }).catch(error => {
                console.error('Error during data fetching:', error)
                setError(error.message)
                setLoading(false)
            })
        }
    }, [user, contactId, dataInitialized])

    const fetchContact = async () => {
        try {
            const token = await getToken()
            const response = await fetch(`/.netlify/functions/organization?contactId=${contactId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                throw new Error('Failed to fetch contact')
            }

            const data = await response.json()
            setContact(data.contact)
            console.log('✅ Contact loaded:', data.contact.fullname)
            return data.contact
            
        } catch (error) {
            console.error('Error fetching contact:', error)
            throw error
        }
    }

    const initializeFormData = (contactData, formMetadata) => {
        console.log('🎬 Initializing form data with contact:', contactData.fullname)
        const initialData = {}
        let fieldCount = 0
        
        // Process enhanced form structure
        formMetadata.structure.tabs.forEach(tab => {
            tab.sections?.forEach(section => {
                section.rows?.forEach(row => {
                    row.cells?.forEach(cell => {
                        cell.controls?.forEach(control => {
                            if (control.type === 'control' && control.datafieldname) {
                                const fieldName = control.datafieldname
                                initialData[fieldName] = contactData[fieldName] || ''
                                fieldCount++
                            }
                        })
                    })
                })
            })
        })
        
        setFormData(initialData)
        console.log(`✅ Form data initialized with ${fieldCount} fields`)
    }

    const fetchFormMetadata = async () => {
        try {
            const token = await getToken()
            const response = await fetch('/.netlify/functions/organization?mode=form', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                throw new Error('Failed to fetch form metadata')
            }

            const data = await response.json()
            setFormMetadata(data.formMetadata)
            console.log('✅ Form metadata loaded:', data.formMetadata.name)
            return data.formMetadata
            
        } catch (error) {
            console.error('Error fetching form metadata:', error)
            throw error
        }
    }

    const handleInputChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: value
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        setError(null)

        try {
            console.log('💾 Saving contact:', formData)
            
            const token = await getToken()
            const response = await fetch('/.netlify/functions/contact', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contactid: contactId,
                    ...formData
                })
            })

            if (!response.ok) {
                throw new Error('Failed to save contact')
            }

            console.log('✅ Contact saved successfully')
            navigate('/organization/test?success=Contact updated successfully')
            
        } catch (error) {
            console.error('Error saving contact:', error)
            setError(error.message)
        } finally {
            setSaving(false)
        }
    }

    const renderField = (field) => {
        // Enhanced structure uses field.datafieldname
        const fieldName = field.datafieldname
        const fieldType = field.controlType
        const value = formData[fieldName] || ''
        
        // Skip only the contactid field (internal system field)
        if (fieldName === 'contactid') {
            return null
        }

        // Email field should be disabled (unique identifier)
        const isEmailField = fieldName === 'emailaddress1'
        // System audit fields should be read-only
        const isSystemField = fieldName === 'createdon' || fieldName === 'modifiedon' || fieldName === 'createdby' || fieldName === '_createdby_value'
        const isDisabled = field.disabled || isEmailField || isSystemField

        switch (fieldType) {
            case 'email':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.displayName || field.label}
                            {isEmailField && <span className="text-xs text-gray-500 ml-2">(Cannot be changed)</span>}
                        </label>
                        <input
                            type="email"
                            value={value}
                            onChange={(e) => handleInputChange(fieldName, e.target.value)}
                            disabled={isDisabled}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                                isDisabled ? 'bg-gray-100 text-gray-500' : ''
                            }`}
                        />
                    </div>
                )

            case 'phone':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.displayName || field.label}
                        </label>
                        <input
                            type="tel"
                            value={value}
                            onChange={(e) => handleInputChange(fieldName, e.target.value)}
                            disabled={isDisabled}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                                isDisabled ? 'bg-gray-100 text-gray-500' : ''
                            }`}
                        />
                    </div>
                )

            case 'boolean':
                return (
                    <div key={fieldName}>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={value}
                                onChange={(e) => handleInputChange(fieldName, e.target.checked)}
                                disabled={isDisabled}
                                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">
                                {field.displayName || field.label}
                            </span>
                        </label>
                    </div>
                )

            case 'lookup':
                let lookupValue = 'Not assigned'
                
                // Handle different lookup types
                if (fieldName === 'parentcustomerid' || fieldName === '_parentcustomerid_value') {
                    lookupValue = contact?.parentcustomerid?.name || contact?.parentcustomerid?.fullname || 'No company assigned'
                } else if (fieldName === 'createdby' || fieldName === '_createdby_value') {
                    // For createdby, we'd need to expand this field or show the ID
                    lookupValue = value || 'System'
                } else {
                    lookupValue = value || 'Not assigned'
                }
                
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.displayName || field.label}
                        </label>
                        <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-500">
                            {lookupValue}
                            <span className="text-xs ml-2">(Lookup fields not editable in this demo)</span>
                        </div>
                    </div>
                )

            case 'datetime':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.displayName || field.label}
                            {isSystemField && <span className="text-xs text-gray-500 ml-2">(System field)</span>}
                        </label>
                        <input
                            type="text"
                            value={value ? new Date(value).toLocaleString() : ''}
                            disabled={true}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-500"
                            readOnly
                        />
                    </div>
                )

            default: // text
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {field.displayName || field.label}
                        </label>
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleInputChange(fieldName, e.target.value)}
                            disabled={isDisabled}
                            className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                                isDisabled ? 'bg-gray-100 text-gray-500' : ''
                            }`}
                        />
                    </div>
                )
        }
    }

    const renderSubgrid = (subgrid) => {
        return (
            <div key={subgrid.name} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-medium text-gray-900">
                        {subgrid.displayName || subgrid.name}
                    </h5>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        Subgrid
                    </span>
                </div>
                <div className="text-sm text-gray-600">
                    <p>Entity: <span className="font-medium">{subgrid.entity}</span></p>
                    {subgrid.relationship && (
                        <p>Relationship: <span className="font-medium">{subgrid.relationship}</span></p>
                    )}
                </div>
                <div className="mt-3 p-3 bg-white border border-gray-200 rounded text-center text-sm text-gray-500">
                    Subgrid functionality not implemented in this demo
                    <br />
                    <span className="text-xs text-gray-400">
                        Would display related {subgrid.entity} records here
                    </span>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading contact and form...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            <p>Error: {error}</p>
                            <button 
                                onClick={() => navigate('/organization/test')}
                                className="mt-2 text-blue-600 hover:text-blue-800"
                            >
                                ← Back to Organization
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <Sidebar />

            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-white shadow-sm border-b px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">
                                Edit Contact
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                {contact?.fullname} • Dynamic Form from Dataverse
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/orgtest')}
                            className="text-gray-600 hover:text-gray-800"
                        >
                            ← Back to Organization View
                        </button>
                    </div>
                </header>

                {/* Form Content */}
                <main className="flex-1 p-6">
                    <div className="max-w-6xl mx-auto">
                        <div className="bg-white rounded-lg shadow p-6">
                            <form onSubmit={handleSubmit}>
                                {/* Render tabs with clear dividers */}
                                <div className="space-y-8">
                                    {formMetadata.structure.tabs.map((tab, tabIndex) => (
                                        <div key={tabIndex} className="space-y-6">
                                            {/* Tab Header with clear divider */}
                                            <div className="border-b-2 border-gray-200 pb-3">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {tab.displayName || tab.name}
                                                </h3>
                                            </div>

                                            {/* Tab Content - Simple 2-column grid for all fields in this tab */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {tab.sections?.map((section, sectionIndex) =>
                                                    section.rows?.map((row, rowIndex) =>
                                                        row.cells?.map((cell, cellIndex) =>
                                                            cell.controls?.map((control, controlIndex) => 
                                                                control.type === 'control' ? 
                                                                    renderField(control) : 
                                                                    renderSubgrid(control)
                                                            )
                                                        )
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-end space-x-3 pt-6 border-t">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/organization/test')}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {saving ? 'Saving...' : 'Save Contact'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default OrganizationContactEdit
