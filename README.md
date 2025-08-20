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

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd CommunityPortal
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Azure AD / Dataverse
TENANT_ID=your-azure-tenant-id
CLIENT_ID=your-app-registration-client-id
CLIENT_SECRET=your-app-registration-client-secret
DATAVERSE_URL=https://yourorg.crm.dynamics.com

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret-key
```

### 3. Run Locally

```bash
npm run netlify:dev
```

Visit `http://localhost:8888` to see your portal!

## ⚙️ Setup Guide

### Step 1: Create Azure App Registration

1. Go to [Azure Portal](https://portal.azure.com) → **App registrations** → **New registration**
2. Set name: `Community Portal Service Principal`
3. Set redirect URI: `Single-page application` → `http://localhost:8888` (for dev)
4. Click **Register**

**After creation:**
- Copy the **Application (client) ID** → use as `CLIENT_ID`
- Copy the **Directory (tenant) ID** → use as `TENANT_ID`
- Go to **Certificates & secrets** → **New client secret** → copy value → use as `CLIENT_SECRET`

### Step 2: Configure API Permissions

1. In your App Registration, go to **API permissions**
2. Click **Add a permission** → **Dynamics CRM** → **Delegated permissions**
3. Check **user_impersonation**
4. Click **Add permissions**
5. Click **Grant admin consent** (requires admin)

### Step 3: Create Application User in Dataverse

1. Go to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com)
2. Select your environment → **Settings** → **Users + permissions** → **Application users**
3. Click **New app user**
4. Click **Add an app** → select your App Registration
5. Select **Business unit** and **Security roles** (e.g., "Basic User" + custom role with Contact permissions)
6. Click **Create**

### Step 4: Set Up Clerk Authentication

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application
3. Enable desired social providers (Google, Microsoft, etc.)
4. Copy **Publishable key** → use as `VITE_CLERK_PUBLISHABLE_KEY`
5. Copy **Secret key** → use as `CLERK_SECRET_KEY`

### Step 5: Deploy to Netlify

#### Option A: Deploy to Netlify Button
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/yourusername/community-portal)

#### Option B: Manual Deployment
1. Build the project: `npm run build`
2. Connect your GitHub repo to Netlify
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variables in Netlify dashboard

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

## 📝 Common Issues

### "Failed to obtain access token"
- Check that your App Registration has correct API permissions
- Verify that admin consent has been granted
- Ensure CLIENT_ID, CLIENT_SECRET, and TENANT_ID are correct

### "Contact not found" errors
- Verify your Application User has read/write permissions on Contact table
- Check that DATAVERSE_URL is correct and accessible
- Ensure your environment is not in Administration mode

### CORS errors
- Functions include proper CORS headers
- If issues persist, check Netlify function logs

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
