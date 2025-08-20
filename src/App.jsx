import { Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import Landing from './pages/Landing'
import Welcome from './pages/Welcome'
import MyPage from './pages/MyPage'
import Success from './pages/Success'

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
              <Welcome />
            </SignedIn>
          </>
        } />
        
        {/* Protected routes */}
        <Route path="/welcome" element={
          <SignedIn>
            <Welcome />
          </SignedIn>
        } />
        
        <Route path="/profile" element={
          <SignedIn>
            <MyPage />
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
