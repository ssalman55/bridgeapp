# Microsoft Teams Integration - Quick Start Guide

## ⚡ 5-Minute Setup for Admins

### Phase 1: Azure Setup (5 minutes)

1. **Go to Azure Portal**: https://portal.azure.com
2. **Create App Registration**:
   - Azure Entra ID → App registrations → New registration
   - Name: `StaffBridge Teams`
   - Register
3. **Copy These Values** (save in notepad):
   - **Tenant ID**: Overview tab
   - **Client ID**: Overview tab
4. **Create Client Secret**:
   - Certificates & secrets → New client secret
   - Expiration: 24 months
   - Copy the **Value** immediately

### Phase 2: StaffBridge Configuration (2 minutes)

1. **Login as Admin** to StaffBridge
2. **Go to**: Admin Menu → Teams Integration
3. **Fill in**:
   - Toggle: Enable Azure Entra ID ✓
   - Paste Tenant ID
   - Paste Client ID
   - Paste Client Secret
4. **Test**: Click "Test Connection" button
5. **Enable**: Toggle "Enable Teams Calling" ✓
6. **Save**: Click "Save Configuration"

✅ **Done!** Teams buttons appear on Staff Profiles

---

## 🎯 For Users (1 minute)

1. Go to **People → Staff Profiles**
2. See **Teams button** (💬) next to each person
3. Click Teams button
4. Teams opens and calls that person
5. Done! ✅

---

## 📋 Deployment Checklist (Quick)

- [ ] Backend deployed (Render/Heroku/VPS)
- [ ] Frontend built (`npm run build`)
- [ ] Frontend deployed (Vercel/Netlify/Server)
- [ ] Admin can access Teams Integration Settings
- [ ] Test Connection works with real credentials
- [ ] Teams button appears on Staff Profiles
- [ ] Clicking Teams button opens Teams app/web
- [ ] Announce to users

---

## 🆘 Troubleshooting Quick Guide

| Problem | Solution |
|---------|----------|
| Test Connection fails | Check Tenant ID and Client ID - no typos |
| Teams button doesn't appear | Refresh page, check if Teams is enabled |
| Click Teams button = nothing | Have Teams installed or use web.teams.microsoft.com |
| Settings page won't load | Verify you're logged in as Admin |
| Getting 404 errors | Backend might not be deployed yet |

---

## 📚 Full Documentation

- **Admin Guide**: TEAMS_INTEGRATION_GUIDE.md
- **User Guide**: TEAMS_INTEGRATION_GUIDE.md (scroll down)
- **Deployment**: TEAMS_DEPLOYMENT_CHECKLIST.md
- **Build**: BUILD_INSTRUCTIONS.md
- **Summary**: TEAMS_IMPLEMENTATION_SUMMARY.md

---

## 🚀 Go Live!

```bash
# Backend
cd backend && npm start

# Frontend
cd frontend && npm run build
# Deploy dist/ folder to hosting
```

**That's it!** You're live with Teams integration! 🎉


