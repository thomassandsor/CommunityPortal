import { SignIn } from '@clerk/clerk-react'

function Login() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to Community Portal
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl">
          Connect with Microsoft Dataverse to manage your contact information. 
          Sign in with your work account or personal email to get started.
        </p>
      </div>
      
      <div className="w-full max-w-md">
        <SignIn 
          routing="hash"
          signUpUrl="/sign-up"
          redirectUrl="/my-page"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-lg"
            }
          }}
        />
      </div>
      
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          This demo connects to Microsoft Dataverse using a secure Service Principal.
          <br />
          Your data is protected and only accessible to you.
        </p>
      </div>
    </div>
  )
}

export default Login
