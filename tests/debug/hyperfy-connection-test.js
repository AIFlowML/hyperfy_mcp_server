/**
 * Advanced WebSocket connection test that mimics Hyperfy ClientNetwork behavior
 * This tests the connection with the same parameters and format that Hyperfy uses
 */

import { WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';

const TEST_CONFIG = {
  WS_BASE_URL: 'ws://localhost:3000/ws',
  TIMEOUT: 15000, // 15 seconds
  AUTH_TOKEN: `test-token-${Date.now()}`,
  AGENT_NAME: 'TestAgent',
  WORLD_ID: uuid(),
};

function buildHyperfyURL(baseUrl, authToken, name, worldId) {
  let url = `${baseUrl}?authToken=${authToken}`;
  if (name) url += `&name=${encodeURIComponent(name)}`;
  if (worldId) url += `&worldId=${encodeURIComponent(worldId)}`;
  return url;
}

async function testHyperfyConnection() {
  const url = buildHyperfyURL(
    TEST_CONFIG.WS_BASE_URL,
    TEST_CONFIG.AUTH_TOKEN,
    TEST_CONFIG.AGENT_NAME,
    TEST_CONFIG.WORLD_ID
  );
  
  console.log('🔧 Hyperfy WebSocket Connection Test');
  console.log(`🔌 Connecting to: ${url}`);
  console.log(`🌍 World ID: ${TEST_CONFIG.WORLD_ID}`);
  console.log(`👤 Agent Name: ${TEST_CONFIG.AGENT_NAME}`);
  console.log('');
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log('❌ Connection timeout');
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      reject(new Error('Connection timeout'));
    }, TEST_CONFIG.TIMEOUT);

    const ws = new WebSocket(url);
    
    // Set binary type like Hyperfy does
    ws.binaryType = 'arraybuffer';
    
    ws.on('open', () => {
      clearTimeout(timeout);
      console.log('✅ WebSocket connection opened successfully!');
      console.log(`📊 Ready state: ${ws.readyState}`);
      console.log(`🔧 Binary type: ${ws.binaryType || 'not set'}`);
      
      // Wait for initial messages from server
      console.log('⏳ Waiting for server messages...');
      
      // Keep connection open for a few seconds to receive messages
      setTimeout(() => {
        console.log('🔒 Closing connection...');
        ws.close();
      }, 3000);
    });
    
    ws.on('message', (data) => {
      if (data instanceof ArrayBuffer) {
        console.log('📥 Received binary message:', new Uint8Array(data));
        console.log(`📏 Binary data length: ${data.byteLength} bytes`);
      } else {
        console.log('📥 Received text message:', data.toString());
      }
    });
    
    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      console.log(`🔒 WebSocket closed. Code: ${code}, Reason: ${reason || 'No reason'}`);
      
      // Interpret close codes
      let codeDescription = 'Unknown';
      switch (code) {
        case 1000: codeDescription = 'Normal Closure'; break;
        case 1001: codeDescription = 'Going Away'; break;
        case 1002: codeDescription = 'Protocol Error'; break;
        case 1003: codeDescription = 'Unsupported Data'; break;
        case 1006: codeDescription = 'Abnormal Closure'; break;
        case 1011: codeDescription = 'Server Error'; break;
      }
      console.log(`📋 Close code meaning: ${codeDescription}`);
      
      resolve({ success: true, code, reason, codeDescription });
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log('❌ WebSocket error:', error.message);
      console.log('🔍 Error details:', error);
      reject(error);
    });
  });
}

async function main() {
  try {
    console.log('🚀 Starting Hyperfy WebSocket Connection Test...');
    console.log('📋 Make sure Hyperfy server is running on localhost:3000');
    console.log('');
    
    const result = await testHyperfyConnection();
    console.log('');
    console.log('✅ Test completed successfully!');
    console.log('📊 Result:', result);
    process.exit(0);
  } catch (error) {
    console.log('');
    console.log('❌ Test failed:', error.message);
    console.log('💡 Possible issues:');
    console.log('   - Hyperfy server not running on localhost:3000');
    console.log('   - Server rejecting connections');
    console.log('   - Network connectivity issues');
    console.log('   - Firewall blocking the connection');
    process.exit(1);
  }
}

// Run the test
main(); 