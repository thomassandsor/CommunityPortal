# Community Portal - AI Assistant Instructions

## � How to Use This File in VS Code

### Option 1: GitHub Copilot Chat
1. Open this file in VS Code
2. Select all content (Ctrl+A)
3. Copy (Ctrl+C)
4. Open GitHub Copilot Chat
5. Paste and add: "Use these instructions for all Community Portal development"

### Option 2: Custom Instructions
1. Copy this file content
2. In VS Code settings, add to "Custom Instructions" or "AI Instructions"
3. Reference this file in your prompts: "Follow Community Portal instructions"

### Option 3: Reference in Prompts
Always start prompts with: "Following the Community Portal instructions, [your request]"

---

## Project Identity & Purpose
You are working on the **Community Portal** - an open-source React application that demonstrates secure integration between Netlify, Clerk authentication, and Microsoft Dataverse using Service Principal authentication. This is a community learning project designed for AI-assisted development.

## Core Architecture Constraints

### Tech Stack (NON-NEGOTIABLE)
- **Frontend**: React 18 + Vite + Tailwind CSS only
- **Authentication**: Clerk.dev (supports work + personal accounts)
- **Backend**: Netlify Functions (serverless only, ES modules)
- **Database**: Microsoft Dataverse (via Service Principal)
- **Hosting**: Netlify (free tier compatible)
- **Styling**: Tailwind CSS only (no other CSS frameworks)
- **Development**: Netlify CLI for local development (NOT .env files)

### Authentication Pattern (REQUIRED)
- **User Authentication**: Always use Clerk.dev components (`<SignIn>`, `<UserButton>`, `<SignedIn>`, `<SignedOut>`)
- **Dataverse Authentication**: Always use Service Principal (Client Credentials Flow) - NEVER delegated user auth
- **Security**: Environment variables for secrets, never in frontend code
- **Token Management**: Backend functions handle all Azure AD token requests
- **Auto Contact Flow**: ContactChecker component handles contact creation + routing
- **Email as Unique ID**: Email field is locked and used for contact identification

### User Flow Pattern (ESTABLISHED)
1. **Landing.jsx** → Sign in with Clerk
2. **ContactChecker** → Auto-check/create contact in Dataverse
3. **New users** → Redirect to MyPage.jsx for profile completion
4. **Existing users** → Redirect to Welcome.jsx dashboard
5. **Contact updates** → MyPage.jsx → Success.jsx confirmation

##### 4. Authentication Flow Pattern (Service Principal)
```javascript
// functions/auth.js - OAuth 2.0 Client Credentials
export const handler = async (event) => {
  const { CLIENT_ID, CLIENT_SECRET, TENANT_ID } = process.env
  
  const tokenEndpoint = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`
  const scope = `${DATAVERSE_URL}/.default`
  
  // Token exchange with proper error handling
  // Return access token for Dataverse API calls
}
```

## 🚫 FORBIDDEN ACTIONS

### DO NOT CREATE OR SUGGEST:
1. **Fake .env files** - Use Netlify CLI for local development
2. **CommonJS exports** - All functions must use ES modules (`export`)
3. **telephone1 field** - Use `mobilephone` for phone numbers
4. **Auto-redirects** - Let users navigate naturally after contact creation
5. **Unprotected API calls** - Always use session storage to prevent duplicates
6. **Hard-coded URLs** - Use environment variables for all endpoints
7. **Missing CORS headers** - All functions need proper CORS configuration
8. **Editable email fields** - Email should be locked as unique identifier
9. **Home.jsx or unused components** - Keep component structure clean
10. **Direct navigation bypassing ContactChecker** - All routes should go through contact management

### FIELD NAMING REQUIREMENTS:
- ✅ `emailaddress1` (Dataverse standard)
- ✅ `mobilephone` (Dataverse standard)
- ✅ `firstname`, `lastname` (Dataverse standard)
- ❌ `email`, `phone`, `telephone1` (Incorrect field names)

## 📝 ENVIRONMENT VARIABLES

### Required Netlify Environment Variables:
```
DATAVERSE_URL=https://your-org.crm.dynamics.com
CLIENT_ID=your-service-principal-client-id
CLIENT_SECRET=your-service-principal-secret
TENANT_ID=your-azure-tenant-id
```

### Access in Netlify Functions:
```javascript
const { DATAVERSE_URL, CLIENT_ID, CLIENT_SECRET, TENANT_ID } = process.env

// Validate required environment variables
if (!DATAVERSE_URL || !CLIENT_ID) {
  return { statusCode: 500, body: JSON.stringify({ error: 'Missing configuration' }) }
}
## 🔧 PROJECT STRUCTURE

