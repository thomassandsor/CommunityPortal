import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Development connection monitoring - temporarily disabled
// if (import.meta.env.DEV) {
//     import('./dev-monitor.js')
// }

// Import Clerk publishable key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
    throw new Error("Missing Publishable Key")
}

// Development mode optimization to reduce unnecessary re-renders
const isDevelopment = import.meta.env.DEV

// React Router future flags to suppress v7 warnings
const routerFutureFlags = {
    v7_startTransition: true,
    v7_relativeSplatPath: true
}

ReactDOM.createRoot(document.getElementById('root')).render(
    // Only use StrictMode in development for debugging
    isDevelopment ? (
        <React.StrictMode>
            <ClerkProvider 
                publishableKey={PUBLISHABLE_KEY}
                routerPush={(to) => window.history.pushState(null, '', to)}
                routerReplace={(to) => window.history.replaceState(null, '', to)}
                signUpUrl="/"
                signInUrl="/"
                afterSignUpUrl="/welcome"
                afterSignInUrl="/welcome"
                signUpFallbackRedirectUrl="/welcome"
                signInFallbackRedirectUrl="/welcome"
                allowedRedirectOrigins={[window.location.origin]}
            >
                <BrowserRouter future={routerFutureFlags}>
                    <App />
                </BrowserRouter>
            </ClerkProvider>
        </React.StrictMode>
    ) : (
        <ClerkProvider 
            publishableKey={PUBLISHABLE_KEY}
            routerPush={(to) => window.history.pushState(null, '', to)}
            routerReplace={(to) => window.history.replaceState(null, '', to)}
            signUpUrl="/"
            signInUrl="/"
            afterSignUpUrl="/welcome"
            afterSignInUrl="/welcome"
            signUpFallbackRedirectUrl="/welcome"
            signInFallbackRedirectUrl="/welcome"
            allowedRedirectOrigins={[window.location.origin]}
        >
            <BrowserRouter future={routerFutureFlags}>
                <App />
            </BrowserRouter>
        </ClerkProvider>
    )
)
