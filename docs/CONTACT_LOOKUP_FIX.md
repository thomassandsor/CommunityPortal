# Contact Lookup Field Fix - Create Form

## Problem Summary

When creating new records for contact-based dynamic entities (like Ideas), the contact lookup field showed "Not provided" instead of the logged-in user's name, and records failed to create properly.

## Root Causes Identified

### 1. **Property Name Inconsistency**
- **Backend (`entity-config.js`)**: Normalized to `contactRelationField` (camelCase)
- **Frontend (`EntityEdit.jsx`)**: Looking for `cp_contactrelationfield` (with underscore)
- **Impact**: Frontend couldn't find the contact relation field configuration

### 2. **Field Name Mapping Issue**
- **Form Metadata**: Shows field name as `cp_contact` (the logical name)
- **Dataverse API**: Requires `_cp_contact_value` (the lookup field format)
- **Impact**: Form data was being populated with wrong field name, so the GUID wasn't accessible

### 3. **Display Value Lookup**
- **Issue**: `getLookupDisplayValue()` was being called with the form field name (`cp_contact`) but data was stored under lookup field name (`_cp_contact_value`)
- **Impact**: Function couldn't find the GUID to display the user's name

## Solutions Implemented

### Fix 1: Add Backward Compatibility to Entity Config

**File**: `functions/entity-config.js`

**Change**: Added both camelCase and underscore versions of field names to the normalized config:

```javascript
return {
    // ... other fields ...
    contactRelationField: rawConfig.cp_contactrelationfield,
    // BACKWARD COMPATIBILITY: Keep original field names for frontend access
    cp_contactrelationfield: rawConfig.cp_contactrelationfield,
    // ... other fields ...
}
```

**Why**: Ensures frontend can access the field using either naming convention.

### Fix 2: Updated isContactField() Function

**File**: `src/pages/generic/EntityEdit.jsx`

**Change**: Try both naming conventions when checking entity config:

```javascript
const isContactField = (fieldName) => {
    // Try both camelCase and underscore versions for backward compatibility
    const configuredContactField = entityConfig?.contactRelationField || entityConfig?.cp_contactrelationfield
    // ... rest of logic ...
}
```

**Why**: Makes the function work regardless of which property name is available.

### Fix 3: Fixed Contact Field Initialization

**File**: `src/pages/generic/EntityEdit.jsx` - `initializeFormData()`

**Change**: When form shows `cp_contact`, populate the lookup field `_cp_contact_value`:

```javascript
if (fieldName === contactRelationField) {
    // Form shows "cp_contact" but we need to populate "_cp_contact_value"
    const lookupFieldName = `_${contactRelationField}_value`
    initialData[lookupFieldName] = currentContactGuid
    console.log(`👤 🚨 AUTO-POPULATED contact lookup field: ${lookupFieldName} = ${currentContactGuid}`)
}
```

**Why**: Ensures the GUID is stored in the correct field name that Dataverse expects.

### Fix 4: Field Name Mapping in Lookup Rendering

**File**: `src/pages/generic/EntityEdit.jsx` - `renderField()` - lookup case

**Change**: Map form field name to actual lookup field name before getting value:

```javascript
case 'lookup':
    const contactRelationField = entityConfig?.contactRelationField || entityConfig?.cp_contactrelationfield
    let actualLookupFieldName = field.datafieldname
    
    // If this is the contact relation field without _value suffix, add it
    if (contactRelationField && field.datafieldname === contactRelationField) {
        actualLookupFieldName = `_${contactRelationField}_value`
    }
    
    // Get the value from the actual lookup field name
    const actualLookupValue = formData[actualLookupFieldName] || value
    const lookupDisplayValue = getLookupDisplayValue(actualLookupFieldName, actualLookupValue, formData)
```

**Why**: Ensures we look up the GUID using the correct field name, so `getLookupDisplayValue()` can find it and display the user's name.

## How It Works Now

### Create Mode Flow:

1. **Form Loads**: `initializeFormData()` is called
2. **Field Detection**: When processing "cp_contact" field, `isContactField()` recognizes it as a contact lookup
3. **GUID Population**: Populates `_cp_contact_value` with logged-in user's contact GUID
4. **Field Rendering**: When rendering the lookup field:
   - Maps "cp_contact" → "_cp_contact_value"
   - Retrieves the GUID from `_cp_contact_value`
   - Calls `getLookupDisplayValue("_cp_contact_value", guid, formData)`
5. **Display Value**: Function detects create mode + contact field, returns user's fullname from ContactContext
6. **Save**: Backend receives `_cp_contact_value` with the GUID and creates record successfully

### Expected Behavior:

✅ **Create Form**: Contact lookup shows logged-in user's name (e.g., "Thomas Sandsor")  
✅ **Blue Highlight**: Auto-populated contact field has blue background to indicate it's pre-filled  
✅ **Record Creation**: Save button creates record with proper contact GUID reference  
✅ **Edit Form**: Shows existing contact name when editing records  

## Testing Checklist

- [ ] Navigate to `/entity/ideas/create` (or any contact-based entity)
- [ ] Verify contact lookup field shows your name, not "Not provided"
- [ ] Verify field has blue background indicating auto-population
- [ ] Fill in other required fields (e.g., Title, Description)
- [ ] Click "Create" button
- [ ] Verify record is created successfully
- [ ] Verify record appears in list view
- [ ] Click to edit the created record
- [ ] Verify contact name still displays correctly in edit mode

## Related Files Modified

1. `functions/entity-config.js` - Added backward compatibility for field names
2. `src/pages/generic/EntityEdit.jsx` - Fixed field initialization, mapping, and display

## Dynamic Entity Support

This fix works for **any** contact-based dynamic entity, not just Ideas:

- The solution uses `entityConfig.contactRelationField` (or `cp_contactrelationfield`)
- Works for any entity with `cp_contactrelationfield` set in Dataverse configuration
- Examples: Ideas, Projects, Cases, Custom Entities, etc.

## Configuration Requirements

For this to work, your entity must have:

1. **Entity Configuration Record** in `cp_entityconfigurations` table
2. **Contact Relation Field** set in `cp_contactrelationfield` column (e.g., "cp_contact")
3. **Form Metadata** configured with proper form GUID
4. **Lookup Field** in entity schema (e.g., `cp_contact` linking to Contact table)

## Future Improvements

Consider adding:
- Visual indicator that contact field is locked to current user
- Tooltip explaining why field is auto-populated
- Admin option to override contact in special cases
- Support for account-based lookup fields (similar pattern)

---

**Author**: GitHub Copilot  
**Date**: October 1, 2025  
**Status**: ✅ Implemented and Ready for Testing
