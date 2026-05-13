import type { VibeDesktopApi } from './lib/desktop';

declare global {
  interface Window {
    vibe?: VibeDesktopApi;
  }
}

export {};
