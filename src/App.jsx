import { Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import ContactChecker from './components/shared/ContactChecker'
import Landing from './pages/shared/Landing'
import Welcome from './pages/shared/Welcome'
import ContactEdit from './pages/contacts/ContactEdit'
import Success from './pages/shared/Success'
import Organization from './pages/organization/Organization'
import OrganizationContactEdit from './pages/organization/OrganizationContactEdit'
import EntityList from './pages/generic/EntityList'
import EntityEdit from './pages/generic/EntityEdit'

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

                <Route path="/organization/edit/:contactId" element={
                    <SignedIn>
                        <OrganizationContactEdit />
                    </SignedIn>
                } />

                {/* Generic entity routes */}
                <Route path="/entity/:entityName" element={
                    <SignedIn>
                        <EntityList />
                    </SignedIn>
                } />

                <Route path="/entity/:entityName/edit" element={
                    <SignedIn>
                        <EntityEdit />
                    </SignedIn>
                } />

                <Route path="/entity/:entityName/create" element={
                    <SignedIn>
                        <EntityEdit />
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
