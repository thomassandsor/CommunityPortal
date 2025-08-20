import { Link, useLocation } from 'react-router-dom'
import { useUser, UserButton } from '@clerk/clerk-react'

function Sidebar() {
  const { user } = useUser()
  const location = useLocation()

  const menuItems = [
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
      path: '/my-page',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    }
  ]

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
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
                  isActive
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
