import { useSignIn } from '@clerk/clerk-react'

// Custom Personal Login Button (Google/Gmail)
function PersonalLoginButton() {
    const { signIn } = useSignIn()

    const handleGoogleSignIn = async () => {
        try {
            await signIn.authenticateWithRedirect({
                strategy: "oauth_google",
                redirectUrl: "/welcome",
                redirectUrlComplete: "/welcome"
            })
        } catch (error) {
            console.error('Google sign-in error:', error)
        }
    }

    return (
        <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center px-4 py-3 border border-green-300 rounded-lg bg-white hover:bg-green-50 transition-colors duration-200 group"
        >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-green-900 font-medium group-hover:text-green-800">
                Continue with Google
            </span>
        </button>
    )
}

// Custom Business Login Button (Microsoft)
function BusinessLoginButton() {
    const { signIn } = useSignIn()

    const handleMicrosoftSignIn = async () => {
        try {
            await signIn.authenticateWithRedirect({
                strategy: "oauth_microsoft",
                redirectUrl: "/welcome",
                redirectUrlComplete: "/welcome"
            })
        } catch (error) {
            console.error('Microsoft sign-in error:', error)
        }
    }

    return (
        <button
            onClick={handleMicrosoftSignIn}
            className="w-full flex items-center justify-center px-4 py-3 border border-blue-300 rounded-lg bg-white hover:bg-blue-50 transition-colors duration-200 group"
        >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 23 23">
                <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
            </svg>
            <span className="text-blue-900 font-medium group-hover:text-blue-800">
                Continue with Microsoft
            </span>
        </button>
    )
}

function Landing() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <h1 className="text-xl font-bold text-gray-900">Community Portal</h1>
                        </div>
                        <div className="text-sm text-gray-500">
                            Open Source Demo
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Side - Welcome Content */}
                    <div>
                        <div className="mb-8">
                            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                                Welcome to the
                                <span className="block text-blue-600">Community Portal</span>
                            </h2>
                            <p className="text-xl text-gray-600 leading-relaxed mb-6">
                                A modern, secure portal demonstrating React integration with Microsoft Dataverse.
                                Sign in with your work account or personal email to get started.
                            </p>
                        </div>

                        {/* Features */}
                        <div className="space-y-4 mb-8">
                            <div className="flex items-start">
                                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Secure Authentication</h3>
                                    <p className="text-gray-600">Login with work accounts (Microsoft Entra ID) or personal emails</p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                                    <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Dataverse Integration</h3>
                                    <p className="text-gray-600">Securely manage your contact information in Microsoft Dataverse</p>
                                </div>
                            </div>

                            <div className="flex items-start">
                                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-4 mt-1 flex-shrink-0">
                                    <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">Open Source</h3>
                                    <p className="text-gray-600">Community-driven starter template for learning and extension</p>
                                    <div className="mt-3">
                                        <a
                                            href="https://github.com/thomassandsor/CommunityPortal"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                            </svg>
                                            Open Source
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tech Stack */}
                        <div className="bg-gray-50 rounded-lg p-6">
                            <h4 className="font-semibold text-gray-900 mb-3">Built with modern technology:</h4>
                            <div className="flex flex-wrap gap-2">
                                {['React 18', 'Vite', 'Tailwind CSS', 'Clerk Auth', 'Netlify Functions', 'Microsoft Dataverse'].map((tech) => (
                                    <span key={tech} className="px-3 py-1 bg-white rounded-full text-sm text-gray-700 border">
                                        {tech}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Sign In */}
                    <div className="flex justify-center">
                        <div className="w-full max-w-md">
                            <div className="text-center mb-6">
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Get Started</h3>
                                <p className="text-gray-600">Choose your sign-in method</p>
                            </div>

                            <div className="space-y-4">
                                {/* Personal Section - Top */}
                                <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                                    <h4 className="text-lg font-semibold text-green-900 mb-2 flex items-center">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        Personal Account
                                    </h4>
                                    <p className="text-green-700 text-sm mb-4">Sign in with your Gmail account</p>
                                    <PersonalLoginButton />
                                </div>

                                {/* Divider */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300" />
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-2 bg-white text-gray-500">OR</span>
                                    </div>
                                </div>

                                {/* Business Section - Bottom */}
                                <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                                    <h4 className="text-lg font-semibold text-blue-900 mb-2 flex items-center">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        Business Account
                                    </h4>
                                    <p className="text-blue-700 text-sm mb-4">Sign in with your work or school account</p>
                                    <BusinessLoginButton />
                                </div>
                            </div>

                            <div className="mt-6 text-center">
                                <p className="text-sm text-gray-500">
                                    This demo uses Service Principal authentication for secure,
                                    <br />
                                    production-ready integration with Microsoft Dataverse.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    )
}

export default Landing
