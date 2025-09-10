# Dynamic Entity Configuration - Implementation Guide

## Overview
This guide shows how to implement the dynamic entity configuration system in your Community Portal, enabling fully configurable entity management without code changes.

## Phase 1: Create Configuration Entity in Dataverse

### 1. Create Custom Entity: `cp_entityconfig`

In Dataverse, create a new custom entity with these specifications:

**Entity Details:**
- **Name**: Entity Configuration
- **Plural Name**: Entity Configurations  
- **Schema Name**: `cp_entityconfig`
- **Primary Name Field**: `cp_name` (Text)

### 2. Add Custom Fields

Add these custom fields to the `cp_entityconfig` entity:

| Display Name | Schema Name | Type | Description | Required |
|--------------|-------------|------|-------------|----------|
| Entity Logical Name | `cp_entitylogicalname` | Text (100) | Dataverse entity name (e.g., "contact") | Yes |
| Form GUID | `cp_formguid` | Text (50) | System form GUID for editing | No |
| View Main GUID | `cp_viewmainguid` | Text (50) | Main list view GUID | No |
| View Subgrid GUID | `cp_viewsubgridguid` | Text (50) | Subgrid view GUID (optional) | No |
| Contact Relation Field | `cp_contactrelationfield` | Text (100) | Field linking to contact/account | No |
| Show In Menu | `cp_showinmenu` | Yes/No | Display in navigation menu | No |
| Menu Icon | `cp_menuicon` | Text (50) | Icon identifier | No |
| Menu Order | `cp_menuorder` | Whole Number | Menu display order | No |
| Requires Admin | `cp_requiresadmin` | Yes/No | Admin access required | No |
| Enable Subgrid Edit | `cp_enablesubgridedit` | Yes/No | Allow subgrid editing | No |
| Description | `cp_description` | Text (250) | UI description | No |

### 3. Configure Entity Permissions

Set appropriate permissions for the `cp_entityconfig` entity:
- **Read**: All authenticated users
- **Create/Update/Delete**: Administrators only

## Phase 2: Create Sample Configurations

### 1. Contact Configuration

Create a record in `cp_entityconfig`:

```
Name: Contact Management
Entity Logical Name: contact
Form GUID: [Your contact form GUID]
View Main GUID: [Your contact view GUID]
Contact Relation Field: _parentcustomerid_value
Show In Menu: Yes
Menu Icon: users
Menu Order: 100
Requires Admin: Yes
Description: Manage organization contacts
```

### 2. Account Configuration

Create a record in `cp_entityconfig`:

```
Name: Account Management
Entity Logical Name: account
Form GUID: [Your account form GUID]  
View Main GUID: [Your account view GUID]
Contact Relation Field: _primarycontactid_value
Show In Menu: Yes
Menu Icon: building
Menu Order: 200
Requires Admin: Yes
Description: Manage customer accounts
```

## Phase 3: Find Form and View GUIDs

### Finding Form GUIDs

1. **Via Dataverse Web Interface:**
   - Navigate to Tables → [Entity] → Forms
   - Open the form you want to use
   - Check the URL: `...&formId=12345678-1234-...`
   - Copy the GUID after `formId=`

2. **Via API Query:**
   ```
   GET [DATAVERSE_URL]/api/data/v9.0/systemforms?$filter=objecttypecode eq '[entitycode]' and type eq 2&$select=formid,name
   ```

### Finding View GUIDs

1. **Via Dataverse Web Interface:**
   - Navigate to Tables → [Entity] → Views
   - Open the view you want to use
   - Check the URL: `...&viewId=87654321-4321-...`
   - Copy the GUID after `viewId=`

2. **Via API Query:**
   ```
   GET [DATAVERSE_URL]/api/data/v9.0/savedqueries?$filter=returnedtypecode eq '[entitycode]'&$select=savedqueryid,name
   ```

## Phase 4: Environment Variables (No Changes Needed)

**Good news!** The dynamic entity configuration system uses **only the existing Dataverse environment variables**. No additional configuration needed in Netlify.

**Existing Variables (Keep these as-is):**
```
DATAVERSE_URL=https://your-org.crm.dynamics.com
CLIENT_ID=your-service-principal-client-id
CLIENT_SECRET=your-service-principal-secret
TENANT_ID=your-azure-tenant-id
```

**No Additional Variables Required:**
- No `ENTITY_CONFIG_ENABLED` needed
- No JSON configuration files 
- No hardcoded entity lists
- Everything is managed through Dataverse `cp_entityconfig` records

## Phase 5: Test the System

### 1. Test Menu Generation

1. Sign in to the portal
2. Verify dynamic menu items appear
3. Check admin-only items are filtered correctly

### 2. Test Entity List

1. Navigate to `/entity/contact`
2. Verify contact list loads with proper view
3. Test responsive table functionality

### 3. Test Entity Edit

1. Click "Edit" on any contact
2. Verify form loads with proper structure
3. Test field editing and save functionality

### 4. Test Entity Create

1. Click "New Contact" button
2. Verify form loads for creation
3. Test record creation and navigation

## Phase 6: Add Custom Entities

### Example: Add Opportunity Management

1. **Create Configuration Record:**
   ```
   Name: Opportunities
   Entity Logical Name: opportunity
   Form GUID: [opportunity form GUID]
   View Main GUID: [opportunity view GUID]
   Contact Relation Field: _parentcontactid_value
   Show In Menu: Yes
   Menu Icon: chart-bar
   Menu Order: 300
   Requires Admin: No
   Description: Manage sales opportunities
   ```

2. **Verify Menu Update:**
   - Refresh the portal
   - "Opportunities" should appear in menu
   - Navigate to `/entity/opportunity`
   - Full CRUD operations should work

## Troubleshooting

### Common Issues

1. **Menu Items Not Appearing:**
   - Check entity configuration records are active
   - Verify user has proper permissions
   - Check browser console for API errors

2. **Form Not Loading:**
   - Verify Form GUID is correct
   - Check form exists and is published
   - Ensure proper security roles

3. **View Not Loading:**
   - Verify View GUID is correct
   - Check view exists and is not private
   - Ensure view returns data

4. **Permission Errors:**
   - Verify entity permissions are set correctly
   - Check user has admin role if required
   - Validate contact relation field

### Debug Information

The portal displays debug information at the bottom of pages:
- Entity configuration details
- Menu item count
- Form/view metadata status
- User permission status

## Advanced Configuration

### Custom Icons

Add custom icons by extending the `getEntityIcon` function in `DynamicSidebar.jsx`:

```javascript
const iconMap = {
    'custom-icon': (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {/* Your custom SVG path */}
        </svg>
    )
}
```

### Subgrid Integration

Enable subgrid editing by:
1. Set `Enable Subgrid Edit` to Yes in configuration
2. Configure subgrid view GUID
3. The system will automatically provide edit functionality

### Field-Level Security

Configure field-level security through:
1. Dataverse field security profiles
2. Form customization (hide/disable fields)
3. Business rules for dynamic behavior

## Benefits Achieved

✅ **Zero-Code Entity Addition**: Add new entities through configuration only
✅ **Consistent User Experience**: All entities use the same proven UI patterns
✅ **Dynamic Menu Generation**: Menu items appear automatically
✅ **Security Integration**: Admin controls and relation filtering built-in
✅ **Scalable Architecture**: Add unlimited entities without performance impact

The Community Portal is now a **universal Dataverse entity management platform**!
