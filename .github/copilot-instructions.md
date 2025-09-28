# Community Portal - AI Copilot Instructions

## Project Overview
This is a **production-ready React application** demonstrating secure integration between Netlify, Clerk authentication, and Microsoft Dataverse. The system features a **generic entity management architecture** that can handle unlimited custom entities without code changes.

**Key Innovation**: Universal CRUD operations through dynamic entity configuration, eliminating the need for entity-specific code. Add new Dataverse entities by creating configuration records—no coding required.

## Key Architecture Patterns

### 🏗️ Generic Entity System (Core Innovation)
The system uses **dynamic entity configuration** instead of hardcoded entity logic:

```javascript
// ✅ Dynamic entity operations via single endpoint
GET /.netlify/functions/generic-entity?entity=Idea&mode=list
GET /.netlify/functions/entity-config?entity=Idea

// ✅ Universal React components handle any entity
<EntityEdit entityName="Idea" />  // Works for Ideas, Projects, Cases, etc.
```

**Critical Files:**
- `functions/generic-entity.js` - Universal CRUD operations for ANY entity
- `functions/entity-config.js` - Dynamic entity metadata from Dataverse
- `src/pages/generic/EntityEdit.jsx` - Universal form component
- `src/pages/generic/EntityList.jsx` - Universal list component

### 🔐 Security Architecture (Multi-Layer)
```javascript
// Layer 1: Clerk authentication (frontend + backend validation)
const user = await validateSimpleAuth(event)

// Layer 2: Contact GUID requirement (server-side user scoping)
const contactGuid = event.queryStringParameters?.contactGuid
if (!contactGuid) return 401

// Layer 3: Dataverse filtering (per-request data isolation)
const filter = `statecode eq 0 and _cp_contact_value eq ${userContact.contactid}`
```

### 🔌 Microsoft Dataverse Integration Patterns

#### Service Principal Authentication (Backend-to-Backend)
```javascript
// functions/auth.js - OAuth 2.0 Client Credentials Flow for Dataverse API access
const tokenEndpoint = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`
const scope = `${DATAVERSE_URL}/.default`
// Returns cached access token for Dataverse API calls (NOT user authentication)
```

#### OData Lookup Field Expansion (Critical Pattern)
```javascript
// ✅ CORRECT: Use navigation property names in $expand
const expand = 'cp_Contact($select=fullname),cp_Organization($select=name)'

// ❌ WRONG: Using field names (causes 400 error)  
const expand = '_cp_contact_value($select=fullname)'

// Navigation property mapping pattern
const navigationMap = {
  '_cp_contact_value': 'cp_Contact',
  '_cp_organization_value': 'cp_Organization'
}
```

## Development Workflow

### 🚀 Local Development (Required Pattern)
```bash
# CRITICAL: Always use Netlify CLI - this is the ONLY way to run locally
netlify dev  # Injects environment variables, runs functions locally

# Verify setup before development
netlify status  # Must show linked site for env vars to work
```

**Environment Variables**: Functions only work with real environment variables—they won't work locally without `netlify dev`.

### 📝 Adding New Entities (Zero-Code Pattern)
1. **Create entity in Dataverse** (cp_project, cp_case, etc.)
2. **Add configuration record** in `cp_entityconfigurations` table
3. **System automatically provides**: Menu items, CRUD operations, security filtering, form rendering

No code changes required! The generic system handles everything.

### 🔍 Debugging Lookup Fields (Common Issue)
```javascript
// Check backend OData query construction
console.log('🔍 OData URL:', url)
// Should show: ?$expand=cp_Contact($select=fullname)

// Verify frontend navigation property mapping  
console.log('🔍 Navigation properties:', navigationMap)
// Should map: { '_cp_contact_value': 'cp_Contact' }

// Test lookup display function
console.log('👁️ Display value:', getLookupDisplayValue(formData, fieldName))
// Should return actual name, not "Not provided"
```

## File Structure & Conventions

### Functions (Serverless Backend)
- `auth.js` - Service Principal token management
- `generic-entity.js` - **Universal CRUD for all entities** 
- `entity-config.js` - Dynamic entity metadata
- `contact.js` - Legacy contact-specific operations
- All functions use **ES modules** (`export const handler`)

### React Components (Frontend)
- `src/pages/generic/` - **Universal entity components**
- `src/components/shared/ContactChecker.jsx` - **Auto contact management**
- `src/components/forms/SimpleRichTextEditor.jsx` - Native rich text (no deps)

### Routing Pattern
```javascript
// Generic routes handle any entity type
<Route path="/entity/:entityName" element={<EntityList />} />
<Route path="/entity/:entityName/edit" element={<EntityEdit />} />
<Route path="/entity/:entityName/create" element={<EntityEdit />} />
```

## Code Patterns to Follow

### Netlify Function Structure
```javascript
export const handler = async (event) => {
  // CORS handling for OPTIONS requests
  if (event.httpMethod === 'OPTIONS') { /* return CORS headers */ }
  
  // Authentication validation
  const user = await validateSimpleAuth(event)
  
  // SECURITY: Contact GUID requirement (server-side user scoping)
  const contactGuid = event.queryStringParameters?.contactGuid
  if (!contactGuid) return createAuthErrorResponse('Contact GUID required', 401)
  
  // Get environment variables
  const { DATAVERSE_URL } = process.env
  
  // Business logic with error handling
  try {
    // Implementation
  } catch (error) {
    return createAuthErrorResponse(`Internal server error: ${error.message}`, 500)
  }
}
```

**Critical Function Utilities**: Always import from `auth-utils.js`:
- `validateSimpleAuth()` - User authentication
- `createAuthErrorResponse()` - Consistent error responses  
- `createSuccessResponse()` - Consistent success responses

### React Component Structure  
```javascript
import { useState, useEffect } from 'react'
import { useUser, useAuth } from '@clerk/clerk-react'
import { getCurrentUserContactGuid } from '../../utils/contactUtils'

