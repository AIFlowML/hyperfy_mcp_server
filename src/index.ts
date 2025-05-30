#!/usr/bin/env node
import 'ses';

import { server } from './servers/server.js';

// Export the server for testing purposes
export { server };

// Only start the server if not in test mode
if (process.env.MCP_TEST_MODE !== 'true') {
// Simple entry point for the Hyperfy FastMCP server
console.info('Starting Hyperfy FastMCP Server...');

// Start the server (the server handles all the initialization and tool registration)
server.start().catch((error) => {
  console.error('Failed to start Hyperfy FastMCP Server:', error);
  process.exit(1);
});
} else {
  console.info('Hyperfy FastMCP Server loaded in test mode - not starting automatically');
}
