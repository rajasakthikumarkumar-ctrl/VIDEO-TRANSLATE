// Configuration — supports three injection methods:
//
// 1. Runtime (ECS/Docker): window.API_CONFIG set by docker-entrypoint.sh
//    - Used when SERVER_URL environment variable is set at container startup
//    - Allows single image to work with any backend URL
//
// 2. Build-time (Render): process.env.REACT_APP_* from .env.production
//    - Values are baked into the bundle during `npm run build`
//    - Used by Render deployment
//
// 3. Development: Falls back to localhost:5001
//    - Used by `npm start` with .env.development
//
// Priority: window.API_CONFIG > process.env.REACT_APP_* > localhost

const API_BASE =
  (typeof window !== 'undefined' && window.API_CONFIG?.apiBase) ||
  process.env.REACT_APP_API_BASE ||
  'http://localhost:5001/api';

const SOCKET_URL =
  (typeof window !== 'undefined' && window.API_CONFIG?.socketUrl) ||
  process.env.REACT_APP_SOCKET_URL ||
  'http://localhost:5001';

// Log configuration for debugging (production logs are useful for verifying deployment)
console.log('🌍 Environment:', process.env.NODE_ENV);
console.log('📡 API Base:   ', API_BASE);
console.log('🔌 Socket URL: ', SOCKET_URL);
if (typeof window !== 'undefined' && window.API_CONFIG) {
  console.log('✅ Using runtime configuration (ECS/Docker)');
} else if (process.env.REACT_APP_API_BASE) {
  console.log('✅ Using build-time configuration (Render)');
} else {
  console.log('✅ Using localhost (development)');
}

export { API_BASE, SOCKET_URL };
export default { API_BASE, SOCKET_URL };