```
CommunityPortal/
├── src/
│   ├── main.jsx                 # ClerkProvider setup
│   ├── App.jsx                  # Main routing with ContactChecker
│   ├── index.css               # Tailwind imports
│   ├── pages/
│   │   ├── Landing.jsx         # Public landing page
│   │   ├── Welcome.jsx         # Post-login welcome
│   │   ├── MyPage.jsx          # User profile/dashboard
│   │   └── Success.jsx         # Confirmation page
│   └── components/
│       ├── ContactChecker.jsx  # Auto contact management
│       ├── ContactForm.jsx     # Contact data form
│       └── Sidebar.jsx         # Navigation component
├── functions/
│   ├── auth.js                 # Service Principal authentication
│   └── contact.js              # Dataverse contact operations
├── public/
│   └── index.html              # Main HTML template
├── package.json                # Dependencies and scripts
├── vite.config.js              # Vite build configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── netlify.toml                # Netlify deployment settings
└── CHAT_MODE_INSTRUCTIONS.md   # This file - AI assistant guide
```

## 🎯 USER FLOW

### Authentication Journey:
1. **Landing Page** (`/`) - Public marketing page with sign-in options
2. **ContactChecker** - Automatic contact creation/verification for authenticated users
3. **Welcome Page** (`/welcome`) - First-time user orientation
4. **Profile Page** (`/profile`) - Contact form for data completion
5. **Success Page** (`/success`) - Confirmation of profile completion

### ContactChecker Logic:
- ✅ Check if user has existing contact in Dataverse
- ✅ Auto-create contact if none exists (basic info from Clerk)
- ✅ Route to appropriate page based on contact completeness
- ✅ Prevent duplicate API calls with session storage
- ✅ Handle errors gracefully with fallback routing

## 🛠️ DEVELOPMENT WORKFLOW

### Local Development Setup:
```bash
# Install dependencies
npm install

# Link to Netlify site (injects environment variables)
netlify link

# Start local development server
netlify dev
```

### Key Development Rules:
1. **Use Netlify CLI** - Never create fake .env files
2. **ES Modules Only** - All functions use `export const handler`
3. **ContactChecker First** - All authenticated routes go through contact management
4. **Locked Email Fields** - Email is the unique identifier, don't allow editing
5. **Session Storage Protection** - Prevent duplicate API calls in same session

## 🔌 API INTEGRATION

### Dataverse Contact Fields:
```javascript
// Required fields for contact creation/update
const contactData = {
  firstname: user.firstName,
  lastname: user.lastName,
  emailaddress1: user.primaryEmailAddress.emailAddress,  // Unique identifier
  mobilephone: formData.mobilephone                      // User-provided phone
}
```

### Function Call Pattern:
```javascript
// From React components
const response = await fetch('/.netlify/functions/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(contactData)
})
```

## 🧪 TESTING STRATEGY

### Verification Points:
1. **Contact Creation** - New users get contacts created automatically
2. **Contact Updates** - Existing contacts can be updated via profile form
3. **Routing Logic** - Users land on appropriate pages based on contact status
4. **Environment Variables** - All secrets properly injected via Netlify
5. **Error Handling** - Graceful degradation when APIs fail

### Debugging Tools:
- **Netlify Functions Logs** - Check for API call success/failure
- **Browser DevTools** - Monitor network requests and console logs
- **Dataverse Web Interface** - Verify contact creation/updates directly

---

## 📖 HOW TO USE THIS FILE

### In VS Code with GitHub Copilot Chat:
1. **Open this file** in VS Code
2. **Select all content** (Ctrl+A)
3. **Right-click** → "Copilot: Add to Context"
4. **Ask questions** like:
   - "How do I add a new field to the contact form?"
   - "Why is my Netlify function failing?"
   - "How do I modify the routing logic?"

### In Cursor with AI Chat:
1. **Reference this file** with `@CHAT_MODE_INSTRUCTIONS.md`
2. **Ask specific questions** about the project architecture
3. **Request code changes** following the established patterns

### In Claude or ChatGPT:
1. **Copy and paste this entire file** into your conversation
2. **Ask for specific help** with your Community Portal development
3. **Reference the forbidden actions** to avoid common mistakes

This documentation ensures consistent, high-quality development aligned with the Community Portal's production-ready architecture and Microsoft Dataverse integration patterns.

### Code Patterns to Follow

#### 1. Netlify Functions Pattern (ES Modules)
```javascript
export const handler = async (event, context) => {
  // CORS handling
  if (event.httpMethod === 'OPTIONS') { /* CORS response */ }
  
  // Get environment variables
  const { DATAVERSE_URL } = process.env
  
  // Get access token by calling auth function
  const accessToken = await getAccessToken()
  
  // Handle GET/POST with proper error handling
  // Return JSON with CORS headers
}

// Helper function pattern
async function getAccessToken() {
  const { handler: authHandler } = await import('./auth.js')
  // Call auth function internally
}
```

