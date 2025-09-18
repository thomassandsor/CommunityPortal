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
11. **Removing .netlify directory** - NEVER suggest deleting this directory (contains important cache and config)
12. **Skipping Netlify link verification** - Always check `netlify status` during setup to ensure proper site linking
13. **Incorrect OData expand syntax** - Use navigation property names, NOT field names ending in _value
14. **Hardcoded entity configurations** - Use dynamic entity-config.js for all entity metadata
15. **Direct field name references in OData** - Always use proper navigation properties for lookups
16. **Fallback forms or fallback functions** - System must fail clearly when configuration is missing, NO silent fallbacks

### FIELD NAMING REQUIREMENTS:
- ✅ `emailaddress1` (Dataverse standard)
- ✅ `mobilephone` (Dataverse standard)
- ✅ `firstname`, `lastname` (Dataverse standard)
- ❌ `email`, `phone`, `telephone1` (Incorrect field names)

### DATAVERSE ODATA REQUIREMENTS:
- ✅ Navigation properties for expand: `cp_Contact($select=fullname)` 
- ✅ Single quotes around GUIDs: `'61f225a9-007e-f011-b4cb-7ced8d5de1dd'`
- ✅ Proper field detection for lookups: Fields ending in `_value` are lookup fields
- ❌ Field names in expand: `_cp_contact_value($select=fullname)` (WRONG)
- ❌ Unquoted GUIDs in filters (will cause 400 errors)
- ❌ Missing navigation property mappings in frontend components

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
│   │   ├── contacts/            # Contact-specific pages
│   │   │   └── ContactEdit.jsx  # Contact edit form
│   │   ├── generic/             # Generic entity pages
│   │   │   └── EntityEdit.jsx   # Dynamic entity CRUD form
│   │   ├── organization/        # Organization pages
│   │   │   └── Organization.jsx # Organization management
│   │   └── shared/              # Shared pages
│   │       ├── Landing.jsx      # Public landing page
│   │       ├── Welcome.jsx      # Post-login welcome
│   │       └── Success.jsx      # Confirmation page
│   └── components/
│       ├── forms/               # Form components
│       │   ├── ContactForm.jsx  # Contact data form
│       │   ├── SimpleRichTextEditor.jsx # Native rich text editing
│       │   └── SimpleRichTextViewer.jsx # Safe rich text display
│       └── shared/              # Shared components
│           ├── ContactChecker.jsx # Auto contact management
│           ├── DynamicSidebar.jsx # Dynamic navigation menu
│           └── Sidebar.jsx      # Static navigation component
├── functions/
│   ├── auth-utils.js            # Authentication utilities
│   ├── auth.js                  # Service Principal authentication
│   ├── contact.js               # Dataverse contact operations
│   ├── entity-config.js         # Dynamic entity configurations
│   ├── generic-entity.js        # Generic CRUD operations
│   └── organization.js          # Organization operations
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
- ✅ Handle errors gracefully with clear error messages

## 🛠️ DEVELOPMENT WORKFLOW

### Local Development Setup:
```bash
# Step 1: Install dependencies
npm install

# Step 2: CRITICAL - Verify Netlify site linking
netlify status

# Step 3: Link to Netlify site if not already linked (injects environment variables)
netlify link

# Step 4: Start local development server (DO NOT use --offline in production)
netlify dev
```

### Setup Verification Checklist:
✅ **Check `netlify status`** - Ensures site is properly linked to get environment variables  
✅ **Verify environment variables injection** - Look for "Injected project settings env vars" message  
✅ **Confirm .netlify directory exists** - Contains important cache and configuration (NEVER delete)  
✅ **Test function loading** - All functions should show "Loaded function [name]" messages  

### Key Development Rules:
1. **Use Netlify CLI** - Never create fake .env files
2. **ES Modules Only** - All functions use `export const handler`
3. **ContactChecker First** - All authenticated routes go through contact management
4. **Locked Email Fields** - Email is the unique identifier, don't allow editing
5. **Session Storage Protection** - Prevent duplicate API calls in same session
6. **NEVER Delete .netlify Directory** - Contains critical cache and configuration files
7. **Always Verify Netlify Linking** - Run `netlify status` before development to ensure proper setup

## 🚀 AI ASSISTANT TERMINAL WORKFLOW (CRITICAL)

