# Entity Configuration Guide for Community Developers

This guide helps you properly configure new Dataverse entities in the Community Portal system.

## Quick Start

1. **Create your custom entity** in Dataverse with the `cp_` prefix
2. **Add entity configuration** to the `cp_entityconfig` table
3. **Use the auto-generated guidance** from the system logs
4. **Test with Dataverse REST Builder** first

## Understanding Dataverse Field Names vs Navigation Properties

The most common confusion in Dataverse OData queries is the difference between **field names** and **navigation properties**:

### Field Names (for $select and $filter)
- Always lowercase: `cp_contact`, `cp_customfield`
- Used in: `$select`, `$filter`, view metadata
- Example: `$select=cp_ideaid,cp_name,cp_contact`

### Navigation Properties (for $expand)
- Mixed case: `cp_Contact`, `cp_CustomField` 
- Used in: `$expand` clauses only
- Case-sensitive and preserve original schema names
- Example: `$expand=cp_Contact($select=fullname)`

## Auto-Discovery Process

When you first access a new entity page, the system will:

1. **Fetch entity metadata** from Dataverse
2. **Generate configuration guidance** in the console logs
3. **Map lookup fields** to correct navigation properties
4. **Provide copy-paste examples** for documentation

## Real Working Example (cp_idea)

Based on the actual working configuration in this system:

```javascript
// REAL cp_entityconfig entry
{
  cp_name: "ideas",
  cp_entitylogicalname: "cp_idea", 
  cp_contactrelationfield: "cp_contact",
  cp_viewmainguid: "[actual-guid-from-dataverse]",
  cp_formguid: "[actual-guid-from-dataverse]"
}

// REAL field mapping discovered by the system:
// Field name: "cp_contact" (in view metadata)
// Value field: "_cp_contact_value" (for filtering)
// Navigation property: "cp_Contact" (case-sensitive - note capital C!)
// Working OData: cp_Contact($select=fullname)
```

## Hypothetical Examples (for illustration)

The following are examples to show patterns - **not actual implemented entities**:

```javascript
// EXAMPLE ONLY - not real
{
  cp_name: "projects",                    // URL slug (lowercase, plural)
  cp_entitylogicalname: "cp_project",     // Dataverse logical name
  cp_contactrelationfield: "cp_owner",   // Contact lookup field name
}
```

## Lookup Field Configuration

### Step 1: Identify Your Lookup Fields
Check the system logs when accessing your entity for the first time:

```
📖 COMMUNITY CONFIGURATION GUIDANCE
=====================================
Entity: cp_idea (REAL EXAMPLE)
🔗 Lookup Fields (for entity views):
   Field Name: "cp_contact"
   Value Field: "_cp_contact_value"
   Navigation Property: "cp_Contact" (case-sensitive!)
   OData Expand: cp_Contact($select=fullname)
```

**Note**: The above is from the actual working cp_idea entity. Your entity will show different field names.

### Step 2: Use Correct Naming in Views
- **View columns**: Use field name `cp_contact`
- **OData queries**: Use navigation property `cp_Contact`

### Step 3: Test with REST Builder
Always test your OData syntax with Dataverse REST Builder first:

```javascript
// ✅ Correct REST Builder query (based on real cp_idea entity)
Xrm.WebApi.retrieveMultipleRecords("cp_idea", 
  "?$expand=cp_Contact($select=fullname)&$filter=_cp_contact_value eq 61f225a9-007e-f011-b4cb-7ced8d5de1dd")

// ❌ Wrong - lowercase navigation property
"?$expand=cp_contact($select=fullname)&$filter=_cp_contact_value eq 61f225a9-007e-f011-b4cb-7ced8d5de1dd"
```

## Common Patterns

### Basic Entity Configuration
```javascript
{
  cp_name: "projects",                    // URL slug (lowercase, plural)
  cp_entitylogicalname: "cp_project",     // Dataverse logical name
  cp_contactrelationfield: "cp_owner",   // Contact lookup field name
  cp_displayname: "Projects",            // Human-readable name
  cp_description: "Project management"   // Description
}
```

### Contact Lookup Field (REAL - cp_idea)
```javascript
// Field name in Dataverse: cp_contact
// Value field for queries: _cp_contact_value  
// Navigation property: cp_Contact (note the capital C - this is real!)
// OData expand: cp_Contact($select=fullname)
```

### Custom Lookup Field (EXAMPLE ONLY)
```javascript
// HYPOTHETICAL EXAMPLE - not implemented
// Field name: cp_assignedto
// Value field: _cp_assignedto_value
// Navigation property: cp_AssignedTo (original casing preserved)
// OData expand: cp_AssignedTo($select=fullname)
```

## Troubleshooting

### 400 Bad Request Errors
Usually caused by incorrect navigation property casing:

```javascript
// ❌ Wrong
$expand=cp_contact($select=fullname)

// ✅ Correct  
$expand=cp_Contact($select=fullname)
```

### No Data Displayed
Check that your view metadata includes the correct field names:
- View should reference: `cp_contact`
- OData should expand: `cp_Contact`

### Security Filtering
The system automatically adds security filters:
```javascript
// Automatic filter applied
statecode eq 0 and _cp_contact_value eq {userContactId}
```

## Best Practices

### 1. Always Use REST Builder First
Before configuring any entity, test your OData queries in Dataverse REST Builder:
- Open your Dataverse environment
- Go to Advanced Settings > Customizations > Developer Resources
- Use "OData Endpoint" and REST Builder

### 2. Check System Logs
The first time you access an entity, check browser console for:
```
📖 COMMUNITY CONFIGURATION GUIDANCE
```

### 3. Document Your Findings
Copy the generated guidance and add it to your entity documentation.

### 4. Test Incrementally
- Start with basic fields
- Add lookup fields one at a time
- Verify each step works before adding complexity

### 5. Use Consistent Naming
- Entity names: `cp_entityname`
- Field names: `cp_fieldname`
- Navigation properties: `cp_FieldName` (preserve original casing)

## FAQ

**Q: How do I know the correct navigation property name?**
A: Check the system logs when first accessing the entity, or use the EntityDefinitions API.

**Q: Why is my lookup field showing GUIDs instead of names?**
A: Either the navigation property casing is wrong, or the expand clause is missing.

**Q: Can I use the same pattern for all lookup fields?**
A: No, each lookup field may have different casing in its navigation property. Always check the metadata.

**Q: What if my field was created with different casing?**
A: The navigation property preserves the original casing from when the field was created. Use the auto-discovery to find the correct name.

## Need Help?

1. **Check the logs** - Most configuration issues are logged with solutions
2. **Use REST Builder** - Test queries there first
3. **Open an issue** - Include the entity name and error details
4. **Share your configuration** - Help others by documenting working configurations

---

*This guide is automatically updated as new patterns are discovered in the community.*
