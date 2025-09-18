# 🌐 Community Portal - Dataverse Starter

A production-ready starter template for building community portals with Microsoft Dataverse integration. Copy this project and have your own portal running in 30-45 minutes!

#### 📚 Documentation

### Setup & Configuration
- **[HOW-TO-GUIDE.md](HOW-TO-GUIDE.md)** - Complete setup instructions
- **[ENTITY_CONFIGURATION.md](docs/ENTITY_CONFIGURATION.md)** - Configure dynamic entities
- **[ICON_REFERENCE.md](docs/ICON_REFERENCE.md)** - Available menu icons

### Architecture & Development  
- **[CHAT_MODE_INSTRUCTIONS.md](CHAT_MODE_INSTRUCTIONS.md)** - AI assistant guide
- **[DYNAMIC_ENTITY_CONFIG.md](docs/DYNAMIC_ENTITY_CONFIG.md)** - Technical architecture
- **[SERVER_SIDE_SECURITY.md](docs/SERVER_SIDE_SECURITY.md)** - Security implementation

### Project Status
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Current system status and features

## � License

MIT License - see [LICENSE](LICENSE) file for details.

## 💬 Support

- **Issues**: [GitHub Issues](../../issues) for bugs and feature requests
- **Discussions**: [GitHub Discussions](../../discussions) for community help
- **Setup Help**: Review [HOW-TO-GUIDE.md](HOW-TO-GUIDE.md) for complete setup
- **Entity Config**: See [ENTITY_CONFIGURATION.md](docs/ENTITY_CONFIGURATION.md) for adding entities
- **AI Development**: Use [CHAT_MODE_INSTRUCTIONS.md](CHAT_MODE_INSTRUCTIONS.md) with AI assistantsStart

**👉 [Complete Setup Guide - HOW-TO-GUIDE.md](HOW-TO-GUIDE.md) 👈**

The comprehensive guide walks you through every step from start to finish.

## 🎯 What You Get

- **Modern React App** hosted on Netlify (free tier)
- **Secure Authentication** via Clerk.dev (work + personal accounts)  
- **Microsoft Dataverse Integration** for contact management
- **Production-Ready Security** with rate limiting, input validation, CORS
- **Easy Customization** - Add your own tables, fields, and business logic
- **AI-Friendly Architecture** - Clean patterns for AI-assisted development

## � Prerequisites

- Microsoft 365 admin access (for Azure App Registration)
- Power Platform environment (Dataverse access)
- GitHub account
- Netlify account (free tier)
- Clerk account (authentication service)

## ⚡ Quick Setup Summary

1. **[HOW-TO-GUIDE.md](HOW-TO-GUIDE.md)** - Complete step-by-step instructions
2. **Fork this repository**
3. **Set up Azure App Registration** (Service Principal)
4. **Create Dataverse Application User**
5. **Configure Clerk authentication**
6. **Deploy to Netlify** with environment variables
7. **Test your portal**

**⏱️ Setup Time: 30-45 minutes**

## 🛠 Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Authentication**: Clerk.dev (supports Microsoft Entra ID, Google, Outlook, etc.)
- **Backend**: Netlify Functions (serverless)
- **Database**: Microsoft Dataverse
- **Hosting**: Netlify (free tier)

## 🏗 Project Structure

```
CommunityPortal/
├── src/
│   ├── components/
│   │   ├── ContactChecker.jsx  # Auto contact management
│   │   ├── ContactForm.jsx     # Contact data form
│   │   └── Sidebar.jsx         # Navigation component
│   ├── pages/
│   │   ├── Landing.jsx         # Public landing page
│   │   ├── Welcome.jsx         # Post-login welcome
│   │   ├── MyPage.jsx          # User profile/dashboard
│   │   └── Success.jsx         # Confirmation page
│   ├── App.jsx                 # Main app with routing
│   ├── main.jsx                # Vite entrypoint with ClerkProvider
│   └── index.css               # Tailwind CSS imports
├── functions/
│   ├── auth.js                 # Service Principal authentication
│   └── contact.js              # Contact CRUD operations
├── HOW-TO-GUIDE.md             # Complete setup instructions
├── CHAT_MODE_INSTRUCTIONS.md   # AI assistant guide
├── netlify.toml                # Netlify configuration
└── package.json                # Dependencies and scripts
```

## 🔐 Security Features

- **Service Principal Authentication** - Secure server-to-server Dataverse access
- **Input Validation & Sanitization** - All user input is validated and sanitized
- **Rate Limiting** - Prevents API abuse (30 requests/minute per IP)
- **CORS Protection** - Proper cross-origin request handling
- **Environment Variable Security** - No secrets in frontend code
- **Request Size Limits** - Prevents payload overflow attacks

