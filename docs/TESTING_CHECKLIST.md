# Dynamic Entity System - Testing Checklist

## Pre-Testing Setup

### ✅ 1. Dataverse Entity Configuration
- [ ] `cp_entityconfig` custom entity created
- [ ] All required fields added with correct schema names
- [ ] Entity permissions configured (Read: All Users, Write: Admins)
- [ ] At least one test configuration record created

### ✅ 2. Environment Variables
- [ ] All required variables set in Netlify dashboard
- [ ] Variables accessible in local development (`netlify dev`)
- [ ] `ENTITY_CONFIG_ENABLED=true` if using custom configuration

### ✅ 3. Function Deployment
- [ ] `functions/entity-config.js` deployed and accessible
- [ ] `functions/generic-entity.js` deployed and accessible
- [ ] All existing functions still working (auth, contact, organization)

## Core Functionality Testing

### 🧪 1. Configuration Loading
**Test**: Dynamic menu generation
- [ ] Visit `/` (Landing page)
- [ ] Sign in with valid credentials
- [ ] **Expected**: Dynamic menu items appear in sidebar based on configurations
- [ ] **Expected**: Admin-only items filtered based on user role
- [ ] **Fallback**: Static menu items still work if configuration fails

**API Test**: 
```
GET /.netlify/functions/entity-config
Expected: Array of entity configurations
```

### 🧪 2. Entity List View
**Test**: Generic entity listing
- [ ] Navigate to `/entity/contact`
- [ ] **Expected**: Contact list loads with proper columns
- [ ] **Expected**: Responsive table on mobile devices
- [ ] **Expected**: "New Contact" button appears
- [ ] **Expected**: Edit links work for each record

**Test**: Alternative entity
- [ ] Navigate to `/entity/account` (if configured)
- [ ] **Expected**: Account list with different structure
- [ ] **Expected**: Consistent UI but entity-specific data

**API Test**:
```
GET /.netlify/functions/generic-entity?entityName=contact&action=list
Expected: Array of contact records with metadata
```

### 🧪 3. Entity Edit Form
**Test**: Edit existing record
- [ ] Click "Edit" on any contact from list
- [ ] **Expected**: Navigate to `/entity/contact/edit/[recordId]`
- [ ] **Expected**: Form loads with current field values
- [ ] **Expected**: Tab structure for form sections
- [ ] **Expected**: Subgrids display (if configured)

**Test**: Form submission
- [ ] Modify field values
- [ ] Click "Save Changes"
- [ ] **Expected**: Success message appears
- [ ] **Expected**: Navigate back to entity list
- [ ] **Expected**: Changes reflected in list view

**API Test**:
```
GET /.netlify/functions/generic-entity?entityName=contact&action=get&recordId=[id]
PUT /.netlify/functions/generic-entity (with form data)
Expected: Record data and successful update response
```

### 🧪 4. Entity Creation
**Test**: Create new record
- [ ] Click "New Contact" from list view
- [ ] **Expected**: Navigate to `/entity/contact/edit/new`
- [ ] **Expected**: Empty form with proper structure
- [ ] **Expected**: Required fields marked appropriately

**Test**: Creation submission
- [ ] Fill in required fields
- [ ] Click "Create Record"
- [ ] **Expected**: Success message appears
- [ ] **Expected**: Navigate back to entity list
- [ ] **Expected**: New record appears in list

**API Test**:
```
POST /.netlify/functions/generic-entity (with form data)
Expected: New record created with generated ID
```

## Advanced Feature Testing

### 🧪 5. Subgrid Functionality
**Test**: Subgrid display (if configured)
- [ ] Open entity edit form with subgrid configuration
- [ ] **Expected**: Related records appear in "Related" tab
- [ ] **Expected**: Subgrid shows proper column structure
- [ ] **Expected**: Data loads asynchronously

**Test**: Subgrid edit mode (if enabled)
- [ ] Click "Edit" on subgrid record
- [ ] **Expected**: Navigate to related entity edit form
- [ ] **Expected**: Proper back navigation to parent record

### 🧪 6. Permission Handling
**Test**: Admin-only entities
- [ ] Configure entity with `Requires Admin: Yes`
- [ ] Sign in as non-admin user
- [ ] **Expected**: Entity not visible in menu
- [ ] **Expected**: Direct URL access blocked

**Test**: Contact relation filtering
- [ ] Configure entity with contact relation field
- [ ] **Expected**: List shows only records related to current user's contact
- [ ] **Expected**: Cannot access unrelated records directly

