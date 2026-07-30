// Quick test script to verify server is working
// Run with: node test-server.js

const API_BASE = 'http://localhost:5001/api';

async function testServer() {
  console.log('🧪 Testing server...\n');

  try {
    // Test 1: List rooms
    console.log('1️⃣ Testing GET /api/rooms');
    const listResponse = await fetch(`${API_BASE}/rooms`);
    const rooms = await listResponse.json();
    console.log('✅ Server is running!');
    console.log(`📊 Current rooms: ${rooms.length}`);
    if (rooms.length > 0) {
      rooms.forEach(room => {
        console.log(`   - ${room.id} (${room.creatorName})`);
      });
    }
    console.log('');

    // Test 2: Create a test room
    console.log('2️⃣ Testing POST /api/rooms');
    const testRoom = {
      creatorName: 'Test User',
      creatorEmail: 'test@example.com',
      roomId: 'TEST' + Date.now(),
      passcode: 'test123',
      meetingDate: '2026-03-13',
      meetingTime: '10:00'
    };
    
    const createResponse = await fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testRoom)
    });
    
    const createResult = await createResponse.json();
    if (createResponse.ok) {
      console.log(`✅ Room created: ${testRoom.roomId}`);
    } else {
      console.log(`❌ Failed to create room: ${createResult.error}`);
    }
    console.log('');

    // Test 3: Verify the room
    console.log('3️⃣ Testing POST /api/rooms/:roomId/verify');
    const verifyResponse = await fetch(`${API_BASE}/rooms/${testRoom.roomId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: testRoom.passcode })
    });
    
    const verifyResult = await verifyResponse.json();
    if (verifyResponse.ok) {
      console.log(`✅ Room verified successfully`);
    } else {
      console.log(`❌ Failed to verify room: ${verifyResult.error}`);
    }
    console.log('');

    // Test 4: List rooms again
    console.log('4️⃣ Testing GET /api/rooms (after creation)');
    const listResponse2 = await fetch(`${API_BASE}/rooms`);
    const rooms2 = await listResponse2.json();
    console.log(`📊 Current rooms: ${rooms2.length}`);
    rooms2.forEach(room => {
      console.log(`   - ${room.id} (${room.creatorName})`);
    });
    console.log('');

    console.log('✅ All tests passed! Server is working correctly.');
    console.log('');
    console.log('💡 You can now:');
    console.log('   1. Open http://localhost:3000');
    console.log('   2. Create a room');
    console.log('   3. Join the room from another tab');
    console.log('');

  } catch (error) {
    console.error('❌ Server test failed!');
    console.error('Error:', error.message);
    console.log('');
    console.log('💡 Make sure the server is running:');
    console.log('   cd video-meet/server');
    console.log('   node index.js');
    console.log('');
  }
}

testServer();
