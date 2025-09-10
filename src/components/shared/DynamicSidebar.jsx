import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUser, useAuth, UserButton } from '@clerk/clerk-react'

function DynamicSidebar() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, isLoaded } = useUser()
    const { getToken } = useAuth()
    
    const [menuItems, setMenuItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (isLoaded && user) {
            fetchMenuItems()
        }
    }, [isLoaded, user])

    const fetchMenuItems = async () => {
        // Only prevent if already in progress for the exact same user
        if (loading && menuItems.length > 0) {
            return
        }

        try {
            setLoading(true)
            setError(null)

            const token = await getToken()
            const response = await fetch('/.netlify/functions/entity-config', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                console.warn('Failed to fetch entity configurations, using default menu')
                setMenuItems(getDefaultMenuItems())
                setLoading(false)
                return
            }

            const data = await response.json()
            const dynamicItems = buildMenuItems(data.configs || [])
            setMenuItems(dynamicItems)

        } catch (err) {
            console.error('Error fetching menu items:', err)
            setError(err.message)
            setMenuItems(getDefaultMenuItems())
        } finally {
            setLoading(false)
        }
    }

    const buildMenuItems = (configs) => {
        
        // Start with core menu items
        const coreItems = [
            {
                id: 'welcome',
                name: 'Dashboard',
                path: '/welcome',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    </svg>
                ),
                order: 0
            },
            {
                id: 'profile',
                name: 'My Profile',
                path: '/contacts/edit',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                ),
                order: 10
            }
        ]

        // Add configured entity items
        const entityItems = configs
            .filter(config => config.showInMenu)
            .map(config => ({
                id: config.entityLogicalName,
                name: config.name,
                path: config.listPath,
                icon: getEntityIcon(config.menuIcon),
                order: config.menuOrder || 1000,
                requiresAdmin: config.requiresAdmin,
                description: config.description
            }))

        // Combine and sort by order
        const allItems = [...coreItems, ...entityItems]
        return allItems.sort((a, b) => a.order - b.order)
    }

    const getEntityIcon = (iconName) => {
        const iconMap = {
            'users': (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
            ),
            'building': (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
            'chart-bar': (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
            'document': (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
            'mail': (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            )
        }

        return iconMap[iconName] || (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        )
    }

    const getDefaultMenuItems = () => {
        return [
            {
                id: 'welcome',
                name: 'Dashboard',
                path: '/welcome',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    </svg>
                ),
                order: 0
            },
            {
                id: 'profile',
                name: 'My Profile',
                path: '/contacts/edit',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                ),
                order: 10
            },
            {
                id: 'organization',
                name: 'Organization',
                path: '/organization',
                icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                ),
                order: 100
            }
        ]
    }

    const handleNavigation = (path) => {
        navigate(path)
    }

    if (!isLoaded) {
        return null
    }

    return (
        <div className="w-64 bg-white shadow-lg flex flex-col">
            {/* Logo/Header */}
            <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">Community Portal</h2>
                <p className="text-sm text-gray-600 mt-1">Dynamic Edition</p>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 px-4 py-6 space-y-2">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-600">Loading menu...</span>
                    </div>
                ) : (
                    menuItems.map((item) => {
                        const isActive = location.pathname === item.path || 
                                        (item.path !== '/welcome' && location.pathname.startsWith(item.path))
                        
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleNavigation(item.path)}
                                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                                    isActive
                                        ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                                title={item.description}
                            >
                                <span className="mr-3">
                                    {item.icon}
                                </span>
                                {item.name}
                                {item.requiresAdmin && (
                                    <span className="ml-auto text-xs text-red-500" title="Admin Only">
                                        🔑
                                    </span>
                                )}
                            </button>
                        )
                    })
                )}

                {error && (
                    <div className="px-4 py-3 text-sm text-red-600 bg-red-50 rounded-lg">
                        <p className="font-medium">Menu Error</p>
                        <p className="text-xs mt-1">Using default menu</p>
                    </div>
                )}
            </nav>

            {/* User Info */}
            <div className="border-t px-4 py-4">
                <div className="flex items-center">
                    <div className="flex-shrink-0">
                        <UserButton 
                            appearance={{
                                elements: {
                                    avatarBox: "w-8 h-8"
                                }
                            }}
                        />
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                            {user?.primaryEmailAddress?.emailAddress}
                        </p>
                    </div>
                </div>
            </div>

            {/* Debug Info */}
            {!loading && (
                <div className="border-t px-4 py-2 bg-gray-50">
                    <p className="text-xs text-gray-500">
                        {menuItems.length} menu items loaded
                    </p>
                </div>
            )}
        </div>
    )
}

export default DynamicSidebar
