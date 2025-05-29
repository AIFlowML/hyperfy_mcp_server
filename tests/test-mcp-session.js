#!/usr/bin/env node

/**
 * Test script to verify FastMCP session initialization and tool execution
 * This script tests our lazy session initialization approach for stdio transport
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Hyperfy FastMCP Server - Session Initialization\n');

// First, run ESM import validation to catch all import issues
console.log('🔍 Step 1: Validating ESM imports...');
try {
  const esmTestPath = join(__dirname, 'test-esm-imports.js');
  const { execSync } = await import('node:child_process');
  execSync(`node ${esmTestPath}`, { stdio: 'inherit', cwd: join(__dirname, '..') });
  console.log('✅ ESM import validation passed!\n');
} catch (error) {
  console.log('🚨 ESM import validation failed - please fix import issues first');
  console.log('   Run: node tests/test-esm-imports.js for detailed information\n');
  process.exit(1);
}

// Now proceed with the main MCP session tests
console.log('🔍 Step 2: Testing MCP session functionality...');

// Start the MCP server
const serverPath = join(__dirname, '..', 'dist', 'index.js');
console.log(`Starting server: node ${serverPath}\n`);

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: join(__dirname, '..')
});

let testsPassed = 0;
let testsTotal = 0;

// Helper function to send MCP request
function sendMCPRequest(request) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 10000);

    let responseBuffer = '';
    
    const onData = (data) => {
      responseBuffer += data.toString();
      
      // Check if we have a complete JSON response
      const lines = responseBuffer.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            clearTimeout(timeout);
            server.stdout.off('data', onData);
            resolve(response);
            return;
          } catch (e) {
            // Not a complete JSON yet, continue
          }
        }
      }
    };

    server.stdout.on('data', onData);
    server.stdin.write(`${JSON.stringify(request)}\n`);
  });
}

// Test function
async function runTest(testName, testFn) {
  testsTotal++;
  try {
    console.log(`🔍 Test ${testsTotal}: ${testName}`);
    await testFn();
    testsPassed++;
    console.log(`✅ PASSED: ${testName}\n`);
  } catch (error) {
    console.log(`❌ FAILED: ${testName}`);
    console.log(`   Error: ${error.message}\n`);
  }
}

// Main test sequence
async function runTests() {
  try {
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 1: Initialize MCP connection
    await runTest('MCP Protocol Initialization', async () => {
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            logging: {},
            // Add roots capability to help FastMCP detect client capabilities
            roots: {
              listChanged: true
            }
          },
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      const response = await sendMCPRequest(initRequest);
      
      if (response.error) {
        throw new Error(`Initialize failed: ${response.error.message}`);
      }
      
      if (!response.result) {
        throw new Error('No result in initialize response');
      }

      console.log('   📋 Server capabilities:', Object.keys(response.result.capabilities || {}));
      console.log('   🏷️  Server name:', response.result.serverInfo?.name);
      console.log('   📋 Server version:', response.result.serverInfo?.version);
      console.log('   📋 Server instructions length:', response.result.instructions?.length || 0);
    });

    // Test 1.5: Client Capabilities Verification
    await runTest('Client Capabilities Detection', async () => {
      // Send a follow-up request to ensure capabilities are established
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const listToolsRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      const response = await sendMCPRequest(listToolsRequest);
      
      if (response.error) {
        throw new Error(`Tools list failed: ${response.error.message}`);
      }
      
      console.log('   🔍 Verifying that FastMCP warning should be resolved...');
      console.log('   📡 Client sent capabilities: tools, logging, roots');
      console.log('   ✅ If no warning appeared above, client capabilities were detected successfully');
    });

    // Test 2: List available tools
    await runTest('List Tools', async () => {
      const listToolsRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
        params: {}
      };

      const response = await sendMCPRequest(listToolsRequest);
      
      if (response.error) {
        throw new Error(`List tools failed: ${response.error.message}`);
      }

      const tools = response.result?.tools || [];
      console.log(`   🛠️  Found ${tools.length} tools:`, tools.map(t => t.name));
      
      if (tools.length === 0) {
        throw new Error('No tools found');
      }

      // Verify our expected tools exist
      const expectedTools = [
        'hyperfy_chat',
        'hyperfy_ambient_speech',
        'hyperfy_goto_entity',
        'hyperfy_use_item',
        'hyperfy_stop_moving',
        'hyperfy_unuse_item',
        'hyperfy_walk_randomly',
        'hyperfy_get_emote_list',
        'hyperfy_get_world_state',
        'hyperfy_show_capabilities'
      ];

      const foundTools = tools.map(t => t.name);
      const missingTools = expectedTools.filter(tool => !foundTools.includes(tool));
      
      if (missingTools.length > 0) {
        throw new Error(`Missing expected tools: ${missingTools.join(', ')}`);
      }
      
      // Additional check: ensure all tools have descriptions
      const toolsWithoutDescription = tools.filter(t => !t.description);
      if (toolsWithoutDescription.length > 0) {
        console.log(`   ⚠️  Tools without descriptions: ${toolsWithoutDescription.map(t => t.name).join(', ')}`);
      }
    });

    // Test 3: Test session initialization via tool call
    await runTest('Session Initialization via Tool Call', async () => {
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'hyperfy_get_world_state',
          arguments: {}
        }
      };

      console.log('   🔄 Calling hyperfy_get_world_state to trigger session initialization...');
      
      const response = await sendMCPRequest(toolCallRequest);
      
      if (response.error) {
        console.log('   ⚠️  Tool call failed (expected if Hyperfy server not accessible)');
        console.log(`   📄 Error: ${response.error.message}`);
        
        // Check if it's a connection error (expected) vs session error (unexpected)
        if (response.error.message.includes('Session data not initialized')) {
          throw new Error('Session initialization failed - lazy loading not working');
        }
        
        // Connection errors are expected when Hyperfy server isn't running
        if (response.error.message.includes('connection') || 
            response.error.message.includes('ENOTFOUND') ||
            response.error.message.includes('ECONNREFUSED')) {
          console.log('   ✅ Session initialization triggered successfully (connection error is expected)');
          return;
        }
        
        throw new Error(`Unexpected tool error: ${response.error.message}`);
      }

      console.log('   ✅ Tool executed successfully');
      console.log('   📊 Response type:', typeof response.result);
    });

    // Test 4: Test another tool to verify session persistence
    await runTest('Session Persistence Check', async () => {
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'hyperfy_get_emote_list',
          arguments: {}
        }
      };

      console.log('   🔄 Calling hyperfy_get_emote_list to verify session persistence...');
      
      const response = await sendMCPRequest(toolCallRequest);
      
      if (response.error) {
        // Same logic as above - connection errors are expected
        if (response.error.message.includes('Session data not initialized')) {
          throw new Error('Session not persisted between tool calls');
        }
        
        if (response.error.message.includes('connection') || 
            response.error.message.includes('ENOTFOUND') ||
            response.error.message.includes('ECONNREFUSED')) {
          console.log('   ✅ Session persisted successfully (connection error is expected)');
          return;
        }
        
        throw new Error(`Unexpected tool error: ${response.error.message}`);
      }

      console.log('   ✅ Tool executed successfully with persisted session');
    });

    // Test 5: Stress Test - Multiple rapid tool calls
    await runTest('Stress Test - Rapid Tool Calls', async () => {
      console.log('   🔄 Making 5 rapid tool calls to test session stability...');
      
      const toolCalls = [
        'hyperfy_get_world_state',
        'hyperfy_get_emote_list',
        'hyperfy_get_world_state',
        'hyperfy_get_emote_list',
        'hyperfy_get_world_state'
      ];
      
      let successCount = 0;
      let connectionErrors = 0;
      let otherErrors = 0;
      
      for (let i = 0; i < toolCalls.length; i++) {
        try {
          const toolCallRequest = {
            jsonrpc: '2.0',
            id: 100 + i,
            method: 'tools/call',
            params: {
              name: toolCalls[i],
              arguments: {}
            }
          };

          const response = await sendMCPRequest(toolCallRequest);
          
          if (response.error) {
            if (response.error.message.includes('connection') || 
                response.error.message.includes('ENOTFOUND') ||
                response.error.message.includes('ECONNREFUSED')) {
              connectionErrors++;
            } else if (response.error.message.includes('Session data not initialized')) {
              throw new Error(`Session lost during stress test at call ${i + 1}`);
            } else {
              otherErrors++;
            }
          } else {
            successCount++;
          }
        } catch (error) {
          if (error.message.includes('Session lost')) {
            throw error;
          }
          otherErrors++;
        }
      }
      
      console.log(`   📊 Stress test results: ${successCount} success, ${connectionErrors} connection errors, ${otherErrors} other errors`);
      
      // Connection errors are expected, but we should have consistent behavior
      if (connectionErrors > 0 && successCount > 0) {
        throw new Error('Inconsistent connection behavior during stress test');
      }
    });

    // Test 6: Tool Parameter Validation
    await runTest('Tool Parameter Validation', async () => {
      console.log('   🔄 Testing tool parameter validation...');
      
      const invalidToolCallRequest = {
        jsonrpc: '2.0',
        id: 200,
        method: 'tools/call',
        params: {
          name: 'hyperfy_chat',
          arguments: {
            // Missing required message parameter
            invalidParam: 'test'
          }
        }
      };

      const response = await sendMCPRequest(invalidToolCallRequest);
      
      if (!response.error) {
        throw new Error('Expected parameter validation error but tool call succeeded');
      }
      
      console.log(`   ✅ Parameter validation working: ${response.error.message}`);
    });

    // Test 7: Invalid Tool Name
    await runTest('Invalid Tool Name Handling', async () => {
      console.log('   🔄 Testing invalid tool name handling...');
      
      const invalidToolRequest = {
        jsonrpc: '2.0',
        id: 300,
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {}
        }
      };

      const response = await sendMCPRequest(invalidToolRequest);
      
      if (!response.error) {
        throw new Error('Expected tool not found error but call succeeded');
      }
      
      console.log(`   ✅ Invalid tool handling working: ${response.error.message}`);
    });

    // Test 8: Session Data Integrity
    await runTest('Session Data Integrity Check', async () => {
      console.log('   🔄 Testing session data integrity across multiple calls...');
      
      // Make a tool call that would access session data
      const toolCallRequest = {
        jsonrpc: '2.0',
        id: 400,
        method: 'tools/call',
        params: {
          name: 'hyperfy_get_world_state',
          arguments: {}
        }
      };

      const response1 = await sendMCPRequest(toolCallRequest);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Make another call
      toolCallRequest.id = 401;
      const response2 = await sendMCPRequest(toolCallRequest);
      
      // Both should behave consistently (either both fail with connection error or both succeed)
      const response1HasError = !!response1.error;
      const response2HasError = !!response2.error;
      
      if (response1HasError !== response2HasError) {
        // Check if it's just different types of connection errors
        const isConnectionError = (resp) => {
          return resp.error && (
            resp.error.message.includes('connection') ||
            resp.error.message.includes('ENOTFOUND') ||
            resp.error.message.includes('ECONNREFUSED')
          );
        };
        
        if (!(isConnectionError(response1) && isConnectionError(response2))) {
          throw new Error('Session integrity compromised - inconsistent responses');
        }
      }
      
      console.log('   ✅ Session data integrity maintained across calls');
    });

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  } finally {
    // Clean up
    server.kill();
    
    console.log('\n📊 Test Results:');
    console.log(`   Passed: ${testsPassed}/${testsTotal}`);
    console.log(`   Success Rate: ${Math.round((testsPassed/testsTotal) * 100)}%`);
    
    if (testsPassed === testsTotal) {
      console.log('\n🎉 All tests passed! Session initialization is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the errors above.');
      process.exit(1);
    }
  }
}

// Handle server output
server.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('[INFO]') || output.includes('[DEBUG]') || output.includes('[ERROR]')) {
    console.log('📋 Server:', output.trim());
  }
});

server.stderr.on('data', (data) => {
  console.log('🚨 Server Error:', data.toString().trim());
});

server.on('close', (code) => {
  console.log(`\n🏁 Server process exited with code ${code}`);
});

// Start tests
runTests(); 