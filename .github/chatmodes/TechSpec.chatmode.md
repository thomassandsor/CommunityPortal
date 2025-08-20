```chatmode
---
description: 'Community Portal Development Mode - Specialized for React + Dataverse integration with strict architectural constraints'
tools: []
---

# Community Portal Development Mode

You are working on the **Community Portal** - an open-source React application demonstrating secure integration between Netlify, Clerk authentication, and Microsoft Dataverse using Service Principal authentication.

## REQUIRED Tech Stack (NON-NEGOTIABLE)
- **Frontend**: React 18 + Vite + Tailwind CSS ONLY
- **Authentication**: Clerk.dev (work + personal accounts)
- **Backend**: Netlify Functions (serverless ONLY)
- **Database**: Microsoft Dataverse (Service Principal auth ONLY)
- **Hosting**: Netlify (free tier compatible)
- **Styling**: Tailwind CSS ONLY (no other frameworks)

## Project Structure (MUST MAINTAIN)
```
/functions/           # Netlify Functions only
  auth.js            # Service Principal authentication
  contact.js         # Contact CRUD operations
/src/
  /components/       # Reusable React components (.jsx)
  /pages/           # Route components (.jsx)
  main.jsx          # ClerkProvider setup
  App.jsx           # Router + auth logic
```

## Authentication Pattern (REQUIRED)
- **User Auth**: Clerk.dev components (`<SignIn>`, `<UserButton>`, `<SignedIn>`, `<SignedOut>`)
- **Dataverse Auth**: Service Principal (Client Credentials Flow) - NEVER delegated user auth
- **Security**: Environment variables for secrets, NEVER in frontend

## FORBIDDEN Actions
❌ Alternative frameworks (Next.js, Vue, Angular)
❌ Other CSS frameworks (Bootstrap, Material-UI)
❌ Delegated user authentication to Dataverse
❌ Storing secrets in frontend code
❌ Alternative hosting solutions
❌ Breaking established file structure
❌ Class components (hooks only)
❌ Alternative databases to Dataverse

## Code Patterns to Follow

### Netlify Functions Pattern
```javascript
exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') { /* CORS */ }
  const accessToken = await getAccessToken()
  // Handle GET/POST with proper error handling
}
```

### React Component Pattern
```javascript
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'

function ComponentName({ props }) {
  const { user, isLoaded } = useUser()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Tailwind CSS styling only
}
```

## AI Assistant Behavior
- **ALWAYS** maintain established architecture
- **ALWAYS** use existing tech stack
- **ALWAYS** follow file naming conventions (.jsx for React)
- **ALWAYS** include proper error handling
- **ALWAYS** use Tailwind for styling
- When asked for alternatives: acknowledge but explain constraints
- When extending: follow established patterns exactly
- Prioritize consistency and community learning value

## Extension Guidelines
1. New tables: Create `functions/[tablename].js` following contact.js pattern
2. New components: Follow ContactForm.jsx pattern
3. New pages: Follow MyPage.jsx pattern
4. Update README.md for new functionality
5. Maintain modular, AI-friendly code structure

Remember: This is a teaching tool for community learning and AI-assisted development.
```