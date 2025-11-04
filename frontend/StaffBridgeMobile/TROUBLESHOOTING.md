# Troubleshooting Guide

## Network Error on Login

### Common Causes:
1. **Backend server is down or unreachable** (most common)
2. **Render.com cold start** - Free tier services spin down after inactivity (takes 30-60s to wake up)
3. **Network connectivity issues** on device/emulator
4. **Firewall or VPN blocking connections**

### Solutions:

#### 1. Check Backend Status
- Open browser and visit: `https://sbapp.onrender.com/api/mobile/login`
- You should see an error (method not allowed) but NOT a connection error
- If you get "This site can't be reached", the backend is down

#### 2. Wait for Cold Start
- If using Render.com free tier, wait 30-60 seconds after first failed attempt
- The first request wakes up the server

#### 3. Restart Metro Bundler
```bash
# Stop Metro bundler (Ctrl+C)
# Then restart:
cd frontend/StaffBridgeMobile
npm start
```

#### 4. Check Device/Emulator Network
- Ensure device/emulator has internet connection
- On Android emulator, ensure Wi-Fi is enabled
- On iOS simulator, ensure it's connected to network

#### 5. Check API Base URL
- Verify the API URL in `src/services/api.ts`:
  ```typescript
  const API_BASE_URL = 'https://sbapp.onrender.com/api';
  ```

---

## "No Apps Connected" Error

This means Metro bundler can't communicate with the emulator/device.

### Solutions:

#### 1. Restart Metro Bundler
```bash
# Stop Metro bundler (Ctrl+C in terminal)
cd frontend/StaffBridgeMobile
npm start -- --reset-cache
```

#### 2. Reload App Manually
- In emulator: Press `R` key twice (Android) or `Cmd+R` (iOS)
- Or shake device and select "Reload"

#### 3. Check Metro Bundler Status
- Look for "Metro waiting on..." message in terminal
- Should show "exp://..." URL

#### 4. Restart Emulator/Simulator
- Close and reopen Android emulator
- Or restart iOS simulator

#### 5. Check ADB Connection (Android only)
```bash
adb devices
# Should show your emulator listed
```

#### 6. Clear Cache and Restart
```bash
cd frontend/StaffBridgeMobile
# Clear Expo cache
npx expo start -c

# Or clear all caches
rm -rf node_modules
npm install
npx expo start -c
```

#### 7. Use Dev Client (if using expo-dev-client)
```bash
npm run start:dev
```

---

## Quick Fix Checklist

1. ✅ Check backend is running: Visit `https://sbapp.onrender.com`
2. ✅ Restart Metro bundler: `npm start -- --reset-cache`
3. ✅ Reload app in emulator: Press `R` twice or shake device
4. ✅ Check network connectivity on device/emulator
5. ✅ Verify API_BASE_URL in `src/services/api.ts`
6. ✅ Wait 30-60 seconds if backend uses free tier hosting (cold start)

---

## Still Having Issues?

Check the console logs for:
- `ERR_NETWORK` - Server unreachable
- `ECONNABORTED` - Request timeout
- `401` - Authentication failed (credentials issue)
- `500` - Server error (backend issue)

