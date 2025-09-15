# Server-Side Security Implementation
## Community Portal - User Data Scoping & Protection

### 🛡️ **Security Overview**

Your Community Portal implements **comprehensive server-side security** that ensures users can ONLY access their own data. All filtering and access control happens on the server side, never trusting the frontend.

---

## 🔐 **Multi-Layer Security Architecture**

### **Layer 1: Authentication (Always Required)**
```javascript
// Every API call requires valid Clerk JWT token
const user = await validateSimpleAuth(event)
console.log(`✅ Authenticated user: ${user.userId}`)
```

### **Layer 2: User Contact Verification (Mandatory)**
```javascript
// System requires user to have a contact record in Dataverse
if (!userContact || !userContact.contactid) {
    return createAuthErrorResponse('User contact record required for data access', 403)
}
```

### **Layer 3: Server-Side Data Filtering (Per Request)**
```javascript
// ALL queries are automatically filtered by user ownership
function buildEntitySecurityFilter(entityConfig, userContact) {
    let filter = 'statecode eq 0' // Only active records
    
    if (entityConfig.contactRelationField) {
        const contactField = `_${entityConfig.contactRelationField}_value`
        filter += ` and ${contactField} eq ${userContact.contactid}`
        console.log(`🛡️ SECURITY: Applied user scoping - ${contactField} eq ${userContact.contactid}`)
    }
    
    return filter
}
```

---

## 📊 **Data Access Patterns (All Server-Side)**

### **1. List Queries - User Scoped**
```javascript
// Example: GET /entity/ideas
// Server automatically adds: AND _cp_contact_value eq 'user-contact-guid'
// User only sees their own ideas, never others
const url = `${DATAVERSE_URL}/api/data/v9.0/cp_ideas?$filter=${encodeURIComponent(securityFilter)}`
```

### **2. Single Record Access - Ownership Verified**
```javascript
// Example: GET /entity/ideas/123
// Server verifies: idea.id = 123 AND idea.contact = user.contact
const filter = `cp_ideaid eq '${entityId}' and (${securityFilter})`
// Returns 404 if user doesn't own the record
```

### **3. Create Operations - Auto-Ownership**
```javascript
// All new records automatically assigned to creating user
if (entityConfig.contactRelationField && userContact) {
    const contactBindField = `${entityConfig.contactRelationField}@odata.bind`
    sanitizedData[contactBindField] = `/contacts(${userContact.contactid})`
    console.log(`🛡️ SECURITY: Setting user ownership`)
}
```

### **4. Update Operations - Ownership Pre-Check**
```javascript
// Before any update, server verifies user owns the record
const verifyFilter = `${idField} eq '${entityId}' and (${securityFilter})`
const verifyResponse = await fetch(verifyUrl + verifyFilter)
if (!verifyData.value || verifyData.value.length === 0) {
    throw new Error('Access denied: You can only update records you own')
}
```

### **5. Delete Operations - Ownership Pre-Check**
```javascript
// Same ownership verification before any delete operation
// Users can only delete their own records
```

---

## 🎯 **Entity Configuration Security**

### **Contact Relation Fields (Required)**
Each entity must specify how it relates to contacts in `cp_entityconfigs`:

```javascript
// Example entity configuration
{
    entityLogicalName: 'cp_idea',
    contactRelationField: 'cp_contact',  // CRITICAL: This enables user scoping
    requiresAdmin: false
}
```

### **Admin vs Regular Users**
```javascript
// Admin users can access entities without contact relations
if (!userContact.cp_portaladmin) {
    // Non-admin users MUST have contact relation for access
    return 'contactid eq 00000000-0000-0000-0000-000000000000' // Deny all
}
```

---

## 🚫 **What's NOT Possible (By Design)**

### **❌ Cross-User Data Access**
- Users cannot see other users' records
- No "public" data access (unless specifically designed)
- Frontend filtering is ignored - all security is server-side

### **❌ Data Tampering**
- Frontend cannot bypass user scoping
- All OData queries include mandatory user filters
- Record ownership is verified before any modification

### **❌ Privilege Escalation**
- Non-admin users cannot access admin-only entities
- Contact relation fields are mandatory for data access
- System fields (created by, modified by) are read-only

