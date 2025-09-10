# Dynamic Entity Configuration System

## Overview
A comprehensive system to make the Community Portal completely configurable through **Dataverse entity configurations ONLY**, eliminating the need for hardcoded entity handling. All configuration is stored in Dataverse - no JSON files or environment variables needed.

## Configuration Storage: 100% Dataverse

### Configuration Entity: `cp_entityconfig`

All dynamic entity configuration is stored in this Dataverse custom entity. The system reads these records at runtime to generate menus and enable generic CRUD operations.

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `cp_name` | Text | Configuration name | "Contact Management" |
| `cp_entitylogicalname` | Text | Dataverse entity logical name | "contact" |
| `cp_formguid` | Text | Form GUID for edit page | "12345678-1234-..." |
| `cp_viewmainguid` | Text | Main list view GUID | "87654321-4321-..." |
| `cp_viewsubgridguid` | Text | Subgrid view GUID (optional) | "11223344-5566-..." |
| `cp_contactrelationfield` | Text | Field linking to contact | "_parentcustomerid_value" |
| `cp_showinmenu` | Boolean | Show in navigation menu | true |
| `cp_menuicon` | Text | Menu icon identifier | "users" |
| `cp_menuorder` | Number | Menu display order | 100 |
| `cp_requiresadmin` | Boolean | Admin access required | true |
| `cp_enablesubgridedit` | Boolean | Allow subgrid editing | false |
| `cp_description` | Text | Description for UI | "Manage organization contacts" |

### Sample Dataverse Records

**Contact Entity Configuration:**
```
Name: Contacts
Entity Logical Name: contact
Form GUID: a6a5b6a5-1234-5678-9012-123456789012
View Main GUID: b7b6c7b6-2345-6789-0123-234567890123
Contact Relation Field: _parentcustomerid_value
Show In Menu: Yes
Menu Icon: users
Menu Order: 100
Requires Admin: Yes
Enable Subgrid Edit: No
Description: Manage organization contacts
```

**Account Entity Configuration:**
```
Name: Accounts
Entity Logical Name: account
Form GUID: c8c7d8c7-3456-7890-1234-345678901234
View Main GUID: d9d8e9d8-4567-8901-2345-456789012345
Contact Relation Field: _primarycontactid_value
Show In Menu: Yes
Menu Icon: building
Menu Order: 200
Requires Admin: Yes
Enable Subgrid Edit: No
Description: Manage customer accounts
```

## Static Menu Items (Always Present)

**These menu items are hardcoded and will ALWAYS be present, regardless of entity configurations:**

1. **Dashboard** (`/welcome`) - Order: 0
   - Always first menu item
   - Welcome/dashboard functionality
   - Available to all authenticated users

2. **My Profile** (`/contacts/edit`) - Order: 10  
   - Always second menu item
   - User's personal contact/profile editing
   - Available to all authenticated users

3. **Organization** (`/organization`) - Order: 100 (fallback)
   - Enhanced organization management view
   - Uses existing organization.js function
   - Available to admin users
   - NOTE: If you create a `cp_entityconfig` record for "account" entity, it will replace this in the menu

**Dynamic Menu Items:**
- Any entities configured in `cp_entityconfig` with `Show In Menu = Yes`
- Ordered by `Menu Order` field
- Filtered by admin requirements and user permissions

## Environment Variables

**NO entity-specific environment variables needed.** The system uses only the standard Dataverse connection variables:

```
# Required (existing Dataverse connection)
DATAVERSE_URL=https://your-org.crm.dynamics.com
CLIENT_ID=your-service-principal-client-id
CLIENT_SECRET=your-service-principal-secret
TENANT_ID=your-azure-tenant-id

# No additional variables needed for entity configuration
# Everything is stored in Dataverse cp_entityconfig records
```

## Architecture Components

### 1. Configuration Service (`functions/entity-config.js`)
- Fetch entity configurations
- Cache configurations for performance
- Validate user access based on `cp_requiresAdmin`