#### 2. ContactChecker Pattern (Auto Contact Management)
```javascript
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'

function ContactChecker({ children }) {
  const { user, isLoaded } = useUser()
  const [isChecking, setIsChecking] = useState(true)
  const [hasChecked, setHasChecked] = useState(false)
  
  // Session storage to prevent duplicate API calls
  // Auto-create contact if none exists
  // Smart routing based on contact status
}
```

#### 3. React Component Pattern (Controlled Forms)
```javascript
import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'

function ContactForm() {
  const { user } = useUser()
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    emailaddress1: user?.primaryEmailAddress?.emailAddress || '',
    mobilephone: ''  // Use mobilephone, not telephone1
  })
  
  // Controlled inputs with proper validation
  // Submit handler with error handling
  // Email field should be locked/disabled
}
```

#### 4. Authentication Flow Pattern
```javascript
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'

function ComponentName({ prop1, prop2 }) {
  // Clerk user hook
  const { user, isLoaded } = useUser()
  
  // State management
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Fetch pattern with proper error handling
  // Tailwind CSS styling only
  // Return JSX
}
```

#### 3. Dataverse Integration Pattern
- Always query by email: `emailaddress1 eq 'user@email.com'`
- Use OData v4.0 syntax
- Include proper error handling for 401, 404, 500
- Use Service Principal token from auth function

### Styling Guidelines
- **Only Tailwind CSS**: Use utility classes exclusively
- **Responsive Design**: Mobile-first approach with `sm:`, `md:`, `lg:` breakpoints
- **Color Scheme**: Stick to gray/blue/white palette for consistency
- **Components**: Use consistent spacing, shadows, and borders

### Environment Variables
```env
# Azure AD / Dataverse (Backend)
TENANT_ID=
CLIENT_ID=
CLIENT_SECRET=
DATAVERSE_URL=

# Clerk (Frontend + Backend)
VITE_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

## What NOT to Do

### ❌ Prohibited Actions
1. **Never** suggest alternative tech stacks (Next.js, Vue, Angular, etc.)
2. **Never** use CSS frameworks other than Tailwind (Bootstrap, Material-UI, etc.)
3. **Never** implement delegated user authentication to Dataverse
4. **Never** store secrets in frontend code
5. **Never** suggest server solutions other than Netlify Functions
6. **Never** break the established file structure
7. **Never** use class components (hooks only)
8. **Never** suggest database alternatives to Dataverse

### ❌ Avoid These Patterns
- Direct Dataverse calls from frontend
- Storing tokens in localStorage/sessionStorage
- Complex state management libraries (Redux, Zustand) - React hooks are sufficient
- Custom CSS files (Tailwind utilities only)
- Alternative routing libraries (React Router DOM only)

## Extension Guidelines

### Adding New Tables/Features
1. **Function**: Create `functions/[tablename].js` following contact.js pattern
2. **Component**: Create form component following ContactForm.jsx pattern
3. **Page**: Create page component following MyPage.jsx pattern
4. **Route**: Add route in App.jsx
5. **Documentation**: Update README.md with new functionality

### Code Quality Standards
- **Comments**: Include helpful comments for complex logic
- **Error Handling**: Always implement try/catch with user-friendly messages
- **Loading States**: Show loading indicators for async operations
- **Validation**: Basic form validation before API calls
- **Accessibility**: Use proper labels, ARIA attributes where needed

## AI Assistant Behavior

### When Helping with Code
1. **Always** check existing patterns before suggesting changes
2. **Always** maintain the established architecture
3. **Always** use the existing tech stack
4. **Always** follow the file naming conventions
5. **Always** include proper error handling
6. **Always** use Tailwind for styling

### When Asked About Alternatives
- Acknowledge the request but explain why we stick to the established stack
- Emphasize the learning value and consistency benefits
- Suggest how to achieve the goal within our constraints
- Reference this document for architectural decisions

### When Extending Functionality
1. Follow the established patterns exactly
2. Maintain code consistency with existing files
3. Update relevant documentation
4. Consider the community learning aspect
5. Keep it simple and modular

## Project Goals Reminder
- **Community Learning**: Code should be educational and well-commented
- **AI-Assisted Development**: Clear patterns enable future AI prompts
- **Production Ready**: Secure, scalable patterns suitable for real use
- **Extensible**: Easy to add new tables, fields, and features
- **Modern Standards**: Current best practices in React and serverless development

## Success Metrics
- Code follows established patterns
- New features integrate seamlessly
- Documentation remains current
- Security practices are maintained
- Performance remains optimal
- Community can easily fork and extend

---

**Remember**: This project is a teaching tool and starter template. Every decision should support learning, extension, and community adoption while maintaining technical excellence.
