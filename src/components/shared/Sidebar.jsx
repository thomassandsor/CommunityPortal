import { Link, useLocation } from 'react-router-dom'
import { useUser, UserButton, useAuth } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'

function Sidebar() {
    const { user } = useUser()
    const { getToken } = useAuth()
    const location = useLocation()
    const [showOrganization, setShowOrganization] = useState(false)

    // Check if user should see Organization menu
    useEffect(() => {
        const checkOrganizationAccess = async () => {
            if (!user?.primaryEmailAddress?.emailAddress) return

            try {
                const token = await getToken()
                const response = await fetch(`/.netlify/functions/contact?email=${encodeURIComponent(user.primaryEmailAddress.emailAddress)}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                })

                if (response.ok) {
                    const data = await response.json()
                    const contact = data.contact
                    
                    // Debug logging
                    console.log('Sidebar contact data:', contact)
                    console.log('Admin status:', contact?.cp_portaladmin)
                    console.log('Company association:', contact?._parentcustomerid_value)
                    
                    // Show Organization if user is admin AND has an associated account
                    if (contact?.cp_portaladmin && contact?._parentcustomerid_value) {
                        console.log('✅ Showing Organization menu - requirements met')
                        setShowOrganization(true)
                    } else {
                        console.log('❌ Not showing Organization menu:', {
                            isAdmin: contact?.cp_portaladmin,
                            hasCompany: contact?._parentcustomerid_value
                        })
                    }
                }
            } catch (error) {
                console.error('Error checking organization access:', error)
            }
        }

        checkOrganizationAccess()
    }, [user, getToken])

    const baseMenuItems = [
        {
            id: 'home',
            name: 'Home',
            path: '/welcome',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        },
        {
            id: 'profile',
            name: 'Profile',
            path: '/contacts/edit',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            )
        }
    ]

    const organizationMenuItem = {
        id: 'organization',
        name: 'Organization',
        path: '/organization',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        )
    }

    // Add Organization menu item if user has access
    const menuItems = showOrganization 
        ? [...baseMenuItems.slice(0, 1), organizationMenuItem, ...baseMenuItems.slice(1)]
        : baseMenuItems

    return (
        <div className="w-64 bg-white shadow-lg flex flex-col">
            {/* Logo/Header */}
            <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">Community Portal</h2>
                <p className="text-sm text-gray-600 mt-1">Welcome back!</p>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 mt-6">
                <div className="px-3">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${isActive
                                        ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                            >
                                <span className={`mr-3 ${isActive ? 'text-blue-700' : 'text-gray-400'}`}>
                                    {item.icon}
                                </span>
                                {item.name}
                            </Link>
                        )
                    })}
                </div>
            </nav>

            {/* User Info at Bottom */}
            <div className="p-4 border-t bg-gray-50">
                <div className="flex items-center">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                            {user?.primaryEmailAddress?.emailAddress}
                        </p>
                    </div>
                    <div className="ml-3">
                        <UserButton
                            appearance={{
                                elements: {
                                    avatarBox: "w-8 h-8"
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Sidebar
