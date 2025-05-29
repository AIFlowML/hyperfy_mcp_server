// biome-ignore lint/suspicious/noExplicitAny: Global polyfill setup requires any
import { WebSocket } from 'ws';

// Force the polyfill to be available before any imports
// Set it on multiple global objects to ensure compatibility
const WS = WebSocket as unknown;

// Set on global
(global as Record<string, unknown>).WebSocket = WS;

// Set on globalThis  
(globalThis as Record<string, unknown>).WebSocket = WS;

// WebSocket constants are already defined in the ws library, no need to set them manually

// Add debugging to confirm the polyfill is loaded
console.log('[Setup] WebSocket polyfill loaded:', typeof global.WebSocket === 'function');
console.log('[Setup] WebSocket constants:', {
  CONNECTING: WebSocket.CONNECTING,
  OPEN: WebSocket.OPEN,
  CLOSING: WebSocket.CLOSING,
  CLOSED: WebSocket.CLOSED
});

// Add global error handlers to catch WebSocket cleanup errors during tests
const originalUncaughtException = process.listeners('uncaughtException');
const originalUnhandledRejection = process.listeners('unhandledRejection');

// Handle uncaught exceptions from WebSocket cleanup
process.on('uncaughtException', (error) => {
  // Check if this is a WebSocket cleanup error we can safely ignore
  if (error.message?.includes('WebSocket was closed before the connection was established')) {
    console.debug('[Test Setup] Suppressed WebSocket cleanup error:', error.message);
    return; // Suppress this specific error
  }
  
  // For other errors, call the original handlers
  for (const handler of originalUncaughtException) {
    if (typeof handler === 'function') {
      (handler as (error: Error) => void)(error);
    }
  }
});

// Handle unhandled promise rejections from WebSocket cleanup
process.on('unhandledRejection', (reason, promise) => {
  // Check if this is a WebSocket cleanup error we can safely ignore
  if (reason && typeof reason === 'object' && 'message' in reason && 
      typeof reason.message === 'string' && 
      reason.message.includes('WebSocket was closed before the connection was established')) {
    console.debug('[Test Setup] Suppressed WebSocket cleanup rejection:', reason.message);
    return; // Suppress this specific error
  }
  
  // For other rejections, call the original handlers
  for (const handler of originalUnhandledRejection) {
    if (typeof handler === 'function') {
      (handler as (reason: unknown, promise: Promise<unknown>) => void)(reason, promise);
    }
  }
}); 