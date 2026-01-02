# VideoMeet Pro - Deployment Guide

## Backend Deployment (Render)

Your backend is deployed at: `https://video-meet-aj54.onrender.com`

## Frontend Deployment (Render)

Your frontend is deployed at: `https://video-meet-client.onrender.com`

## Environment Configuration

The frontend automatically detects the environment based on the hostname:

### Development (localhost):
- API: `http://localhost:5001/api`
- Socket: `http://localhost:5001`

### Production (Render):
- API: `https://video-meet-aj54.onrender.com/api`
- Socket: `https://video-meet-aj54.onrender.com`

## Deployment Steps

### 1. Update Configuration
The `client/src/config.js` file automatically detects the environment:
```javascript
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname.includes('localhost');

const environment = isLocalhost ? 'development' : 'production';
```

### 2. Build Frontend
```bash
cd client
npm install
npm run build
```

### 3. Deploy to Render
1. Commit and push all changes to GitHub
2. Go to your Render dashboard
3. Select your frontend service
4. Click "Manual Deploy" → "Latest commit"
5. Wait for deployment to complete

### 4. Update Backend CORS
The backend is configured to allow requests from:
- `https://video-meet-client.onrender.com` (your frontend)
- `https://video-meet-aj54.onrender.com` (your backend)
- `http://localhost:3000` and `http://localhost:3001` (local development)

## Testing Deployment

1. **Open Frontend**: Go to `https://video-meet-client.onrender.com`
2. **Create Room**: Click "Create Room" and fill in details
3. **Join from Another Device**: Use different device/browser to join
4. **Test Features**: Video, audio, chat, screen sharing, recording

## Troubleshooting

### Network Error Issues:
- Check browser console for configuration logs
- Verify backend is running at `https://video-meet-aj54.onrender.com`
- Ensure CORS is properly configured

### Console Logs:
The app logs configuration details:
```
🌍 Environment detected: production
🔗 Current hostname: video-meet-client.onrender.com
📡 API Base: https://video-meet-aj54.onrender.com/api
🔌 Socket URL: https://video-meet-aj54.onrender.com
```

## Features Available

✅ **Cross-Device Video Calling**: Works across different devices and networks
✅ **Admin Controls**: Host can remove participants and end meetings
✅ **Local Recording**: Record video/audio locally on each device
✅ **Real-time Chat**: Messaging during video calls
✅ **Screen Sharing**: Share screen with all participants
✅ **Reactions & Hand Raising**: Interactive meeting features
✅ **Responsive Design**: Works on desktop and mobile
✅ **Secure Rooms**: Passcode-protected meetings

## Security Features

- HTTPS connections for all communications
- Passcode-protected rooms
- CORS protection configured for your domains
- Local-only recording (no server storage)
- Admin-only controls for meeting management