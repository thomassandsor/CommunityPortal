import { Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import ContactChecker from './components/shared/ContactChecker'
import Landing from './pages/shared/Landing'
import Welcome from './pages/shared/Welcome'
import ContactEdit from './pages/contacts/ContactEdit'
import Success from './pages/shared/Success'
import Organization from './pages/organization/Organization'
import OrgTest from './pages/organization/OrgTest'
import OrganizationContactEdit from './pages/organization/OrganizationContactEdit'

function App() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Routes>
                {/* Public route - Landing page */}
                <Route path="/" element={
                    <>
                        <SignedOut>
                            <Landing />
                        </SignedOut>
                        <SignedIn>
                            <ContactChecker>
                                <Welcome />
                            </ContactChecker>
                        </SignedIn>
                    </>
                } />

                {/* Protected routes */}
                <Route path="/welcome" element={
                    <SignedIn>
                        <ContactChecker>
                            <Welcome />
                        </ContactChecker>
                    </SignedIn>
                } />

                <Route path="/contacts/edit" element={
                    <SignedIn>
                        <ContactEdit />
                    </SignedIn>
                } />

                <Route path="/organization" element={
                    <SignedIn>
                        <Organization />
                    </SignedIn>
                } />

                <Route path="/orgtest" element={
                    <SignedIn>
                        <OrgTest />
                    </SignedIn>
                } />

                <Route path="/organization/test" element={
                    <SignedIn>
                        <OrgTest />
                    </SignedIn>
                } />

                <Route path="/orgtest/edit/:contactId" element={
                    <SignedIn>
                        <OrganizationContactEdit />
                    </SignedIn>
                } />

                <Route path="/success" element={
                    <SignedIn>
                        <Success />
                    </SignedIn>
                } />
            </Routes>
        </div>
    )
}

export default App
