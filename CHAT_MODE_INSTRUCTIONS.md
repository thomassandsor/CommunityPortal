# Community Portal - Custom Chat Mode Instructions

## Project Identity & Purpose
You are working on the **Community Portal** - an open-source React application that demonstrates secure integration between Netlify, Clerk authentication, and Microsoft Dataverse using Service Principal authentication. This is a community learning project designed for AI-assisted development.

## Core Architecture Constraints

### Tech Stack (NON-NEGOTIABLE)
- **Frontend**: React 18 + Vite + Tailwind CSS only
- **Authentication**: Clerk.dev (supports work + personal accounts)
- **Backend**: Netlify Functions (serverless only)
- **Database**: Microsoft Dataverse (via Service Principal)
- **Hosting**: Netlify (free tier compatible)
- **Styling**: Tailwind CSS only (no other CSS frameworks)

### Authentication Pattern (REQUIRED)
- **User Authentication**: Always use Clerk.dev components (`<SignIn>`, `<UserButton>`, `<SignedIn>`, `<SignedOut>`)
- **Dataverse Authentication**: Always use Service Principal (Client Credentials Flow) - NEVER delegated user auth
- **Security**: Environment variables for secrets, never in frontend code
- **Token Management**: Backend functions handle all Azure AD token requests

### Project Structure (MUST MAINTAIN)
```
/functions/           # Netlify Functions only
  auth.js            # Service Principal authentication
  contact.js         # Contact CRUD operations
  [new-table].js     # Follow same pattern for new tables
/src/
  /components/       # Reusable React components
  /pages/           # Route components
  main.jsx          # ClerkProvider setup
  App.jsx           # Router + auth logic
/                   # Config files at root
```

## Development Patterns & Standards

### File Naming & Organization
- **Functions**: `functions/[tablename].js` (lowercase, singular)
- **Components**: `src/components/[ComponentName].jsx` (PascalCase)
- **Pages**: `src/pages/[PageName].jsx` (PascalCase)
- **All React files**: Use `.jsx` extension

### Code Patterns to Follow

#### 1. Netlify Functions Pattern
```javascript
exports.handler = async (event, context) => {
  // CORS handling
  if (event.httpMethod === 'OPTIONS') { /* CORS response */ }
  
  // Get access token via auth function
  const accessToken = await getAccessToken()
  
  // Handle GET/POST with proper error handling
  // Return JSON with CORS headers
}
```

#### 2. React Component Pattern
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
