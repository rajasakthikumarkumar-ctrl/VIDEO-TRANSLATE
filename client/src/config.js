// Configuration — values are injected at BUILD time via REACT_APP_ environment variables.
//
// For local development:   no changes needed, defaults to localhost:5001
// For Docker / EC2:        set REACT_APP_API_BASE and REACT_APP_SOCKET_URL
//                          as Jenkins build args or in a .env file before running
//                          `npm run build` inside the Docker build stage.
//
// Example (Jenkins / docker build-arg):
//   REACT_APP_API_BASE=http://<EC2-IP>:5001/api
//   REACT_APP_SOCKET_URL=http://<EC2-IP>:5001

const API_BASE =
  process.env.REACT_APP_API_BASE || 'http://localhost:5001/api';

const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

// Development-only diagnostics — stripped out by the production build
if (process.env.NODE_ENV !== 'production') {
  console.log('🌍 Environment:', process.env.NODE_ENV);
  console.log('📡 API Base:   ', API_BASE);
  console.log('🔌 Socket URL: ', SOCKET_URL);
}

export { API_BASE, SOCKET_URL };
export default { API_BASE, SOCKET_URL };
