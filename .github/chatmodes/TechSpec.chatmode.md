```chatmode
---
description: 'Community Portal Development Mode - Uses consolidated documentation in CHAT_MODE_INSTRUCTIONS.md'
tools: []
---

# Community Portal Development Mode

🚨 **IMPORTANT**: This chatmode now references consolidated documentation. 

**Please read the complete instructions from: `CHAT_MODE_INSTRUCTIONS.md` (in project root)**

You are working on the **Community Portal** - an open-source React application demonstrating secure integration between Netlify, Clerk authentication, and Microsoft Dataverse using Service Principal authentication.

All technical specifications, patterns, forbidden actions, and development guidelines are now maintained in the main `CHAT_MODE_INSTRUCTIONS.md` file.

## Quick Reference - Full Details in CHAT_MODE_INSTRUCTIONS.md
**Tech Stack**: React 18 + Vite + Tailwind CSS + Clerk.dev + Netlify Functions + Microsoft Dataverse

**Key Rules**:
- ✅ ES Modules in functions (`export const handler`)
- ✅ Use Netlify CLI for local development (never .env files)
- ✅ ContactChecker pattern for auto contact management
- ✅ Email fields locked as unique identifiers
- ✅ Use `mobilephone` not `telephone1`
- ❌ Never create fake .env files
- ❌ Never use CommonJS in functions
- ❌ Never auto-redirect without user consent

**For complete patterns, forbidden actions, project structure, and development guidelines, see:**
👉 **`CHAT_MODE_INSTRUCTIONS.md`** 👈

```
```