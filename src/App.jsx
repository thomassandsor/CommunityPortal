import { Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import Login from './pages/Login'
import MyPage from './pages/MyPage'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-xl font-semibold text-gray-900">
              Community Portal
            </h1>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SignedOut>
          <Login />
        </SignedOut>
        
        <SignedIn>
          <Routes>
            <Route path="/" element={<MyPage />} />
            <Route path="/my-page" element={<MyPage />} />
          </Routes>
        </SignedIn>
      </main>
    </div>
  )
}

export default App