## 🔧 Development Workflow

### Daily Development

```bash
# Clone your fork
git clone https://github.com/yourusername/CommunityPortal.git
cd CommunityPortal

# Install dependencies
npm install

# Set up Netlify CLI (one-time)
npm install -g netlify-cli
netlify login
netlify link

# Start development with real environment variables
netlify dev
```

### Build and Deploy

```bash
# Test production build locally
npm run build
npm run preview

# Commit and push to trigger Netlify deployment
git add .
git commit -m "Your changes"
git push origin main
```

## 🎨 Customization

### Add New Contact Fields

1. Update `src/components/ContactForm.jsx` with new input fields
2. Modify `functions/contact.js` to handle new fields in database operations
3. Ensure your Dataverse Contact entity has the required fields

### Add New Tables

1. Create new function following `functions/contact.js` pattern
2. Create new React components following existing patterns
3. Add new routes in `src/App.jsx`
4. Update navigation components

### Styling

- Uses Tailwind CSS exclusively
- Customize `tailwind.config.js` for brand colors
- All components use consistent utility classes
- Responsive design with mobile-first approach

## ⚠️ Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TENANT_ID` | Azure AD tenant ID | `12345678-1234-1234-1234-123456789abc` |
| `CLIENT_ID` | App registration client ID | `87654321-4321-4321-4321-cba987654321` |
| `CLIENT_SECRET` | App registration secret | `ABC123~XYZ789.secretvalue` |
| `DATAVERSE_URL` | Dataverse environment URL | `https://yourorg.crm.dynamics.com` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend key | `pk_live_Y29tbXVuaXR5cG9ydGFs...` |
| `CLERK_SECRET_KEY` | Clerk backend key | `sk_live_abcdef123456...` |

**⚠️ Security**: Never commit secrets to Git. Use Netlify environment variables for production.

## 🚨 Troubleshooting

### Quick Fixes

**Authentication Issues:**
- Verify all environment variables are set correctly in Netlify
- Check Azure App Registration permissions include "Dynamics CRM → user_impersonation"
- Ensure Application User exists in Dataverse with proper security roles

**Build/Deploy Issues:**
- Confirm build command is `npm run build` and publish directory is `dist`
- Check Netlify function logs for specific error messages
- Redeploy after adding environment variables

**Local Development Issues:**
- Use `netlify dev` instead of `npm run dev` for full functionality
- Ensure you're linked to the correct Netlify site with `netlify link`
- Verify Netlify CLI is authenticated with `netlify status`

**For detailed troubleshooting:** See [HOW-TO-GUIDE.md](HOW-TO-GUIDE.md)

## 🎯 Reusability Assessment

### ✅ EXCELLENT for Reuse

- **Complete Documentation** - Step-by-step setup guide
- **Production Ready** - Security, error handling, rate limiting included
- **Free Tier Compatible** - Works on free service tiers
- **Modern Architecture** - Current best practices
- **AI-Friendly** - Clean patterns for AI-assisted development

### ⚠️ Considerations

- **Microsoft Admin Access Required** - Need organizational Azure/O365 admin rights
- **Multiple Service Setup** - 4-5 platforms to configure
- **Learning Curve** - Moderate technical complexity

**Difficulty Level: MODERATE** (30-45 minutes for technical users)

## 🤖 AI-Assisted Development

This project is optimized for AI-assisted development:

1. **Reference** `CHAT_MODE_INSTRUCTIONS.md` for AI context
2. **Follow** established patterns when adding features
3. **Use** semantic search for finding relevant code examples
4. **Extend** using the documented patterns and conventions

### Example AI Prompts
```
"Add a new Case table following the Contact pattern"
"Create a search component using existing styling"
"Add phone validation to ContactForm"
```

## � Success Stories

After setup, your Community Portal provides:
- ✅ Secure authentication for work and personal accounts
- ✅ Automatic contact management with Dataverse
- ✅ Production-ready security and error handling
- ✅ Scalable architecture for additional features
- ✅ Cost-effective deployment on free tiers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow existing code patterns and conventions
4. Test thoroughly with `netlify dev`
5. Update documentation if needed
6. Submit a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## � Support

- **Issues**: [GitHub Issues](../../issues) for bugs and feature requests
- **Discussions**: [GitHub Discussions](../../discussions) for community help
- **Documentation**: Review [HOW-TO-GUIDE.md](HOW-TO-GUIDE.md) for setup help
- **AI Development**: Use [CHAT_MODE_INSTRUCTIONS.md](CHAT_MODE_INSTRUCTIONS.md) with AI assistants

---

**🚀 Ready to build your community portal? Start with [HOW-TO-GUIDE.md](HOW-TO-GUIDE.md)**
