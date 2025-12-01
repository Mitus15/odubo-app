# Native Mobile App Transition Plan

**Strategy:** Live URL Wrapper via Capacitor  
**Date:** November 29, 2025

This document outlines the roadmap for converting the Odubo web application into a native mobile app (iOS & Android) using Capacitor.

## Why Live URL Wrapper?
The application currently relies heavily on Next.js server-side API routes (`src/app/api/...`) and middleware. A static export (`output: 'export'`) would break these features. Therefore, the mobile app will act as a native wrapper pointing to the production URL.

## Roadmap

### 1. Installation
Install the necessary Capacitor dependencies:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
```

### 2. Initialization
Initialize the Capacitor project:
```bash
npx cap init Odubo com.odubo.app --web-dir=public
```
*Note: `web-dir` is set to `public` as a placeholder since we are using a live server URL.*

### 3. Configuration
Update `capacitor.config.ts` to point to the production environment:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.odubo.app',
  appName: 'Odubo',
  webDir: 'public',
  server: {
    url: 'https://odubo.studio', // Production URL
    cleartext: true,
    androidScheme: 'https'
  }
};

export default config;
```

### 4. Add Platforms
Generate the native project folders:
```bash
npx cap add ios
npx cap add android
```

### 5. Asset Generation
To replace default Capacitor icons and splash screens:
1. Install the asset tool: `npm install @capacitor/assets --save-dev`
2. Place your icon (`logo.png` or similar) in an `assets` folder.
3. Run: `npx capacitor-assets generate`

### 6. Build & Deploy
To run the app on a simulator or device:
```bash
npx cap open ios
# or
npx cap open android
```

## Future Considerations

### App Store Approval
Apple may reject apps that are purely "wrappers" for a website. To mitigate this:
- **Native Features:** Implement native functionality like Push Notifications, Haptics, or Biometric Auth using Capacitor plugins.
- **UX:** Ensure the "Safe Areas" (notch/home bar) are handled correctly in CSS (already implemented in `src/components/layout/MobileLayout.tsx`).

### Offline Support
Since the app relies on a live URL, it will not function offline.
- **Recommendation:** Implement a Service Worker (PWA) to cache assets and provide a basic offline fallback page.

### Deep Linking
Configure Universal Links (iOS) and App Links (Android) so that clicking an `odubo.studio` link opens the native app instead of the browser.
