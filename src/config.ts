// Where the local Claude backend lives.
//
// During development your phone talks to your Mac over Wi-Fi. Expo already
// knows your Mac's LAN IP (that's how Metro reaches the phone), so we reuse it
// and just swap in the backend port. If that fails, edit MANUAL_BACKEND_URL.

import Constants from 'expo-constants';

const BACKEND_PORT = 8787;

// Once the server is deployed to the cloud (Render), put its URL here —
// then the app works anywhere, for anyone, without your Mac running.
// e.g. 'https://someday-maps.onrender.com'
const PROD_BACKEND_URL = '';

// If auto-detection ever fails, hard-code it here, e.g.
// 'http://192.168.0.95:8787'
const MANUAL_BACKEND_URL = '';

function detectBackendUrl(): string {
  if (PROD_BACKEND_URL) return PROD_BACKEND_URL;
  if (MANUAL_BACKEND_URL) return MANUAL_BACKEND_URL;

  // hostUri looks like "192.168.0.95:8081"
  const anyConstants = Constants as any;
  const host =
    Constants.expoConfig?.hostUri ||
    anyConstants.expoGoConfig?.debuggerHost ||
    anyConstants.manifest2?.extra?.expoClient?.hostUri ||
    '';

  const ip = String(host).split(':')[0];
  if (ip && ip !== 'localhost') {
    return `http://${ip}:${BACKEND_PORT}`;
  }
  return `http://localhost:${BACKEND_PORT}`;
}

export const BACKEND_URL = detectBackendUrl();
