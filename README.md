# 🌐 Community Portal - Dataverse Starter

A modern, open-source starter template for building community portals that connect to Microsoft Dataverse. This project demonstrates how to create a production-ready web application using React, Clerk authentication, and Netlify Functions with secure Service Principal authentication to Dataverse.

## 🎯 Project Goals

- **Frontend on Netlify**: React app with Vite + Tailwind CSS hosted on Netlify's free tier
- **Authentication**: Clerk.dev supporting both work accounts (Microsoft Entra ID) and personal emails
- **Secure Backend**: Service Principal authentication to Dataverse (no delegated user auth)
- **Contact Management**: Allow users to view and edit their Contact record in Dataverse
- **Developer-Friendly**: Clean, modular codebase designed for AI-assisted development and easy extension

## 🛠 Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Authentication**: Clerk.dev (supports Microsoft Entra ID, Google, Outlook, etc.)
- **Backend**: Netlify Functions (serverless)
- **Database**: Microsoft Dataverse
- **Hosting**: Netlify (free tier)

## 🏗 Project Structure

```
/
├── functions/
│   ├── auth.js         # Service Principal authentication with Azure AD
│   └── contact.js      # Contact CRUD operations with Dataverse
├── src/
│   ├── components/
│   │   └── ContactForm.jsx  # React form for Contact fields
│   ├── pages/
│   │   ├── Login.jsx        # Login page with Clerk SignIn
│   │   └── MyPage.jsx       # Protected page for contact management
│   ├── App.jsx              # Main app with routing and auth
│   ├── main.jsx             # Vite entrypoint with ClerkProvider
│   └── index.css            # Tailwind CSS imports
├── .env.example        # Environment variables template
├── netlify.toml        # Netlify configuration
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

## 🚀 Getting Started

Follow this step-by-step guide to create your own Community Portal:

### Step 1: Set Up Microsoft Dataverse Environment

1. **Get a Dataverse Environment**:
   - Go to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com)
   - Create a new environment or use an existing one
   - Note your environment URL (e.g., `https://yourorg.crm.dynamics.com`)

2. **Ensure Contact Table is Available**:
   - The Contact table is available by default in Dataverse
   - No additional setup needed for this starter project

### Step 2: Create Azure App Registration (Service Principal)

1. **Create App Registration**:
   - Go to [Azure Portal](https://portal.azure.com) → **App registrations** → **New registration**
   - Name: `Community Portal Service Principal`
   - Supported account types: `Single tenant`
   - Redirect URI: Leave blank (not needed for Service Principal)
   - Click **Register**

2. **Copy Important Values**:
   - **Application (client) ID** → Save as `CLIENT_ID`
   - **Directory (tenant) ID** → Save as `TENANT_ID`

3. **Create Client Secret**:
   - Go to **Certificates & secrets** → **Client secrets** → **New client secret**
   - Description: `Community Portal Secret`
   - Expires: Choose appropriate duration
   - **Copy the secret VALUE immediately** → Save as `CLIENT_SECRET`
   - ⚠️ You cannot see this value again after leaving the page

4. **Add API Permissions**:
   - Go to **API permissions** → **Add a permission**
   - Select **Dynamics CRM** → **Delegated permissions**
   - Check **user_impersonation**
   - Click **Add permissions**
   - Click **Grant admin consent for [Your Tenant]** (requires admin rights)

### Step 3: Create Application User in Dataverse

1. **Access Power Platform Admin Center**:
   - Go to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com)
   - Select your environment

2. **Create Application User**:
   - Go to **Settings** → **Users + permissions** → **Application users**
   - Click **+ New app user**
   - Click **+ Add an app** → Select your App Registration from Step 2
   - **Business unit**: Select your business unit
   - **Security roles**: Assign appropriate roles:
     - Basic User (required)
     - Add custom role with Contact read/write permissions, or
     - System Administrator (for testing - not recommended for production)

3. **Verify Setup**:
   - The application user should now appear in the list
   - Note the **Application ID** matches your `CLIENT_ID`

### Step 4: Set Up Clerk Authentication

1. **Create Clerk Application**:
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Click **Add application**
   - Choose your application name: `Community Portal`
   - Select sign-in options (Email, Google, Microsoft, etc.)
   - Click **Create application**

2. **Configure Authentication Methods**:
   - Enable desired social providers
   - For Microsoft work accounts: Add Microsoft as a social provider
   - Configure redirect URLs if needed

