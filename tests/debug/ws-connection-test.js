/**
 * Simple WebSocket connection test for local Hyperfy server
 * This tests the raw WebSocket connection without any frameworks
 */

import { WebSocket } from 'ws';

const TEST_CONFIG = {
  WS_URL: 'ws://localhost:3000/ws',
  TIMEOUT: 10000, // 10 seconds
};

async function testWebSocketConnection() {
  console.log('🔧 WebSocket Debug Test');
  console.log(`🔌 Connecting to: ${TEST_CONFIG.WS_URL}`);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.log('❌ Connection timeout');
      ws.close();
      reject(new Error('Connection timeout'));
    }, TEST_CONFIG.TIMEOUT);

    const ws = new WebSocket(TEST_CONFIG.WS_URL);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      console.log('✅ WebSocket connection opened successfully!');
      console.log(`📊 Ready state: ${ws.readyState}`);
      
      // Send a test message
      const testMessage = JSON.stringify({ type: 'ping', timestamp: Date.now() });
      console.log(`📤 Sending test message: ${testMessage}`);
      ws.send(testMessage);
      
      // Close after a short delay
      setTimeout(() => {
        console.log('🔒 Closing connection...');
        ws.close();
      }, 1000);
    });
    
    ws.on('message', (data) => {
      console.log('📥 Received message:', data.toString());
    });
    
    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      console.log(`🔒 WebSocket closed. Code: ${code}, Reason: ${reason || 'No reason'}`);
      resolve({ success: true, code, reason });
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.log('❌ WebSocket error:', error.message);
      reject(error);
    });
  });
}

async function main() {
  try {
    console.log('🚀 Starting WebSocket Debug Test...');
    console.log('📋 Make sure Hyperfy server is running on localhost:3000');
    console.log('');
    
    const result = await testWebSocketConnection();
    console.log('');
    console.log('✅ Test completed successfully!', result);
    process.exit(0);
  } catch (error) {
    console.log('');
    console.log('❌ Test failed:', error.message);
    console.log('💡 Make sure the Hyperfy server is running on localhost:3000');
    process.exit(1);
  }
}

// Run the test
main(); 