// Test script to verify configuration
import { API_BASE, SOCKET_URL } from './config';

console.log('=== VideoMeet Pro Configuration Test ===');
console.log('🌍 Current hostname:', window.location.hostname);
console.log('🌐 Current origin:', window.location.origin);
console.log('📡 API Base URL:', API_BASE);
console.log('🔌 Socket URL:', SOCKET_URL);

// Test API connectivity
async function testAPI() {
  try {
    console.log('🧪 Testing API connectivity...');
    const response = await fetch(`${API_BASE}/rooms`);
    if (response.ok) {
      console.log('✅ API connection successful');
      const data = await response.json();
      console.log('📊 Rooms data:', data);
    } else {
      console.log('❌ API connection failed:', response.status);
    }
  } catch (error) {
    console.log('❌ API connection error:', error.message);
  }
}

// Run test when imported
if (typeof window !== 'undefined') {
  testAPI();
}

export { testAPI };