3. **Copy API Keys**:
   - From the Clerk dashboard, copy:
   - **Publishable key** → Save as `VITE_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → Save as `CLERK_SECRET_KEY`

### Step 5: Fork and Deploy the Project

1. **Fork the Repository**:
   - Go to [Community Portal GitHub](https://github.com/thomassandsor/CommunityPortal)
   - Click **Fork** to create your own copy

2. **Deploy to Netlify**:
   - Go to [Netlify](https://app.netlify.com)
   - Click **Add new site** → **Import an existing project**
   - Connect to GitHub and select your forked repository
   - **Build settings**:
     - Build command: `npm run build`
     - Publish directory: `dist`
     - Functions directory: `functions`
   - Click **Deploy site**

### Step 6: Configure Environment Variables in Netlify

1. **Access Site Settings**:
   - In your Netlify dashboard, go to your site
   - Click **Site settings** → **Environment variables**

2. **Add All Environment Variables**:
   ```
   TENANT_ID = [your-azure-tenant-id]
   CLIENT_ID = [your-app-registration-client-id]
   CLIENT_SECRET = [your-app-registration-client-secret]
   DATAVERSE_URL = [https://yourorg.crm.dynamics.com]
   VITE_CLERK_PUBLISHABLE_KEY = [pk_live_your-clerk-key]
   CLERK_SECRET_KEY = [sk_live_your-clerk-secret]
   ```

3. **Redeploy**:
   - Go to **Deploys** tab → **Trigger deploy** → **Deploy site**
   - Wait for build to complete

### Step 7: Set Up Local Development (Netlify CLI)

For secure local testing with real environment variables:

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**:
   ```bash
   netlify login
   ```
   This will open your browser to authenticate with Netlify.

3. **Link Your Local Project**:
   ```bash
   netlify link
   ```
   Select your Community Portal site from the list.

4. **Run Locally with Real Environment Variables**:
   ```bash
   netlify dev
   ```
   This runs your site at `http://localhost:8888` with access to your Netlify environment variables.

**Benefits of Netlify CLI:**
- ✅ **Real credentials** - Uses your actual Netlify environment variables
- ✅ **Production parity** - Exact same environment as deployed site
- ✅ **Secure** - No need for local `.env` files with secrets
- ✅ **Functions work** - Test Netlify Functions locally
- ✅ **Clean codebase** - No development workarounds needed

### Step 8: Test Your Portal

1. **Visit Your Site** (Production):
   - Your Netlify site will have a URL like: `https://amazing-name-123456.netlify.app`

2. **Visit Your Site** (Local Development):
   - After running `netlify dev`: `http://localhost:8888`

3. **Test Authentication**:
   - Click sign in
   - Use one of the configured authentication methods
   - You should be redirected to the contact management page

4. **Test Contact Management**:
   - The system will automatically create or find your contact in Dataverse
   - Try updating your information and saving

## 🔧 Development Workflow

### **For Regular Development:**
```bash
# Clone your fork
git clone https://github.com/yourusername/CommunityPortal.git
cd CommunityPortal

# Install dependencies
npm install

# Set up Netlify CLI (one-time setup)
npm install -g netlify-cli
netlify login
netlify link

# Run locally with production environment
netlify dev
```

### **For UI-Only Development:**
If you only need to test UI changes without authentication:
```bash
# Standard Vite development (no environment variables)
npm run dev
# Visit http://localhost:5173
# Note: Authentication will fail, but UI/styling can be tested
```

### **Build Testing:**
```bash
# Test production build
npm run build
npm run preview
```

## ⚙️ Detailed Configuration Reference

The Getting Started section above provides the complete setup process. This section provides additional technical details for advanced users.

### Azure App Registration Details

The Service Principal approach provides several benefits:
- **Security**: No user credentials exposed in application code
- **Scalability**: Single service account handles all operations  
- **Compliance**: Easier to audit and manage permissions
- **Production-Ready**: Microsoft's recommended approach for server-to-server authentication

### Dataverse Security Roles

For production deployments, create a custom security role with minimal permissions:
- **Contact Entity**: Read, Write, Create permissions
- **User Entity**: Read permission (for application user)
- **System Jobs**: Read permission (for monitoring)

### Clerk Configuration Tips

- **Work Accounts**: Enable Microsoft social provider for seamless work account login
- **Personal Accounts**: Enable Google, GitHub, or other providers as needed
- **Multi-factor**: Consider enabling MFA for production applications
- **Webhooks**: Configure webhooks for user lifecycle events if needed

## 🔧 How It Works

### Authentication Flow

1. **User Login**: User signs in via Clerk (supports work/personal accounts)
2. **Service Principal**: Backend uses App Registration to get Dataverse access token
3. **Contact Lookup**: System finds Contact by email address in Dataverse
4. **Contact Management**: User can view/edit their Contact record

### Service Principal Benefits

- **Security**: No user credentials stored or transmitted
- **Scalability**: Single service account for all operations
- **Compliance**: Easier to audit and manage permissions
- **Production-Ready**: Recommended approach for enterprise applications

### API Endpoints

- `GET /.netlify/functions/contact?email={email}` - Find contact by email
- `POST /.netlify/functions/contact` - Create or update contact

## 🎨 Customization

### Adding New Tables

1. Create a new function: `functions/opportunity.js`
2. Follow the same pattern as `contact.js`
3. Add new React components for the UI
4. Update routing in `App.jsx`

### Adding New Fields

1. Update the ContactForm component
2. Modify the contact.js function to handle new fields
3. Ensure your Dataverse schema includes the new fields

### Styling

- Uses Tailwind CSS for styling
- Customize `tailwind.config.js` for your brand colors
- All components use consistent Tailwind classes

## 🚨 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TENANT_ID` | Azure AD tenant ID | Yes |
| `CLIENT_ID` | App registration client ID | Yes |
| `CLIENT_SECRET` | App registration client secret | Yes |
| `DATAVERSE_URL` | Your Dataverse environment URL | Yes |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (frontend) | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key (backend) | Yes |

⚠️ **Security Note**: Never commit `.env` files. All secrets should be stored in Netlify environment variables for production.

🔒 **Security Features**: This application implements comprehensive security measures including error sanitization, rate limiting, input validation, and secure logging. See [SECURITY_ASSESSMENT.md](./SECURITY_ASSESSMENT.md) for detailed security analysis.

## 🧪 Development

### Run Development Server
```bash
npm run dev          # Frontend only
npm run netlify:dev  # Full stack with functions
```

### Build for Production
```bash
npm run build
npm run preview
```

### Linting
```bash
npm run lint
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## � Troubleshooting

### Build Issues

**"Failed to load PostCSS config"**
- Make sure `postcss.config.cjs` exists (not `.js`)
- Run `npm install` to ensure dependencies are installed

**"Missing environment variables"**
- Verify all required environment variables are set in Netlify
- Check variable names exactly match (case-sensitive)
- Redeploy after adding environment variables

### Authentication Issues

**"Failed to obtain access token"**
- **Check App Registration**:
  - Verify CLIENT_ID, CLIENT_SECRET, and TENANT_ID are correct
  - Ensure API permissions include "Dynamics CRM → user_impersonation"
  - Confirm admin consent has been granted
- **Check Application User**:
  - Verify application user exists in your Dataverse environment
  - Ensure correct security roles are assigned
  - Application ID should match your CLIENT_ID

**"Contact not found" or permission errors**
- **Security Roles**: Ensure application user has read/write access to Contact table
- **Environment**: Verify DATAVERSE_URL points to correct environment
- **Environment Mode**: Check if environment is in Administration mode (restricts access)

**Clerk authentication not working**
- Verify VITE_CLERK_PUBLISHABLE_KEY is correct and starts with `pk_`
- Check CLERK_SECRET_KEY is correct and starts with `sk_`
- Ensure allowed origins are configured in Clerk dashboard

### Deployment Issues

**Netlify build failing**
- Check build logs for specific error messages
- Verify all environment variables are set
- Ensure build command is `npm run build`
- Confirm publish directory is `dist`

**Functions not working**
- Verify functions directory is set to `functions` in Netlify
- Check function logs in Netlify dashboard
- Ensure environment variables are available to functions

### Network Issues

**CORS errors**
- Functions include proper CORS headers (should work by default)
- Check browser developer tools for specific CORS errors
- Verify requests are going to correct function URLs

**API timeouts**
- Dataverse requests may timeout with large datasets
- Check Dataverse environment health
- Verify network connectivity between Netlify and Dataverse

### Data Issues

**Contact creation failing**
- Check that email format is valid
- Verify required fields are provided
- Ensure application user has create permissions on Contact table
- Check for any validation rules on Contact entity in Dataverse

## 📞 Getting Help

- **GitHub Issues**: [Create an issue](../../issues) for bugs or feature requests
- **Discussions**: [Join discussions](../../discussions) for community help
- **Documentation**: Review [Microsoft Dataverse docs](https://docs.microsoft.com/power-apps/developer/data-platform/)
- **Clerk Support**: Check [Clerk documentation](https://clerk.com/docs)

## 🤖 AI-Assisted Development

This project is designed for AI-assisted development ("vibe coding"). For consistent results:

1. **Use Custom Chat Mode**: Reference `CHAT_MODE_INSTRUCTIONS.md` or `.chatmode.json` when working with AI assistants
2. **Follow Established Patterns**: The codebase uses consistent patterns that AI can easily recognize and extend
3. **Maintain Architecture**: Stick to the defined tech stack and file structure for best results

### Example AI Prompts
```
"Add a new Case table following the Contact pattern"
"Create a search component using our existing styling patterns"
"Add phone number validation to the ContactForm component"
```

## 🎯 Next Steps

This starter provides a foundation for:

- Multi-table data management (follow the Contact pattern)
- Advanced authentication scenarios
- Custom business logic in Netlify Functions
- Integration with other Power Platform services
- AI-assisted development with clear, modular code

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- Open an issue for bugs or feature requests
- Check the [Discussions](../../discussions) for community help
- Review Netlify and Clerk documentation for platform-specific issues

---

**Built with ❤️ for the community**

This project is designed to be a learning resource and starter template. Feel free to fork, extend, and share your improvements!