### 🧪 7. Error Handling
**Test**: Invalid entity name
- [ ] Navigate to `/entity/nonexistent`
- [ ] **Expected**: Error message displayed
- [ ] **Expected**: Navigation back to working area

**Test**: Missing form/view GUIDs
- [ ] Configure entity without form GUID
- [ ] **Expected**: Graceful fallback to basic form
- [ ] **Expected**: Error logged but system remains functional

**Test**: API failure scenarios
- [ ] Test with Dataverse temporarily unavailable
- [ ] **Expected**: User-friendly error messages
- [ ] **Expected**: System degrades gracefully

## Integration Testing

### 🧪 8. Navigation Flow
**Test**: Full user journey
- [ ] Start at Landing page
- [ ] Sign in → ContactChecker → Welcome
- [ ] Navigate via dynamic menu to entity list
- [ ] Edit record → Save → Return to list
- [ ] Create new record → Save → Return to list
- [ ] Navigate to different entity type
- [ ] **Expected**: Consistent experience throughout

### 🧪 9. Responsive Design
**Test**: Mobile experience
- [ ] Test on mobile device or browser dev tools
- [ ] **Expected**: Sidebar collapses appropriately
- [ ] **Expected**: Tables scroll horizontally
- [ ] **Expected**: Forms remain usable
- [ ] **Expected**: All functionality accessible

### 🧪 10. Performance
**Test**: Load times
- [ ] Monitor network tab for API calls
- [ ] **Expected**: Entity list loads in < 3 seconds
- [ ] **Expected**: Form loads in < 2 seconds
- [ ] **Expected**: Configuration cached appropriately

## Regression Testing

### ✅ 11. Existing Functionality
**Test**: Static pages still work
- [ ] Landing page functions normally
- [ ] Welcome page displays correctly
- [ ] Success page accessible
- [ ] Contact profile editing works

**Test**: Original organization functionality
- [ ] Navigate to `/organization`
- [ ] **Expected**: Enhanced dynamic view works
- [ ] **Expected**: All CRUD operations functional
- [ ] **Expected**: Contact editing still works

**Test**: Authentication flow
- [ ] Sign out and sign in process
- [ ] **Expected**: ContactChecker still functions
- [ ] **Expected**: Dynamic menu loads after auth
- [ ] **Expected**: Permissions apply correctly

## Configuration Testing

### 🧪 12. Configuration Changes
**Test**: Add new entity configuration
- [ ] Create new `cp_entityconfig` record in Dataverse
- [ ] Refresh portal (clear cache if necessary)
- [ ] **Expected**: New menu item appears
- [ ] **Expected**: Entity operations work immediately

**Test**: Modify existing configuration
- [ ] Change menu order or icon
- [ ] **Expected**: Changes reflected in UI
- [ ] **Expected**: No system restart required

**Test**: Disable entity
- [ ] Set `Show In Menu: No` for an entity
- [ ] **Expected**: Menu item disappears
- [ ] **Expected**: Direct URL access still works

## Success Criteria

### ✅ All Tests Pass
- [ ] All core functionality tests pass
- [ ] All advanced feature tests pass
- [ ] All integration tests pass
- [ ] All regression tests pass
- [ ] All configuration tests pass

### ✅ Performance Standards Met
- [ ] Page load times under target thresholds
- [ ] No JavaScript errors in console
- [ ] Responsive design works on all screen sizes
- [ ] API responses complete successfully

### ✅ User Experience Standards
- [ ] Navigation flows are intuitive
- [ ] Error messages are user-friendly
- [ ] Success feedback is clear
- [ ] Loading states provide good UX

## Deployment Checklist

### ✅ Production Readiness
- [ ] All tests pass in development environment
- [ ] Environment variables configured in Netlify
- [ ] Entity configurations created in production Dataverse
- [ ] User permissions configured correctly
- [ ] Documentation updated for support team

### ✅ Monitoring Setup
- [ ] Error tracking configured
- [ ] Performance monitoring active
- [ ] User feedback mechanism available
- [ ] Admin access for configuration management

---

## Quick Test Commands

**Test API Directly:**
```bash
# Test configuration loading
curl "https://your-site.netlify.app/.netlify/functions/entity-config"

# Test entity list
curl "https://your-site.netlify.app/.netlify/functions/generic-entity?entityName=contact&action=list"

# Test single record
curl "https://your-site.netlify.app/.netlify/functions/generic-entity?entityName=contact&action=get&recordId=12345"
```

**Check Logs:**
```bash
# Netlify function logs
netlify logs:functions

# Local development logs  
netlify dev
```

This testing checklist ensures your dynamic entity configuration system is production-ready and provides a consistent, scalable experience for managing any Dataverse entity!
