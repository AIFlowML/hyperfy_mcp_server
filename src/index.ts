#!/usr/bin/env node
import 'ses';

import { server } from './servers/server.js';

// Simple entry point for the Hyperfy FastMCP server
console.info('Starting Hyperfy FastMCP Server...');

// Start the server (the server handles all the initialization and tool registration)
server.start().catch((error) => {
  console.error('Failed to start Hyperfy FastMCP Server:', error);
  process.exit(1);
});