---

## 📝 **Implementation Examples**

### **Example 1: User Creates an Idea**
```http
POST /entity/ideas
Authorization: Bearer user-jwt-token

{
    "cp_title": "My New Idea",
    "cp_description": "This is my idea"
}
```

**Server Processing:**
1. ✅ Validates JWT token → gets user ID
2. ✅ Looks up user's contact record → gets contact GUID
3. ✅ Automatically adds: `cp_Contact@odata.bind = "/contacts(user-contact-guid)"`
4. ✅ Creates record with user as owner

### **Example 2: User Lists Their Ideas**
```http
GET /entity/ideas
Authorization: Bearer user-jwt-token
```

**Server Processing:**
1. ✅ Validates JWT token → gets user ID
2. ✅ Looks up user's contact record → gets contact GUID
3. ✅ Automatically adds filter: `_cp_contact_value eq 'user-contact-guid'`
4. ✅ Returns ONLY user's ideas (could be 0, could be 100)

### **Example 3: User Tries to Edit Someone Else's Idea**
```http
PATCH /entity/ideas/someone-elses-idea-id
Authorization: Bearer user-jwt-token

{ "cp_title": "Trying to hack" }
```

**Server Processing:**
1. ✅ Validates JWT token → gets user ID
2. ✅ Looks up user's contact record → gets contact GUID
3. ✅ Pre-check: `idea.id = 'someone-elses-idea-id' AND idea.contact = 'user-contact-guid'`
4. ❌ **BLOCKED**: Returns 403 "Access denied: You can only update records you own"

---

## 🔧 **Configuration Requirements**

### **Environment Variables (Required)**
```env
DATAVERSE_URL=https://your-org.crm.dynamics.com
CLIENT_ID=your-service-principal-id
CLIENT_SECRET=your-service-principal-secret
TENANT_ID=your-azure-tenant-id
```

### **Dataverse Setup (Required)**
1. **Entity Configuration Table** (`cp_entityconfigurations`)
   - Must specify `cp_contactrelationfield` for each entity
   - Controls which entities users can access

2. **Contact Records** (Required for all users)
   - Every user must have a contact in Dataverse
   - Contact ID becomes the security identifier

3. **Lookup Fields** (Entity Design)
   - All user data entities must have contact lookup field
   - Example: `_cp_contact_value` field pointing to contacts table

---

## 🎯 **Security Verification Checklist**

### ✅ **To Verify Your Security Is Working:**

1. **Test User Isolation:**
   ```bash
   # Create records with User A, try to access with User B
   # User B should see 0 records, not User A's records
   ```

2. **Test Update Protection:**
   ```bash
   # Try to update another user's record ID directly
   # Should get 403 Access Denied error
   ```

3. **Test Admin vs Regular:**
   ```bash
   # Regular user should not access admin-only entities
   # Admin user should see all entity types
   ```

4. **Check Server Logs:**
   ```bash
   # Look for security filter logs:
   # "🛡️ SECURITY: Applied user scoping filter"
   # "🛡️ SECURITY: User ownership verified"
   ```

---

## 🚀 **Performance & Security Benefits**

### **✅ Server-Side Benefits:**
- **Zero Trust Architecture**: Frontend cannot bypass security
- **Efficient Queries**: Dataverse OData filters are database-optimized
- **Audit Trail**: All security decisions logged on server
- **Scalable**: Filters work efficiently with millions of records

### **✅ User Experience:**
- **Fast Loading**: Users only see their own data (smaller result sets)
- **No Unauthorized Access**: Impossible to see other users' data
- **Clear Boundaries**: Users understand they see only their own data
- **Admin Powers**: Admin users can see more when appropriate

---

## 📚 **Related Documentation**

- [Entity Configuration Guide](DYNAMIC_ENTITY_CONFIG.md)
- [Frontend Security Patterns](../CHAT_MODE_INSTRUCTIONS.md)
- [Dataverse Integration Patterns](../README.md)

---

**✨ Summary: Your Community Portal implements enterprise-grade server-side security where users can ONLY access their own data, with all security decisions made on the server side using Dataverse OData filters. This provides both security and performance at scale.**
