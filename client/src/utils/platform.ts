// src/utils/platform.ts
// Platform detection utility for USENA FLOW

export type PlatformKey = 'ios-app' | 'ios-web' | 'web-desktop' | 'web-mobile';

export const isCapacitorIOS = (): boolean => {
  try {
    // Lazy import only if available
    // @ts-ignore
    const { Capacitor } = require('@capacitor/core');
    return Capacitor?.getPlatform?.() === 'ios';
  } catch {
    return false;
  }
};

export const isIOSWeb = (): boolean => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /iPad|iPhone|iPod/.test(ua) && !isCapacitorIOS();
};

export const isMobileWidth = (): boolean =>
  typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false;

export const getPlatform = (): PlatformKey => {
  if (isCapacitorIOS()) return 'ios-app';
  if (isIOSWeb()) return isMobileWidth() ? 'ios-web' : 'web-desktop';
  // non‑iOS
  return isMobileWidth() ? 'web-mobile' : 'web-desktop';
};

// Additional helper functions for convenience
export const isIOSApp = (): boolean => isCapacitorIOS();
export const isMobileSafari = (): boolean => isIOSWeb();
export const isMobile = (): boolean => isMobileWidth();
export const isDesktop = (): boolean => {
  return typeof window !== 'undefined' 
    ? window.matchMedia('(min-width: 1024px)').matches && !isCapacitorIOS()
    : false;
};