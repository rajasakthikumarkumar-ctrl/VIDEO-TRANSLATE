// Configuration for different environments
const config = {
  development: {
    API_BASE: 'http://localhost:5001/api',
    SOCKET_URL: 'http://localhost:5001'
  },
  production: {
    API_BASE: 'https://video-meet-aj54.onrender.com/api',
    SOCKET_URL: 'https://video-meet-aj54.onrender.com'
  }
};

// Determine current environment
// Check if we're running on localhost (development) or deployed (production)
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname.includes('localhost');

const environment = isLocalhost ? 'development' : 'production';

console.log('🌍 Environment detected:', environment);
console.log('🔗 Current hostname:', window.location.hostname);
console.log('📡 API Base:', config[environment].API_BASE);
console.log('🔌 Socket URL:', config[environment].SOCKET_URL);

// Export current configuration
export const API_BASE = config[environment].API_BASE;
export const SOCKET_URL = config[environment].SOCKET_URL;

export default config[environment];