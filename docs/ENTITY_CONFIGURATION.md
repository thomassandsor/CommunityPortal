# Entity Configuration Guide

This guide explains how to configure dynamic entities in the Community Portal using the `cp_entityconfigurations` table in Microsoft Dataverse.

## 📋 Overview

The Community Portal uses a **generic entity system** that allows you to add unlimited custom entities without code changes. All configuration is done through the `cp_entityconfigurations` table in Dataverse.

## 🏗️ Entity Configuration Fields

### Required Fields

| Field Name | Type | Description | Example |
|------------|------|-------------|---------|
| `cp_name` | Text | Display name for the entity | "Ideas", "Projects", "Cases" |
| `cp_entitylogicalname` | Text | Dataverse entity logical name | "cp_idea", "cp_project", "cp_case" |

### Menu Configuration

| Field Name | Type | Description | Default |
|------------|------|-------------|---------|
| `cp_showinmenu` | Boolean | Show this entity in the sidebar menu | false |
| `cp_menuicon` | Text | Icon name for menu display | "document" |
| `cp_menuorder` | Number | Sort order in menu (lower = higher) | 1000 |

### Security & Access

| Field Name | Type | Description | Default |
|------------|------|-------------|---------|
| `cp_requiresadmin` | Boolean | Requires portal admin access | false |
| `cp_contactrelationfield` | Text | Field linking to contact (for user scoping) | null |
| `cp_accountrelationfield` | Text | Field linking to account (for org scoping) | null |

### Form & View Configuration

| Field Name | Type | Description | Required |
|------------|------|-------------|----------|
| `cp_formguid` | Text | GUID of the Dataverse form | Yes |
| `cp_viewmainguid` | Text | GUID of the main list view | Yes |
| `cp_viewsubgridguid` | Text | GUID of subgrid view | No |

### Advanced Options

| Field Name | Type | Description | Default |
|------------|------|-------------|---------|
| `cp_enablesubgridedit` | Boolean | Allow inline editing in lists | false |
| `cp_keyfields` | Text | Comma-separated list of key fields | null |
| `cp_description` | Text | Description for tooltips | null |

## 🎨 Available Icons

### 👥 People & Users
- `users` - Multiple people icon
- `user` - Single person icon  
- `user-circle` - Person in circle

### 🏢 Buildings & Organizations
- `building` - Office building
- `office-building` - Detailed building
- `home` - House icon

### 📄 Documents & Files
- `document` - Paper document *(default)*
- `folder` - File folder
- `clipboard` - Clipboard with paper

### 📊 Analytics & Charts
- `chart-bar` - Bar chart
- `chart-pie` - Pie chart
- `trending-up` - Trending arrow

### 💬 Communication
- `mail` - Email envelope
- `chat` - Speech bubble
- `phone` - Telephone

### ⚙️ Tools & Settings
- `cog` - Settings gear
- `wrench` - Tool wrench

### 💼 Business & Finance
- `briefcase` - Business briefcase
- `currency-dollar` - Dollar sign
- `credit-card` - Credit card

### ✅ Actions & Status
- `check-circle` - Success checkmark
- `exclamation` - Warning triangle
- `bell` - Notification bell

### 🎨 Creative & Media
- `camera` - Camera icon
- `photograph` - Picture frame
- `star` - Star rating

## 🔧 Configuration Examples

### Basic Entity Configuration
```json
{
  "cp_name": "Ideas",
  "cp_entitylogicalname": "cp_idea",
  "cp_showinmenu": true,
  "cp_menuicon": "star",
  "cp_menuorder": 100,
  "cp_formguid": "12345678-1234-1234-1234-123456789012",
  "cp_viewmainguid": "87654321-4321-4321-4321-210987654321",
  "cp_contactrelationfield": "cp_contact"
}
```

### Admin-Only Entity
```json
{
  "cp_name": "System Settings",
  "cp_entitylogicalname": "cp_systemsetting",
  "cp_showinmenu": true,
  "cp_menuicon": "cog",
  "cp_menuorder": 999,
  "cp_requiresadmin": true,
  "cp_formguid": "admin-form-guid",
  "cp_viewmainguid": "admin-view-guid"
}
```

### Organization-Scoped Entity
```json
{
  "cp_name": "Company Projects",
  "cp_entitylogicalname": "cp_project",
  "cp_showinmenu": true,
  "cp_menuicon": "briefcase",
  "cp_menuorder": 200,
  "cp_accountrelationfield": "cp_account",
  "cp_formguid": "project-form-guid",
  "cp_viewmainguid": "project-view-guid"
}
```

