import { useState, useEffect } from 'react'

function ContactForm({ contact, userEmail, onSave, disabled }) {
    const [formData, setFormData] = useState({
        firstname: '',
        lastname: '',
        emailaddress1: '',
        mobilephone: '',
    })    // Initialize form data when contact changes
    useEffect(() => {
        if (contact) {
            setFormData({
                firstname: contact.firstname || '',
                lastname: contact.lastname || '',
                emailaddress1: contact.emailaddress1 || userEmail || '',
                mobilephone: contact.mobilephone || '',
            })
        } else {
            // New contact - initialize with user email
            setFormData({
                firstname: '',
                lastname: '',
                emailaddress1: userEmail || '',
                mobilephone: '',
            })
        }
    }, [contact, userEmail])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()

        // Basic validation
        if (!formData.emailaddress1.trim()) {
            alert('Email address is required')
            return
        }

        // Include contactid if updating existing contact
        const contactData = {
            ...formData,
            ...(contact?.contactid && { contactid: contact.contactid })
        }

        onSave(contactData)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* First Name */}
                <div>
                    <label htmlFor="firstname" className="block text-sm font-medium text-gray-700 mb-2">
                        First Name
                    </label>
                    <input
                        type="text"
                        id="firstname"
                        name="firstname"
                        value={formData.firstname}
                        onChange={handleChange}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Enter your first name"
                    />
                </div>

                {/* Last Name */}
                <div>
                    <label htmlFor="lastname" className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name
                    </label>
                    <input
                        type="text"
                        id="lastname"
                        name="lastname"
                        value={formData.lastname}
                        onChange={handleChange}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Enter your last name"
                    />
                </div>

                {/* Email Address */}
                <div>
                    <label htmlFor="emailaddress1" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address * (Unique Identifier)
                    </label>
                    <input
                        type="email"
                        id="emailaddress1"
                        name="emailaddress1"
                        value={formData.emailaddress1}
                        onChange={handleChange}
                        disabled={true}
                        readOnly
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700 cursor-not-allowed"
                        placeholder="Email address (cannot be changed)"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Email address cannot be changed as it's used to identify your contact record
                    </p>
                </div>

                {/* Mobile Phone */}
                <div>
                    <label htmlFor="mobilephone" className="block text-sm font-medium text-gray-700 mb-2">
                        Mobile Phone
                    </label>
                    <input
                        type="tel"
                        id="mobilephone"
                        name="mobilephone"
                        value={formData.mobilephone}
                        onChange={handleChange}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="Enter your mobile phone number"
                    />
                </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                    type="submit"
                    disabled={disabled}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {disabled ? 'Saving...' : contact?.contactid ? 'Update Contact' : 'Create Contact'}
                </button>
            </div>

            {/* Help Text */}
            <div className="text-sm text-gray-500">
                <p>* Required field</p>
                <p className="mt-1">
                    {contact?.contactid
                        ? 'Updating existing contact record in Dataverse'
                        : 'A new contact record will be created in Dataverse'
                    }
                </p>
            </div>
        </form>
    )
}

export default ContactForm
