import { spawn } from 'child_process';

function sendJsonRpcRequest(server, method, params = {}, id = 1) {
  return new Promise((resolve, reject) => {
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    let responseData = '';
    
    const responseHandler = (data) => {
      responseData += data.toString();
      try {
        const response = JSON.parse(responseData.trim());
        server.stdout.off('data', responseHandler);
        resolve(response);
      } catch (e) {
        // Continue collecting data
      }
    };

    server.stdout.on('data', responseHandler);
    server.stdin.write(JSON.stringify(request) + '\n');

    const timeout = setTimeout(() => {
      server.stdout.off('data', responseHandler);
      reject(new Error('Request timeout'));
    }, 10000);

    // Ensure the timer is cleared once a response arrives so the process can exit cleanly
    const originalResolve = resolve;
    resolve = (value) => {
      clearTimeout(timeout);
      originalResolve(value);
    };
  });
}

async function testServer() {
  console.log('Starting Spotify MCP Server test...\n');
  
  const server = spawn('node', ['server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  server.stderr.on('data', (data) => {
    console.error('Server error:', data.toString());
  });

  try {
    // Test 1: Initialize
    console.log('1. Testing initialize...');
    const initResponse = await sendJsonRpcRequest(server, 'initialize', {
      protocolVersion: "2024-11-05",
      capabilities: {}
    });
    console.log('Initialize response:', JSON.stringify(initResponse, null, 2));

    // Test 2: List tools
    console.log('\n2. Testing tools/list...');
    const toolsResponse = await sendJsonRpcRequest(server, 'tools/list');
    console.log('Tools response:', JSON.stringify(toolsResponse, null, 2));

    // Test 3: Search tracks
    console.log('\n3. Testing search_tracks...');
    const searchResponse = await sendJsonRpcRequest(server, 'tools/call', {
      name: 'search_tracks',
      arguments: {
        query: 'Taylor Swift Shake It Off',
        limit: 3
      }
    });
    console.log('Search response:', JSON.stringify(searchResponse, null, 2));

    // Test 4: Get artist info (using Taylor Swift's ID)
    console.log('\n4. Testing get_artist_info...');
    const artistResponse = await sendJsonRpcRequest(server, 'tools/call', {
      name: 'get_artist_info',
      arguments: {
        artist_id: '06HL4z0CvFAxyc27GXpf02'
      }
    });
    console.log('Artist response:', JSON.stringify(artistResponse, null, 2));

    // Test 5: Get track features (using Shake It Off's ID)
    console.log('\n5. Testing get_track_features...');
    const featuresResponse = await sendJsonRpcRequest(server, 'tools/call', {
      name: 'get_track_features',
      arguments: {
        track_id: '5ncOJRzQJOC5srZDNj5sHH'
      }
    });
    console.log('Features response:', JSON.stringify(featuresResponse, null, 2));

    console.log('\nAll tests completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    server.kill();
  }
}

testServer();