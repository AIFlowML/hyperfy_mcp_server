// biome-ignore-next-file lint/suspicious/noExplicitAny: Global polyfill setup requires any
import { WebSocket } from 'ws';

// Force the polyfill to be available before any imports
// Set it on multiple global objects to ensure compatibility
const WS = WebSocket as any;

// Set on global
(global as any).WebSocket = WS;

// Set on globalThis  
(globalThis as any).WebSocket = WS;

// WebSocket constants are already defined in the ws library, no need to set them manually

// Add debugging to confirm the polyfill is loaded
console.log('[Setup] WebSocket polyfill loaded:', typeof global.WebSocket === 'function');
console.log('[Setup] WebSocket constants:', {
  CONNECTING: (global as any).WebSocket?.CONNECTING,
  OPEN: (global as any).WebSocket?.OPEN,
  CLOSING: (global as any).WebSocket?.CLOSING,
  CLOSED: (global as any).WebSocket?.CLOSED
}); 