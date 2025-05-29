#!/usr/bin/env node

/**
 * Basic Import Test
 * Tests that the compiled JavaScript can be imported without starting the full server
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing basic import functionality...');

async function testImport() {
  try {
    // Set environment to prevent server from actually starting
    process.env.NODE_ENV = 'test';
    process.env.MCP_TEST_MODE = 'true';
    
    // Import the main module
    const serverModule = await import('../dist/index.js');
    
    console.log('✅ Main module imported successfully');
    
    // Check if key exports exist
    if (typeof serverModule === 'object') {
      console.log('✅ Module exports are accessible');
    }
    
    console.log('✅ Basic import test completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Import test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Set a timeout to prevent hanging
setTimeout(() => {
  console.error('❌ Import test timed out after 10 seconds');
  process.exit(1);
}, 10000);

testImport(); 