### The Challenge
AI assistants often get confused when managing long-running dev servers and executing other terminal commands, leading to:
- Starting multiple dev servers accidentally
- Trying to run commands in the server terminal
- Forgetting that the server is running
- Terminal session conflicts

### ✅ SOLUTION: Background Server + Separate Command Terminals

#### Step 1: Start Dev Server in Background
```bash
# Use isBackground=true to start server without blocking terminal
run_in_terminal(
  command="netlify dev",
  isBackground=true,
  explanation="Starting Netlify dev server in background mode"
)
# Returns server terminal ID (e.g., bdb26b73-9f44-461f-a146-dd1ce7253c8e)
```

#### Step 2: Execute Other Commands in Separate Sessions
```bash
# Use isBackground=false for all other commands (creates new terminal sessions)
run_in_terminal(
  command="node -c functions/generic-entity.js",
  isBackground=false,
  explanation="Checking syntax in separate terminal session"
)
```

#### Step 3: Monitor Server Status Anytime
```bash
# Check server status using saved terminal ID
get_terminal_output(id="bdb26b73-9f44-461f-a146-dd1ce7253c8e")
```

### 📋 AI Assistant Standard Operating Procedure

#### When Starting Development Session:
1. ✅ **Always start dev server with `isBackground=true`**
2. ✅ **Save and remember the server terminal ID**
3. ✅ **Verify server starts successfully via `get_terminal_output`**

#### When Running Other Commands:
1. ✅ **Always use `isBackground=false` for non-server commands**
2. ✅ **Each command gets a fresh terminal session**
3. ✅ **No terminal session conflicts**

#### When Checking Server Status:
1. ✅ **Use `get_terminal_output(server_id)` to check server health**
2. ✅ **Look for "Local dev server ready: http://localhost:8888"**
3. ✅ **Check for function loading errors or syntax issues**

### 🔄 Benefits of This Approach
- **No Terminal Confusion** - Server runs in background, commands in separate sessions
- **Always Available Server** - Can check server status anytime without interruption
- **Clean Command Execution** - Each command gets a fresh, unblocked terminal
- **Error Isolation** - Syntax errors don't kill the development workflow
- **Persistent Server** - Dev server continues running through entire session

### ❌ What NOT to Do
- **Never start dev server with `isBackground=false`** (blocks terminal)
- **Never run other commands with server terminal ID** (conflicts with running server)
- **Never forget to save server terminal ID** (loses ability to monitor)
- **Never start multiple dev servers** (port conflicts)

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

### Generic Entity Pattern:
```javascript
// From React components - Generic entity operations
const response = await fetch(`/.netlify/functions/generic-entity?entity=${entityName}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(entityData)
})

// Get entity configuration
const configResponse = await fetch(`/.netlify/functions/entity-config?entity=${entityName}`)
const entityConfig = await configResponse.json()
```

### OData Lookup Field Integration (CRITICAL PATTERNS):
```javascript
// CORRECT: Navigation property expansion for lookup fields
const odataQuery = `?$expand=cp_Contact($select=fullname)&$filter=_cp_contact_value eq '${guidValue}'`

// CORRECT: Frontend lookup value display
const getLookupDisplayValue = (formData, fieldName) => {
  // Map field names to navigation properties
  const navigationProperties = {
    '_cp_contact_value': 'cp_Contact',
    '_cp_organization_value': 'cp_Organization'
  }
  
  const navProperty = navigationProperties[fieldName]
  if (navProperty && formData[navProperty]) {
    return formData[navProperty].fullname || formData[navProperty].name
  }
  return 'Not provided'
}

