import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import Sidebar from '../../components/shared/Sidebar'

function Welcome() {
    const { user } = useUser()

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Top Header */}
                <header className="bg-white shadow-sm border-b px-6 py-4">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-semibold text-gray-900">
                            Welcome to Community Portal
                        </h1>
                        <div className="text-sm text-gray-500">
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 p-6">
                    <div className="max-w-4xl mx-auto">
                        {/* Welcome Card */}
                        <div className="bg-white rounded-xl shadow-sm border p-8 mb-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10m0 0V6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m0 0v8a2 2 0 002 2h6a2 2 0 002-2V8M9 12h6" />
                                    </svg>
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                                    Welcome, {user?.firstName || 'User'}! 👋
                                </h2>
                                <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
                                    You're now connected to the Community Portal. This portal demonstrates
                                    secure integration with Microsoft Dataverse using your authenticated account.
                                </p>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                            <div className="bg-white rounded-lg shadow-sm border p-6">
                                <div className="flex items-center mb-4">
                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Manage Profile</h3>
                                        <p className="text-sm text-gray-600">Update your contact information</p>
                                    </div>
                                </div>
                                <Link
                                    to="/contacts/edit"
                                    className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                                >
                                    Go to Profile →
                                </Link>
                            </div>

                            <div className="bg-white rounded-lg shadow-sm border p-6">
                                <div className="flex items-center mb-4">
                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">Help & Support</h3>
                                        <p className="text-sm text-gray-600">Get assistance with the portal</p>
                                    </div>
                                </div>
                                <p className="text-sm text-purple-600 font-medium">
                                    Contact support for help
                                </p>
                            </div>
                        </div>

                        {/* System Status */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                System Status
                            </h3>
                            <div className="grid sm:grid-cols-3 gap-4">
                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                    <div className="text-green-600 font-semibold">Authentication</div>
                                    <div className="text-sm text-green-700">Connected via Clerk</div>
                                </div>
                                <div className="text-center p-3 bg-blue-50 rounded-lg">
                                    <div className="text-blue-600 font-semibold">Dataverse</div>
                                    <div className="text-sm text-blue-700">Service Principal Active</div>
                                </div>
                                <div className="text-center p-3 bg-purple-50 rounded-lg">
                                    <div className="text-purple-600 font-semibold">Hosting</div>
                                    <div className="text-sm text-purple-700">Netlify Functions</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default Welcome
