# Admin Role & Organization Setup Guide

This guide explains how to set up the admin functionality and organization-based contact viewing in your Community Portal.

## 1. Add Admin Field to Dataverse Contact

### Create the Admin Field:
1. **Open Power Platform admin center** or your Dataverse environment
2. **Navigate to** Tables → Contact (or your contact table)
3. **Add a new column** with these settings:
   - **Display name**: `Is Admin`
   - **Name**: `cr_isadmin` (or any name starting with your publisher prefix)
   - **Data type**: `Choice`
   - **Choices**: 
     - `Yes` (Value: 1)
     - `No` (Value: 0)
   - **Default choice**: `No`
4. **Save** the column

## 2. Set Up Organization Association

### Associate Contacts with Accounts:
1. **Open your Contact table data**
2. **For each contact** that should be part of an organization:
   - **Edit the record**
   - **Set the "Company Name" (Account)** field to link to an Account record
   - **Save** the record
3. **Create Account records** as needed for different organizations

### Set Admin Users:
1. **Find the contact record** for the user you want to make admin
2. **Ensure they have an Account association** (Company Name field filled)
3. **Edit the record** and set `Is Admin` to `Yes`
4. **Save** the record

## 3. Organization Access Rules

### Who Can See the Organization Menu:
- ✅ **Admin users** (`cr_isadmin = true`)
- ✅ **WITH an associated account** (`_parentcustomerid_value` is not null)
- ❌ **Regular users** (no Organization menu)
- ❌ **Admins without account association** (no Organization menu)

### What Organization Admins Can See:
- **All contacts** linked to the same Account/Organization
- **Contact details**: Name, email, phone, admin status
- **Contact metadata**: Creation date, last modified
- **Admin indicators** for each contact in the organization

## 4. API Endpoints

### Organization Contacts:
```javascript
// Get all contacts in user's organization (admin only)
GET /.netlify/functions/organization
// Returns: { contacts: [...], accountId: "...", isAdmin: true, totalCount: 10 }
```

### Enhanced Contact Information:
```javascript
// Contact details now include account association
GET /.netlify/functions/contact?email=user@domain.com
// Returns: { contact: { ..., _parentcustomerid_value: "account-id" }, isAdmin: true }
```

## 5. Security Features

### Access Control:
- **Database-driven**: Admin status and account association come from Dataverse
- **Server-side enforcement**: All checks happen in Netlify Functions
- **Account isolation**: Admins only see contacts from their own organization
- **Graceful fallback**: Errors default to no access (secure by default)

### Protection Against:
- ❌ **Cross-organization access**: Admins cannot see other organizations
- ❌ **Client-side bypass**: All security enforced server-side
- ❌ **Privilege escalation**: Admin status cannot be modified via web interface
- ❌ **Data enumeration**: Account ID required for contact listing

## 6. UI Features

### Dynamic Menu:
- **Organization menu** appears automatically for qualified users
- **Real-time detection** of admin status and account association
- **Seamless integration** with existing navigation

### Organization Page Features:
- **Contact listing** with admin/user indicators
- **Account information** display
- **Refresh capability** for real-time updates
- **Professional contact cards** with avatars and details
- **Error handling** with user-friendly messages

## 7. Setup Verification

### Test Admin with Organization:
1. **Create/link an Account** in Dataverse
2. **Associate a Contact** with that Account
3. **Set Contact as admin** (`cr_isadmin = Yes`)
4. **Sign in** with that user
5. **Verify** Organization menu appears in sidebar
6. **Navigate to Organization** and see all contacts in that account

### Test Regular User:
1. **Sign in** with non-admin account
2. **Verify** no Organization menu appears
3. **Confirm** cannot access `/organization` directly

### Test Admin without Organization:
1. **Set Contact as admin** but leave Account field empty
2. **Sign in** with that user
3. **Verify** no Organization menu appears (requires both admin AND account)

## 8. Database Schema Requirements

### Required Fields:
```javascript
// Contact table
{
  cr_isadmin: boolean,              // Admin status
  _parentcustomerid_value: string   // Account association (GUID)
}

// Account table (standard Dataverse)
{
  accountid: string,                // Primary key
  name: string,                     // Organization name
  // ... other standard fields
}
```

## 9. Production Considerations

### Performance:
- Organization contact list limited to 100 records
- Efficient OData queries with proper filtering
- Account ID caching for session duration

### Security Best Practices:
- ✅ **Principle of least privilege**: Default to no access
- ✅ **Defense in depth**: Multiple validation layers
- ✅ **Account isolation**: Organization-based access control
- ✅ **Audit capability**: All admin actions logged

### Scalability:
- Pagination can be added for large organizations
- Search/filter functionality easily extensible
- Role hierarchy can be expanded with additional fields

## 10. Future Enhancements

### Easy Extensions:
- **Department filtering**: Add department field to contacts
- **Role hierarchy**: Manager, Admin, Super Admin levels
- **Bulk operations**: Import/export organization contacts
- **Contact management**: Edit other contacts as admin
- **Reporting**: Organization statistics and analytics

---

## Quick Test Scenarios

### Scenario 1: Admin with Organization
```
Contact: admin@company.com
- cr_isadmin: Yes
- Account: "ACME Corporation"
Expected: ✅ Organization menu visible, can see all ACME contacts
```

### Scenario 2: Admin without Organization
```
Contact: admin@freelance.com
- cr_isadmin: Yes
- Account: (empty)
Expected: ❌ No Organization menu
```

### Scenario 3: Regular User
```
Contact: user@company.com
- cr_isadmin: No
- Account: "ACME Corporation"
Expected: ❌ No Organization menu
```

This implementation provides **enterprise-grade organization management** while maintaining the simplicity and security of your existing architecture!