### 2. Generic List Component (`src/pages/generic/EntityList.jsx`)
- Dynamic table based on view configuration
- Responsive design with proper field type handling
- Search, filter, pagination
- Create/Edit actions

### 3. Generic Edit Component (`src/pages/generic/EntityEdit.jsx`)
- Dynamic form based on form configuration
- Tab/section/field rendering
- Intelligent subgrids (read-only or editable)
- Save/Cancel/Delete actions

### 4. Dynamic Menu System (`src/components/shared/DynamicSidebar.jsx`)
- Load menu items from entity configurations
- Icon mapping and ordering
- Admin access control

### 5. Generic CRUD Functions (`functions/generic-entity.js`)
- Reusable CRUD operations for any entity
- Security filtering based on contact relation
- Form/view metadata fetching

## URL Structure

```
/entity/{entityname}              # List view
/entity/{entityname}/edit/{id}    # Edit form
/entity/{entityname}/create       # Create form
/entity/{entityname}/view/{id}    # Read-only view
```

## Example Usage

```javascript
// To add a new entity to the portal:
// 1. Create a cp_entityconfig record in Dataverse with these values:

Name: "Opportunities"
Entity Logical Name: "opportunity"
Form GUID: "your-opportunity-main-form-guid"
View Main GUID: "your-opportunity-active-view-guid"
Contact Relation Field: "_parentcontactid_value"
Show In Menu: Yes
Menu Icon: "chart-bar"
Menu Order: 300
Requires Admin: No
Description: "Manage sales opportunities"

// 2. The system automatically:
// - Shows "Opportunities" in the menu (order 300)
// - Creates /entity/opportunity route
// - Loads proper form/view metadata from the GUIDs
// - Handles CRUD operations generically
// - Applies security filtering based on contact relation
// - No code changes required!
```

**Key Benefits:**
- **100% Configuration-Driven**: No JSON files, no environment variables, no code changes
- **Real-Time Updates**: Changes to `cp_entityconfig` appear immediately (with cache refresh)
- **Secure by Design**: Admin controls and relation filtering built into every entity
- **Unlimited Scalability**: Add any number of entities through Dataverse configuration only

This approach transforms the Community Portal from a hardcoded contact system into a **universal Dataverse entity management platform** - all controlled through Dataverse configuration records.

## Implementation Phases

### Phase 1: Configuration Infrastructure
1. Create `cp_entityconfig` entity in Dataverse
2. Build configuration service function
3. Create sample configurations for Contact and Account

### Phase 2: Generic Components
1. Build `EntityList.jsx` component
2. Build `EntityEdit.jsx` component  
3. Implement dynamic routing

### Phase 3: Advanced Features
1. Intelligent subgrid system
2. Dynamic menu generation
3. Permission-based access control

### Phase 4: Enhancements
1. Field-level security
2. Custom field types
3. Workflow integration
4. Audit trail

## Benefits

- **Zero Code Deployment**: Add new entities through configuration only
- **Consistent UX**: All entities use same proven UI patterns
- **Security**: Built-in admin controls and relation filtering
- **Scalability**: Add unlimited entities without performance impact
- **Maintainability**: Single codebase handles all entity operations

## Example Usage

```javascript
// Add a new entity to the portal
const newConfig = {
  cp_name: "Opportunities",
  cp_entitylogicalname: "opportunity", 
  cp_formguid: "opportunity-main-form-guid",
  cp_viewmainguid: "opportunity-active-view-guid",
  cp_contactrelationfield: "_parentcontactid_value",
  cp_showInMenu: true,
  cp_menuIcon: "chart-bar",
  cp_menuOrder: 300,
  cp_requiresAdmin": false
}

// The system automatically:
// 1. Shows "Opportunities" in the menu
// 2. Creates /entity/opportunity route
// 3. Loads proper form/view metadata
// 4. Handles CRUD operations
// 5. Applies security filtering
```

This approach transforms the Community Portal from a hardcoded contact system into a **universal Dataverse entity management platform**.
