/**
 * Device ID management for isolating chats per device
 * Similar to how iMessage works - each device has its own chat history
 */

const DEVICE_ID_KEY = 'chat-device-id';

/**
 * Get or create a unique device ID for this browser/device
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return ''; // Server-side, return empty
  }

  // Check if we already have a device ID
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate a new unique device ID
    deviceId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

/**
 * Generate a unique device ID
 * Format: device_<timestamp>_<random>
 */
function generateDeviceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `device_${timestamp}_${random}`;
}

/**
 * Get device name for display (e.g., "Laptop", "Phone")
 */
export function getDeviceName(): string {
  if (typeof window === 'undefined') {
    return 'Unknown Device';
  }

  const userAgent = navigator.userAgent.toLowerCase();

  if (/mobile|android|iphone|ipad|ipod/.test(userAgent)) {
    if (/ipad/.test(userAgent)) return 'iPad';
    if (/iphone/.test(userAgent)) return 'iPhone';
    if (/android/.test(userAgent)) return 'Android Phone';
    return 'Mobile Device';
  }

  if (/mac/.test(userAgent)) return 'Mac';
  if (/win/.test(userAgent)) return 'Windows PC';
  if (/linux/.test(userAgent)) return 'Linux PC';

  return 'Desktop';
}

/**
 * Reset device ID (for testing or switching devices)
 */
export function resetDeviceId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DEVICE_ID_KEY);
  }
}

/**
 * Get device info for display
 */
export function getDeviceInfo(): { id: string; name: string } {
  return {
    id: getDeviceId(),
    name: getDeviceName(),
  };
}