## 🔐 Security Patterns

### User-Scoped Entities (Personal Data)
Set `cp_contactrelationfield` to the field that links records to contacts:
- Users can only see their own records
- Example: Ideas, personal tasks, user preferences

### Organization-Scoped Entities (Shared Data)
Set `cp_accountrelationfield` to the field that links records to accounts:
- Users can see all records from their organization
- Example: Company projects, shared resources

### Admin-Only Entities (System Data)
Set `cp_requiresadmin` to true:
- Only portal admins can access
- Example: System settings, user management

## 📝 Form & View Setup

### 1. Create Your Custom Entity
```sql
-- Example entity creation
Entity: cp_idea
Fields:
  - cp_title (Single Line Text)
  - cp_description (Multiple Lines Text)
  - cp_contact (Lookup to Contact)
  - cp_status (Option Set)
```

### 2. Create Forms in Dataverse
1. Open Power Apps maker portal
2. Navigate to your entity
3. Create a new form
4. Copy the Form GUID from the URL
5. Add to `cp_formguid` field

### 3. Create Views in Dataverse
1. Create a new view for your entity
2. Add columns you want to display
3. Copy the View GUID from the URL
4. Add to `cp_viewmainguid` field

### 4. Configure Security Field
If user-scoped, ensure your entity has a lookup field to Contact:
```
Field Name: cp_contact
Type: Lookup
Target: Contact
```

## 🚀 Testing Your Configuration

1. **Create Configuration Record**
   - Add record to `cp_entityconfigurations`
   - Fill in required fields
   - Set `cp_showinmenu` = true

2. **Clear Cache**
   - Click refresh button (🔄) in sidebar
   - Or wait 1 minute for automatic cache refresh

3. **Verify Menu Item**
   - Check sidebar for new menu item
   - Verify icon and name display correctly

4. **Test Functionality**
   - Click menu item to access entity list
   - Test create, edit, delete operations
   - Verify security scoping works

## 🐛 Troubleshooting

### Menu Item Not Appearing
- ✅ Check `cp_showinmenu` is true
- ✅ Verify user has access (check `cp_requiresadmin`)
- ✅ Click refresh button to clear cache
- ✅ Check browser console for errors

### Form Not Loading
- ✅ Verify `cp_formguid` is correct GUID
- ✅ Check form exists in Dataverse
- ✅ Ensure user has read access to form

### Security Not Working
- ✅ Verify `cp_contactrelationfield` matches actual field name
- ✅ Check field exists on entity
- ✅ Ensure field is lookup to Contact

### Icon Not Displaying
- ✅ Check icon name matches available options
- ✅ Use lowercase, hyphenated names
- ✅ Leave blank for default document icon

## 💡 Best Practices

### Naming Conventions
- Use descriptive `cp_name` values: "Customer Ideas", "Project Tasks"
- Use consistent `cp_entitylogicalname`: "cp_customeridea", "cp_projecttask"
- Order menu items logically with `cp_menuorder`

### Security Design
- Always use `cp_contactrelationfield` for user data
- Use `cp_accountrelationfield` for shared organizational data
- Limit `cp_requiresadmin` to system configuration entities

### Performance
- Keep forms focused with essential fields only
- Limit view columns to improve loading times
- Use appropriate security scoping to reduce data volumes

### User Experience
- Choose intuitive icons that represent the entity purpose
- Order menu items by frequency of use
- Provide helpful descriptions for complex entities

## 🔄 Cache Management

The system caches configurations for **1 minute** to improve performance. 

### Manual Cache Refresh
- Click the refresh button (🔄) in the sidebar header
- Changes appear immediately

### Automatic Refresh  
- Cache expires after 1 minute
- Refresh browser to see changes

### Clear All Cache
Add `?clearCache=true` to entity-config function URL:
```
https://your-site.netlify.app/.netlify/functions/entity-config?clearCache=true
```

## 📚 Related Documentation

- [Server-Side Security](SERVER_SIDE_SECURITY.md) - Security implementation details
- [Dynamic Entity Config](DYNAMIC_ENTITY_CONFIG.md) - Technical architecture
- [Project Status](../PROJECT_STATUS.md) - Current system status

---

**Need help?** Check the browser console for detailed error messages or contact your system administrator.