// CORRECT: Detect lookup fields in structured forms
if (field.name.endsWith('_value')) {
  field.controlType = 'lookup'  // Force recognition as lookup field
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

### Critical Debugging Patterns (From Recent Issues)

#### Lookup Field Debugging Checklist
```javascript
// 1. Verify OData expansion syntax in backend
console.log('🔍 OData URL:', odataUrl)
// Should show: /entities?$expand=cp_Contact($select=fullname)
// NOT: /entities?$expand=_cp_contact_value($select=fullname)

// 2. Check backend response structure
console.log('📦 Entity data:', entity)
// Should show: { _cp_contact_value: "guid", cp_Contact: { fullname: "Name" } }

// 3. Verify frontend navigation property mapping
console.log('🗺️ Navigation properties:', navigationProperties)
// Should map: { '_cp_contact_value': 'cp_Contact' }

// 4. Test lookup display function
console.log('👁️ Display value:', getLookupDisplayValue(formData, '_cp_contact_value'))
// Should return actual name, not "Not provided"

// 5. Check form field detection
console.log('🎯 Field control type:', field.controlType)
// Fields ending in '_value' should have controlType='lookup'
```

#### Common Error Patterns and Solutions
```javascript
// ❌ Error: "Invalid expand" (400 status)
// Cause: Using field name instead of navigation property
// Fix: Use navigation property name in $expand

// ❌ Error: Lookup shows "Not provided" despite correct data
// Cause: Frontend not recognizing lookup fields in structured forms
// Fix: Force controlType='lookup' for fields ending in '_value'

// ❌ Error: "Invalid filter" (400 status)  
// Cause: Unquoted GUID in OData filter
// Fix: Wrap GUID values in single quotes

// ❌ Error: Lookup data missing from response
// Cause: Navigation property not included in $expand
// Fix: Add navigation property to expansion list
```

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

#### 2. Generic Entity Function Pattern (NEW)
```javascript
// functions/generic-entity.js - Universal CRUD operations
export const handler = async (event) => {
  const user = await validateSimpleAuth(event)
  const entitySlugOrName = event.queryStringParameters?.entity
  
  // Get entity configuration dynamically
  const entityConfig = await getEntityConfig(entitySlugOrName)
  
  // Build OData query with proper expansion for lookup fields
  if (entityConfig.fields.some(f => f.controlType === 'lookup')) {
    const expansions = entityConfig.fields
      .filter(f => f.controlType === 'lookup')
      .map(f => `${f.navigationProperty}($select=fullname,name)`)
    odataUrl += `?$expand=${expansions.join(',')}`
  }
  
  // Return with proper CORS headers
}
```

#### 3. Dynamic Entity Configuration Pattern (NEW)
```javascript
// functions/entity-config.js - Dynamic entity metadata
export const handler = async (event) => {
  // Fetch entity configurations from Dataverse
  const configurationsQuery = `cp_entityconfigurations?$select=cp_name,cp_displayname,cp_fields`
  
  // Cache configurations for performance
  const cacheKey = `config_${entityName}`
  if (configCache.has(cacheKey)) {
    return configCache.get(cacheKey)
  }
  
  // Return structured entity metadata
  return {
    name: config.cp_name,
    displayName: config.cp_displayname,
    fields: JSON.parse(config.cp_fields || '[]')
  }
}
```

#### 4. React Generic Entity Component Pattern (NEW)
```javascript
// src/pages/generic/EntityEdit.jsx - Universal entity editing
import { useState, useEffect } from 'react'
import SimpleRichTextEditor from '../../components/forms/SimpleRichTextEditor'

function EntityEdit() {
  // Mode detection: create vs edit vs view
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState(null)
  
  // Session storage for entity selection persistence
  useEffect(() => {
    const storedSelection = sessionStorage.getItem(`selected_${entityName}`)
    if (storedSelection) {
      const selection = JSON.parse(storedSelection)
      setSelectedEntity(selection.data)
      setIsCreateMode(false)
    }
  }, [entityName])
  
  // Dynamic form rendering based on metadata
  const renderField = (field) => {
    switch (field.controlType) {
      case 'richtext':
        return <SimpleRichTextEditor value={formData[field.name]} onChange={...} />
      case 'lookup':
        return <div>{getLookupDisplayValue(formData, field.name)}</div>
      default:
        return <input type="text" value={formData[field.name]} onChange={...} />
    }
  }
}
```

#### 5. Lookup Field Display Pattern (CRITICAL)
```javascript
// Lookup field value extraction from expanded OData results
const getLookupDisplayValue = (formData, fieldName) => {
  console.log('🔍 Looking up display value for:', fieldName, formData)
  
  // Navigation property mapping (field name -> navigation property)
  const navigationProperties = {
    '_cp_contact_value': 'cp_Contact',
    '_cp_organization_value': 'cp_Organization',
    '_cp_idea_value': 'cp_Idea'
  }
  
  const navProperty = navigationProperties[fieldName]
  if (navProperty && formData[navProperty]) {
    const lookupData = formData[navProperty]
    // Try common display name fields
    return lookupData.fullname || lookupData.name || lookupData.cp_name || 'Found but no display name'
  }
  
  return 'Not provided'
}

// Force lookup field recognition in structured forms
const collectFormFields = (formXml) => {
  // Parse form XML and detect lookup fields
  fields.forEach(field => {
    if (field.name.endsWith('_value')) {
      field.controlType = 'lookup'  // Critical for proper rendering
    }
  })
}
```

#### 6. ContactChecker Pattern (Auto Contact Management)
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

#### 7. Rich Text Editor Pattern (UPDATED)
```javascript
// components/forms/SimpleRichTextEditor.jsx - Native contentEditable implementation
function SimpleRichTextEditor({ value, onChange, placeholder, readOnly = false }) {
  const modules = {
    toolbar: [
      'bold', 'italic', 'underline',
      'h1', 'h2', 'h3',
      'ul', 'ol',
      'link'
    ]
  }
  
  return (
    <div className="border border-gray-300 rounded-md">
      {!readOnly && <Toolbar />}
      <div
        contentEditable={!readOnly}
        className="min-h-[200px] p-3 prose max-w-none"
        onInput={(e) => onChange(e.target.innerHTML)}
        dangerouslySetInnerHTML={{ __html: value || '' }}
      />
    </div>
  )
}
}
```

#### 8. Authentication Flow Pattern
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

#### 9. Dataverse Integration Pattern
- Always query by email: `emailaddress1 eq 'user@email.com'`
- Use OData v4.0 syntax with proper navigation properties
- Include proper error handling for 401, 404, 500
- Use Service Principal token from auth function
- **CRITICAL**: For lookup fields, use navigation property names in $expand, NOT field names
- **REQUIRED**: Quote GUID values in OData filters: `'61f225a9-007e-f011-b4cb-7ced8d5de1dd'`
- **PATTERN**: Map `_fieldname_value` to navigation property `FieldName` (e.g., `_cp_contact_value` → `cp_Contact`)

### Recent Critical Fixes and Patterns (From Latest Development)

#### OData Lookup Field Expansion (SOLVED ISSUE)
```javascript
// ❌ WRONG - Using field name in expand (causes 400 error)
const expand = '_cp_contact_value($select=fullname)'

// ✅ CORRECT - Using navigation property name
const expand = 'cp_Contact($select=fullname)'

// Navigation property mapping pattern
const getNavigationProperty = (fieldName) => {
  // Remove prefix and suffix, capitalize first letter
  return fieldName.replace(/^_(.+)_value$/, (match, name) => {
    return name.split('_').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('')
  })
}
```

#### Frontend Lookup Field Detection (SOLVED ISSUE)
```javascript
// Problem: Structured forms didn't recognize lookup fields
// Solution: Force controlType based on field name pattern

// In form metadata collection
fields.forEach(field => {
  if (field.name.endsWith('_value')) {
    field.controlType = 'lookup'  // Critical fix
  }
})

// In form rendering
if (field.controlType === 'lookup') {
  const displayValue = getLookupDisplayValue(formData, field.name)
  return <div className="form-control">{displayValue}</div>
}
```

#### Session Storage Entity Selection Pattern (NEW)
```javascript
// Store selected entity for edit mode
const handleEditEntity = (entity) => {
  sessionStorage.setItem(`selected_${entityName}`, JSON.stringify({
    id: entity[entityConfig.primaryKey],
    data: entity
  }))
  navigate(`/entity/${entityName}/edit`)
}

// Retrieve in EntityEdit component
useEffect(() => {
  const storedSelection = sessionStorage.getItem(`selected_${entityName}`)
  if (storedSelection) {
    const selection = JSON.parse(storedSelection)
    setSelectedEntity(selection.data)
    setEntityId(selection.id)
    setIsCreateMode(false)
  }
}, [entityName])
```

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

### Dependencies
```json
{
  "Note": "Rich text editing now uses native browser APIs - no external dependencies required"
}
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
- **Using field names in OData $expand** - Always use navigation properties
- **Unquoted GUIDs in OData filters** - Always wrap GUIDs in single quotes
- **Hardcoded entity configurations** - Use dynamic entity-config.js
- **Ignoring lookup field detection patterns** - Check for `_value` suffix and force controlType
- **Missing navigation property mappings** - Frontend must map field names to nav properties
- **Fallback functions or fallback forms** - Fail clearly instead of masking configuration problems

## Extension Guidelines

### Adding New Tables/Features
1. **Entity Configuration**: Add entity to `cp_entityconfigurations` table in Dataverse
2. **Function**: Use `functions/generic-entity.js` (no need to create new files)
3. **Component**: Use `src/pages/generic/EntityEdit.jsx` (universal component)
4. **Rich Text Fields**: Use `SimpleRichTextEditor` component for multiline text
5. **Lookup Fields**: Ensure navigation properties are properly mapped
6. **Route**: Add dynamic route in App.jsx: `/entity/:entityName/:mode?/:entityId?`
7. **Documentation**: Update README.md with new functionality

### Adding New Lookup Fields (CRITICAL PROCESS)
1. **Dataverse Setup**: Create lookup field with proper navigation property
2. **Entity Config**: Add field definition with `controlType: 'lookup'`
3. **Navigation Mapping**: Map `_fieldname_value` to proper navigation property
4. **OData Expansion**: Use navigation property name in $expand queries
5. **Frontend Display**: Implement `getLookupDisplayValue` mapping
6. **Testing**: Verify both backend expansion and frontend display work correctly

### Generic Entity Configuration Pattern
```json
{
  "cp_name": "cp_idea",
  "cp_displayname": "Ideas",
  "cp_fields": [
    {
      "name": "cp_title", 
      "displayName": "Title", 
      "controlType": "text", 
      "required": true
    },
    {
      "name": "_cp_contact_value", 
      "displayName": "Contact", 
      "controlType": "lookup",
      "navigationProperty": "cp_Contact"
    },
    {
      "name": "cp_description", 
      "displayName": "Description", 
      "controlType": "richtext"
    }
  ]
}
```

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

## 🚨 RECENT DEVELOPMENT CONTEXT (CRITICAL FOR NEW CHATS)

### Latest Issue Resolution Summary
The most recent development session focused on **fixing lookup field display in generic entity forms**. The issue was that lookup fields showed "Not provided" instead of actual contact names (e.g., "Thomas Sandsør").

### Root Cause Analysis Completed
1. **Backend OData Issue**: Using field names (`_cp_contact_value`) instead of navigation properties (`cp_Contact`) in $expand queries
2. **Frontend Recognition Issue**: Structured forms not automatically detecting lookup fields based on metadata
3. **Data Flow Issue**: Correct data was retrieved but not properly displayed due to navigation property mapping

### Solutions Implemented
1. **Fixed OData Expansion**: Changed from field names to navigation properties in generic-entity.js
2. **Added Field Detection**: Force `controlType='lookup'` for fields ending in `_value`
3. **Enhanced Debugging**: Added comprehensive console logging for lookup field debugging
4. **Navigation Property Mapping**: Implemented proper field-to-navigation-property mapping in frontend

### Current State
- ✅ Backend correctly retrieves expanded lookup data
- ✅ Console logs confirm data structure: `{cp_Contact: {fullname: 'Thomas Sandsør'}}`
- ✅ Frontend lookup detection implemented
- 🔄 Final verification needed: Check if "Thomas Sandsør" now displays instead of "Not provided"

### For New AI Assistant Taking Over
1. **CRITICAL CURRENT ISSUE**: Contact lookup field not saving to Dataverse when creating Ideas
2. **Status**: Frontend working (sends correct GUID), backend returns 200 OK, but no relationship created
3. **Debugging Added**: Extensive logging in `sanitizeDataForDataverse()` function
4. **Key Test**: Create Idea with title "Debug Test X" and check backend logs for field analysis
5. **Files Modified**: `functions/generic-entity.js` (debugging), `src/pages/generic/EntityEdit.jsx` (contact auto-population)
6. **User Context**: Thomas (sandsor@gmail.com), Contact GUID: 61f225a9-007e-f011-b4cb-7ced8d5de1dd

### Critical Code Patterns That Must Be Maintained
```javascript
// Backend: Navigation property expansion (NOT field names)
expands.push('cp_Contact($select=fullname)')  // ✅ CORRECT

// Frontend: Field detection and display
if (field.name.endsWith('_value')) {
  field.controlType = 'lookup'  // ✅ CRITICAL FIX
}

const getLookupDisplayValue = (formData, fieldName) => {
  const navigationProperties = {
    '_cp_contact_value': 'cp_Contact'  // ✅ REQUIRED MAPPING
  }
  // Return actual lookup value or 'Not provided'
}
```

### Next Steps for Continuation
1. Test the lookup field display fix
2. If working, document the pattern for future lookup fields
3. If not working, debug the `getLookupDisplayValue` function call chain
4. Consider adding more navigation property mappings for other lookup fields

This context is essential for understanding where the project currently stands and continuing development effectively.