function ComponentName() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  
  // State management
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // SECURITY: Always include Contact GUID in API requests
  const makeSecureApiCall = async (url, options = {}) => {
    const token = await getToken()
    const contactGuid = getCurrentUserContactGuid()
    
    if (!contactGuid) throw new Error('Contact GUID required')
    
    const secureUrl = `${url}${url.includes('?') ? '&' : '?'}contactGuid=${encodeURIComponent(contactGuid)}`
    
    return fetch(secureUrl, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
  }
  
  // Tailwind CSS styling only
  // Return JSX
}
```

**Contact Utils Pattern**: Always use `getCurrentUserContactGuid()` and `getCurrentUserContact()` from `contactUtils.js` for secure data access.

### Lookup Field Display (Critical Pattern)
```javascript
// Frontend: Map field names to navigation properties
const getLookupDisplayValue = (formData, fieldName) => {
  const navigationMap = {
    '_cp_contact_value': 'cp_Contact',
    '_cp_organization_value': 'cp_Organization'
  }
  
  const navProperty = navigationMap[fieldName]
  if (navProperty && formData[navProperty]) {
    return formData[navProperty].fullname || formData[navProperty].name
  }
  return 'Not provided'
}

// Backend: Build navigation property expansions
if (field.endsWith('_value')) {
  const navProperty = getNavigationProperty(field)  // cp_contact -> cp_Contact
  expansions.push(`${navProperty}($select=fullname)`)
}
```

## Critical "Don'ts"

### ❌ Never Use These Patterns
- **Alternative frameworks** (Next.js, Vue, Angular) - Stick to Vite + React
- **CSS frameworks** other than Tailwind (Bootstrap, Material-UI)
- **Direct Dataverse calls** from frontend - Always use Netlify functions
- **Hardcoded entity logic** - Use the generic entity system
- **Field names in OData $expand** - Use navigation properties
- **Unquoted GUIDs** in OData filters - Always wrap in single quotes
- **API calls without Contact GUID** - Security requirement for all data operations

### ❌ Development Anti-Patterns
```javascript
// DON'T: Hardcode entity-specific logic
if (entityName === 'cp_idea') { /* specific logic */ }

// DO: Use dynamic entity configuration
const entityConfig = await getEntityConfig(entityName)
```

## Environment Variables (Required)
```env
# Service Principal for Dataverse API Access (Backend only - NOT user auth)
TENANT_ID=your-azure-tenant-id
CLIENT_ID=your-service-principal-client-id  
CLIENT_SECRET=your-service-principal-secret
DATAVERSE_URL=https://yourorg.crm.dynamics.com

# Clerk.dev User Authentication (Frontend + Backend)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

## Recent Critical Fixes (Context for Debugging)

### Lookup Field Display Issue (SOLVED)
- **Problem**: Lookup fields showed "Not provided" instead of actual names
- **Root Cause**: Using field names (`_cp_contact_value`) instead of navigation properties (`cp_Contact`) in OData $expand
- **Solution**: Dynamic navigation property mapping + proper field detection

### Generic Entity System (IMPLEMENTED)  
- **Achievement**: System now handles unlimited entities via configuration
- **Pattern**: Single set of components + functions handle any entity type
- **Benefit**: Add new entities without touching code

### Security Enhancement (COMPLETED)
- **Pattern**: Contact GUID required for all API requests
- **Implementation**: Server-side data filtering per user
- **Result**: Users can only access their own data

## Integration Points

### Clerk.dev → React App (User Authentication Only)
```javascript
// main.jsx - Clerk is the ONLY authentication provider for users
<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
  <BrowserRouter><App /></BrowserRouter>
</ClerkProvider>
```

### Netlify Functions → Dataverse (Service Principal Only)
```javascript
// Service Principal authentication for API access (NOT user authentication)
const accessToken = await getAccessToken()  // From auth.js
const response = await fetch(`${DATAVERSE_URL}/api/data/v9.0/entities`, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
})
```

### React → Netlify Functions (Clerk Tokens)
```javascript
// API call pattern using Clerk tokens for user verification
const token = await getToken()  // Clerk token for function auth
const response = await fetch('/.netlify/functions/generic-entity', {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

This architecture enables rapid development of secure, production-ready community portals with Microsoft Dataverse integration. The generic entity system is the key innovation that makes this starter truly reusable and AI-development friendly.
