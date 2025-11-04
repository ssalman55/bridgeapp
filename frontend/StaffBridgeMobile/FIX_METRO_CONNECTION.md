# Fix "No Apps Connected" Error

## Quick Fix Steps (Try in Order)

### Step 1: Stop Everything and Clean Start

1. **Stop Metro Bundler**
   - Press `Ctrl+C` in the terminal where Metro is running
   - Wait a few seconds for it to fully stop

2. **Close the Emulator/Simulator**
   - Android: Close the emulator window
   - iOS: Close the simulator

3. **Clear Metro Cache**
   ```bash
   cd frontend/StaffBridgeMobile
   npx expo start -c
   ```
   (The `-c` flag clears the cache)

### Step 2: Start Fresh

#### Option A: Using Expo CLI (Recommended)
```bash
cd frontend/StaffBridgeMobile
npm start
```
Then:
- For Android: Press `a` in the Metro terminal
- For iOS: Press `i` in the Metro terminal
- Or scan QR code if using Expo Go on physical device

#### Option B: Using Android/iOS Direct Commands
```bash
# Android
npm run android

# iOS
npm run ios
```

### Step 3: Manual Reload in Emulator

Once the app is running in the emulator:
- **Android**: Press `R` key twice quickly, OR shake the emulator and tap "Reload"
- **iOS**: Press `Cmd+R` (Mac) or `Ctrl+R` (Windows/Linux)

### Step 4: If Still Not Working - Check ADB (Android Only)

```bash
# Check if ADB sees your emulator
adb devices

# If nothing shows, restart ADB server
adb kill-server
adb start-server
adb devices
```

### Step 5: Nuclear Option - Full Reset

```bash
cd frontend/StaffBridgeMobile

# Stop all processes first (Ctrl+C)

# Clear all caches
npx expo start -c --reset-cache

# Or if that doesn't work:
rm -rf node_modules
rm -rf .expo
npm install
npx expo start -c
```

---

## Common Causes & Solutions

### Cause 1: Metro Bundler Started Before Emulator
**Solution**: Always start the emulator first, then start Metro

### Cause 2: Multiple Metro Instances
**Solution**: 
- Check Task Manager (Windows) or Activity Monitor (Mac) for node processes
- Kill all node processes
- Restart fresh

### Cause 3: Port Already in Use
**Solution**:
```bash
# Check what's using port 8081 (default Metro port)
# Windows:
netstat -ano | findstr :8081

# Mac/Linux:
lsof -i :8081

# Kill the process and restart Metro
```

### Cause 4: Network Configuration (Android Emulator)
**Solution**: Ensure emulator has proper network:
- Android emulator settings → Extended Controls → Settings → Proxy
- Set to "No proxy" or configure properly

---

## Verify Connection Status

When Metro starts successfully, you should see:
```
Metro waiting on exp://192.168.x.x:8081
```

And in the app/emulator, you should see:
- Expo Dev Tools opens automatically
- App loads without errors

---

## Still Not Working?

1. Check if using **Expo Go** or **Development Build**:
   - Development Build: Use `npm run start:dev`
   - Expo Go: Use `npm start`

2. Try opening in **Web browser** to test:
   ```bash
   npm run web
   ```

3. Check **Firewall/Antivirus** isn't blocking port 8081

4. Try **tunneling**:
   ```bash
   npx expo start --tunnel
   ```

