#!/usr/bin/env node

/**
 * Comprehensive MCP Tools Test
 * Connects to the Hyperfy FastMCP server and tests all available tools
 * Collects logs and identifies errors for each tool execution
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Comprehensive MCP Tools Test');
console.log('================================');
console.log('Testing all available MCP tools and collecting execution logs...\n');

// Start the MCP server
const serverPath = join(__dirname, '..', 'dist', 'index.js');
console.log(`Starting server: node ${serverPath}\n`);

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: join(__dirname, '..')
});

const serverLogs = [];
const serverErrors = [];
const testResults = [];

// Helper function to send MCP request
function sendMCPRequest(request) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout (15s)'));
    }, 15000);

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

// Test function with detailed logging
async function testTool(toolName, testParams, description) {
  const testStartTime = Date.now();
  console.log(`🔍 Testing: ${toolName}`);
  console.log(`   Description: ${description}`);
  console.log(`   Parameters: ${JSON.stringify(testParams, null, 2)}`);
  
  const preTestLogs = [...serverLogs];
  const preTestErrors = [...serverErrors];
  
  try {
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: testParams
      }
    };

    const response = await sendMCPRequest(toolCallRequest);
    const testEndTime = Date.now();
    const duration = testEndTime - testStartTime;
    
    // Collect new logs since test started
    const newLogs = serverLogs.slice(preTestLogs.length);
    const newErrors = serverErrors.slice(preTestErrors.length);
    
    const result = {
      tool: toolName,
      description,
      parameters: testParams,
      duration: `${duration}ms`,
      success: !response.error,
      response: response.error ? response.error : response.result,
      logs: newLogs,
      errors: newErrors,
      timestamp: new Date().toISOString()
    };
    
    if (response.error) {
      console.log(`   ❌ FAILED: ${response.error.message}`);
      console.log(`   📋 Error Code: ${response.error.code || 'N/A'}`);
      result.errorDetails = {
        code: response.error.code,
        message: response.error.message,
        data: response.error.data
      };
    } else {
      console.log('   ✅ SUCCESS');
      console.log(`   📊 Response: ${typeof response.result === 'object' ? 'Object' : response.result}`);
      
      // Try to extract meaningful info from successful responses
      if (response.result?.content) {
        const content = response.result.content[0];
        if (content?.text) {
          const text = content.text.substring(0, 100);
          console.log(`   📄 Content Preview: ${text}${text.length >= 100 ? '...' : ''}`);
        }
      }
    }
    
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log(`   📋 Logs Generated: ${newLogs.length}`);
    console.log(`   🚨 Errors Generated: ${newErrors.length}`);
    
    testResults.push(result);
    console.log('');
    
  } catch (error) {
    const testEndTime = Date.now();
    const duration = testEndTime - testStartTime;
    
    console.log(`   💥 EXCEPTION: ${error.message}`);
    console.log(`   ⏱️  Duration: ${duration}ms`);
    
    testResults.push({
      tool: toolName,
      description,
      parameters: testParams,
      duration: `${duration}ms`,
      success: false,
      exception: error.message,
      logs: serverLogs.slice(preTestLogs.length),
      errors: serverErrors.slice(preTestErrors.length),
      timestamp: new Date().toISOString()
    });
    console.log('');
  }
}

// Tool test configurations
const toolTests = [
  {
    name: 'hyperfy_get_world_state',
    params: {},
    description: 'Get current world state and entities'
  },
  {
    name: 'hyperfy_get_world_state',
    params: { includeChat: true, includeEmotes: true, actionRadius: 25 },
    description: 'Get world state with chat and emotes'
  },
  {
    name: 'hyperfy_get_emote_list',
    params: {},
    description: 'Get list of available emotes'
  },
  {
    name: 'hyperfy_get_emote_list',
    params: { category: 'dance', searchTerm: 'happy' },
    description: 'Search for specific emotes'
  },
  {
    name: 'hyperfy_chat',
    params: { message: 'Hello from MCP test! 🧪' },
    description: 'Send a test message to world chat'
  },
  {
    name: 'hyperfy_chat',
    params: { message: 'Testing whisper', channel: 'whisper', targetUserId: 'test-user' },
    description: 'Test whisper functionality'
  },
  {
    name: 'hyperfy_ambient_speech',
    params: { content: 'Testing ambient speech functionality', duration: 3 },
    description: 'Test ambient speech with short duration'
  },
  {
    name: 'hyperfy_goto_entity',
    params: { target: 'spawn-point' },
    description: 'Navigate to spawn point'
  },
  {
    name: 'hyperfy_goto_entity',
    params: { target: '0,0,0', speed: 1.5 },
    description: 'Navigate to coordinates with custom speed'
  },
  {
    name: 'hyperfy_use_item',
    params: { target: 'nearby-item' },
    description: 'Attempt to use a nearby item'
  },
  {
    name: 'hyperfy_unuse_item',
    params: {},
    description: 'Release any currently held items'
  },
  {
    name: 'hyperfy_walk_randomly',
    params: { action: 'start', radius: 10, speed: 1.0 },
    description: 'Start random walking with limited radius'
  },
  {
    name: 'hyperfy_walk_randomly',
    params: { action: 'stop' },
    description: 'Stop random walking'
  },
  {
    name: 'hyperfy_stop_moving',
    params: {},
    description: 'Stop all movement immediately'
  },
  {
    name: 'hyperfy_show_capabilities',
    params: {},
    description: 'Show server capabilities and debug info'
  }
];

// Main test sequence
async function runToolTests() {
  try {
    // Wait for server to start
    console.log('⏳ Waiting for server to initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Initialize MCP connection
    console.log('🔄 Initializing MCP connection...');
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          logging: {},
          roots: { listChanged: true }
        },
        clientInfo: {
          name: 'mcp-tools-tester',
          version: '1.0.0'
        }
      }
    };

    const initResponse = await sendMCPRequest(initRequest);
    if (initResponse.error) {
      throw new Error(`MCP initialization failed: ${initResponse.error.message}`);
    }

    console.log('✅ MCP connection established');
    console.log(`📋 Server: ${initResponse.result.serverInfo?.name} v${initResponse.result.serverInfo?.version}`);
    console.log('');

    // List available tools
    console.log('📋 Listing available tools...');
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };

    const toolsResponse = await sendMCPRequest(listToolsRequest);
    if (toolsResponse.error) {
      throw new Error(`Failed to list tools: ${toolsResponse.error.message}`);
    }

    const availableTools = toolsResponse.result?.tools || [];
    console.log(`🛠️  Found ${availableTools.length} tools:`);
    for (const tool of availableTools) {
      console.log(`   • ${tool.name}: ${tool.description}`);
    }
    console.log('');

    // Filter test configurations to only include available tools
    const validTests = toolTests.filter(test => 
      availableTools.some(tool => tool.name === test.name)
    );

    console.log(`🚀 Starting comprehensive tool testing (${validTests.length} tests)...\n`);

    // Run all tool tests
    for (const test of validTests) {
      await testTool(test.name, test.params, test.description);
      // Small delay between tests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Generate final report
    console.log('📊 FINAL TEST REPORT');
    console.log('===================');
    
    const successfulTests = testResults.filter(t => t.success);
    const failedTests = testResults.filter(t => !t.success);
    
    console.log(`✅ Successful: ${successfulTests.length}/${testResults.length}`);
    console.log(`❌ Failed: ${failedTests.length}/${testResults.length}`);
    console.log(`📈 Success Rate: ${Math.round((successfulTests.length / testResults.length) * 100)}%`);
    console.log('');

    if (failedTests.length > 0) {
      console.log('❌ FAILED TESTS:');
      for (const test of failedTests) {
        console.log(`   • ${test.tool}: ${test.errorDetails?.message || test.exception || 'Unknown error'}`);
      }
      console.log('');
    }

    console.log('📋 DETAILED LOGS BY TOOL:');
    for (const test of testResults) {
      console.log(`\n🔧 ${test.tool}:`);
      console.log(`   Status: ${test.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`   Duration: ${test.duration}`);
      console.log(`   Logs: ${test.logs.length} entries`);
      console.log(`   Errors: ${test.errors.length} entries`);
      
      if (!test.success && test.errorDetails) {
        console.log(`   Error: ${test.errorDetails.message}`);
      }
      
      if (test.logs.length > 0) {
        console.log('   Recent Logs:');
        for (const log of test.logs.slice(-3)) {
          console.log(`     📋 ${log}`);
        }
      }
    }

    // Summary statistics
    console.log('\n📈 PERFORMANCE SUMMARY:');
    const durations = testResults.map(t => Number.parseInt(t.duration.replace('ms', '')));
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    console.log(`   Average Response Time: ${Math.round(avgDuration)}ms`);
    console.log(`   Fastest Response: ${minDuration}ms`);
    console.log(`   Slowest Response: ${maxDuration}ms`);
    console.log(`   Total Server Logs: ${serverLogs.length}`);
    console.log(`   Total Server Errors: ${serverErrors.length}`);

    console.log('\n🎯 TOOL COVERAGE:');
    const testedTools = new Set(testResults.map(t => t.tool));
    for (const tool of availableTools) {
      const tested = testedTools.has(tool.name);
      console.log(`   ${tested ? '✅' : '⚠️ '} ${tool.name}`);
    }

  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
    console.error('📋 Server logs:', serverLogs.slice(-5));
    console.error('🚨 Server errors:', serverErrors.slice(-5));
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up...');
    server.kill();
    
    const finalSuccessRate = Math.round((testResults.filter(t => t.success).length / testResults.length) * 100);
    
    if (finalSuccessRate >= 80) {
      console.log('🎉 Tool testing completed successfully!');
      process.exit(0);
    } else {
      console.log('⚠️  Tool testing completed with issues. Review the failed tests above.');
      process.exit(1);
    }
  }
}

// Handle server output
server.stdout.on('data', (data) => {
  const output = data.toString();
  serverLogs.push(output.trim());
  
  // Echo important server messages
  if (output.includes('[INFO]') || output.includes('[DEBUG]') || output.includes('Connected')) {
    console.log(`📋 Server: ${output.trim()}`);
  }
});

server.stderr.on('data', (data) => {
  const errorOutput = data.toString();
  serverErrors.push(errorOutput.trim());
  console.log(`🚨 Server Error: ${errorOutput.trim()}`);
});

server.on('close', (code) => {
  console.log(`\n🏁 Server process exited with code ${code}`);
});

// Start tests
runToolTests();
