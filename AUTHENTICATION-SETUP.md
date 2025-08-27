# Authentication Setup Guide

This Community Portal supports multiple authentication configurations to suit different needs.

## Quick Start (Minimal Setup)

For new users who just want to get started quickly:

### 1. Disable Custom Login (Optional)
In `src/pages/shared/Landing.jsx`, change:
```javascript
const AUTH_CONFIG = {
    enableSeparateLogin: false, // ← Change to false for simple setup
    // ... other settings
}
```

### 2. Basic Clerk Setup
1. Create a free [Clerk account](https://clerk.dev)
2. Create a new application
3. Copy your publishable key and secret key
4. Set environment variables in Netlify:
   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   CLERK_SECRET_KEY=sk_test_your_key_here
   ```

That's it! The app will use standard Clerk authentication with email/password.

## Advanced Setup (B2B/B2C Separation)

For the full experience with separate business and personal login:

### 1. Enable Custom Login
Keep `enableSeparateLogin: true` in `AUTH_CONFIG`

### 2. Configure Social Providers in Clerk

#### For Microsoft (Business Login):
1. Create Azure App Registration (see [Azure setup guide](./AZURE-SETUP.md))
2. In Clerk Dashboard: Configure → SSO Connections → Microsoft
3. Enter your Azure App Registration credentials

#### For Google (Personal Login):
1. Create Google OAuth application
2. In Clerk Dashboard: Configure → SSO Connections → Google  
3. Enter your Google OAuth credentials

### 3. Customize Providers (Optional)
You can change which providers are used by editing `AUTH_CONFIG`:
```javascript
const AUTH_CONFIG = {
    enableSeparateLogin: true,
    businessProvider: 'oauth_microsoft', // or oauth_google, oauth_github, etc.
    personalProvider: 'oauth_google',    // or oauth_github, oauth_discord, etc.
    fallbackToStandardLogin: true       // Always shows standard login as backup
}
```

## Fallback Protection

The app automatically provides fallback options:

1. **Error Handling**: If custom OAuth fails, users see helpful error messages
2. **Standard Login**: Always available as a backup when `fallbackToStandardLogin: true`
3. **Simple Mode**: Set `enableSeparateLogin: false` to disable custom login entirely

## Environment Variables

### Required (Minimum):
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
```

### Optional (For Dataverse Integration):
```
TENANT_ID=your_azure_tenant_id
CLIENT_ID=your_dataverse_service_principal_id  
CLIENT_SECRET=your_dataverse_service_principal_secret
DATAVERSE_URL=https://your_org.crm.dynamics.com/
```

## Deployment Notes

- The app works with basic Clerk setup out of the box
- Social providers are optional enhancements
- All authentication logic is contained in `Landing.jsx` for easy customization
- Fallback ensures the app never breaks due to missing OAuth configuration

## Support

If you encounter issues:
1. Check the browser console for specific error messages
2. Verify your Clerk keys are correct
3. Use the fallback standard login if custom providers fail
4. See individual provider setup guides for detailed configuration
