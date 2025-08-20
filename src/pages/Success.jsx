import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'

function Success() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [showConfetti, setShowConfetti] = useState(true)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    // Hide confetti effect after 3 seconds
    const confettiTimer = setTimeout(() => setShowConfetti(false), 3000)
    
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          navigate('/my-page')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearTimeout(confettiTimer)
      clearInterval(countdownInterval)
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Success Animation */}
        <div className="relative mb-8">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Simple confetti-like effect */}
              <div className="animate-bounce absolute top-0 left-1/4 w-2 h-2 bg-yellow-400 rounded-full"></div>
              <div className="animate-bounce absolute top-0 right-1/4 w-2 h-2 bg-blue-400 rounded-full" style={{animationDelay: '0.1s'}}></div>
              <div className="animate-bounce absolute top-1/4 left-1/3 w-2 h-2 bg-red-400 rounded-full" style={{animationDelay: '0.2s'}}></div>
              <div className="animate-bounce absolute top-1/4 right-1/3 w-2 h-2 bg-green-400 rounded-full" style={{animationDelay: '0.3s'}}></div>
            </div>
          )}
        </div>

        {/* Success Message */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          Success! 🎉
        </h1>
        
        <p className="text-xl text-gray-600 mb-8 leading-relaxed">
          Your contact information has been successfully saved to Microsoft Dataverse.
          {user?.firstName && ` Thank you, ${user.firstName}!`}
        </p>

        {/* What Happened */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8 text-left">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            What happened?
          </h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Your information was securely transmitted to Microsoft Dataverse
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              The contact record was created or updated in the system
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              All data is encrypted and stored securely following enterprise standards
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              You can update your information anytime by visiting your profile
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
          <Link 
            to="/my-page"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Go to Profile Now
          </Link>
          
          <Link 
            to="/welcome"
            className="inline-block bg-gray-100 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors border border-gray-300"
          >
            Back to Home
          </Link>
        </div>

        {/* Auto-redirect Notice */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-center text-blue-800">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">
              Automatically redirecting to your profile in {countdown} second{countdown !== 1 ? 's' : ''}...
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 mt-3">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${((5 - countdown) / 5) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-sm text-gray-500">
          <p className="mb-2">
            <strong>Next steps:</strong> You can update your contact information anytime, 
            and it will be automatically synchronized with Dataverse.
          </p>
          <p>
            Having issues? <Link to="/about" className="text-blue-600 hover:text-blue-700 underline">
              Check our help section
            </Link> or contact support.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Success
