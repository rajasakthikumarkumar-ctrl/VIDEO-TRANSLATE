const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

// CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://video-meet-aj54.onrender.com', 
        'https://video-meet-client.onrender.com',
        'http://localhost:3000', 
        'http://localhost:3001'
      ]
    : "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [
          'https://video-meet-aj54.onrender.com', 
          'https://video-meet-client.onrender.com',
          'http://localhost:3000', 
          'http://localhost:3001'
        ]
      : "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store rooms and their participants
const rooms = new Map();
const userSockets = new Map();

// Room management endpoints
app.post('/api/rooms', (req, res) => {
  const { creatorName, creatorEmail, roomId, passcode, meetingDate, meetingTime } = req.body;
  
  if (rooms.has(roomId)) {
    return res.status(400).json({ error: 'Room ID already exists' });
  }
  
  const room = {
    id: roomId,
    passcode,
    creatorName,
    creatorEmail,
    meetingDate,
    meetingTime,
    adminId: null, // Will be set when admin joins
    participants: [],
    chatMessages: [],
    reactions: [],
    raisedHands: [],
    createdAt: new Date().toISOString()
  };
  
  rooms.set(roomId, room);
  console.log(`✅ Room created: ${roomId} by ${creatorName}`);
  res.json({ success: true, room });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    creatorName: room.creatorName,
    meetingDate: room.meetingDate,
    meetingTime: room.meetingTime,
    participantCount: room.participants.length
  }));
  res.json(roomList);
});

app.post('/api/rooms/:roomId/verify', (req, res) => {
  const { roomId } = req.params;
  const { passcode } = req.body;
  
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  if (room.passcode !== passcode) {
    return res.status(401).json({ error: 'Invalid passcode' });
  }
  
  res.json({ success: true });
});

io.on("connection", socket => {
  console.log(`🔗 User connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, passcode, participantName, participantEmail, isHost }) => {
    console.log(`👤 ${participantName} (${socket.id}) attempting to join room ${roomId} as ${isHost ? 'ADMIN' : 'PARTICIPANT'}`);
    
    const room = rooms.get(roomId);
    
    if (!room) {
      console.log(`❌ Room ${roomId} not found`);
      socket.emit('error', 'Room not found');
      return;
    }
    
    if (room.passcode !== passcode) {
      console.log(`❌ Invalid passcode for room ${roomId}`);
      socket.emit('error', 'Invalid passcode');
      return;
    }
    
    // Check if user is already in room (prevent duplicates by socket ID)
    const existingParticipant = room.participants.find(p => p.id === socket.id);
    if (existingParticipant) {
      console.log(`⚠️ User ${socket.id} already in room ${roomId}, sending existing room state`);
      
      // Send existing room state
      const existingParticipants = room.participants.filter(p => p.id !== socket.id);
      socket.emit('room-joined', {
        room: {
          id: room.id,
          creatorName: room.creatorName,
          adminId: room.adminId,
          participants: existingParticipants,
          chatMessages: room.chatMessages || [],
          raisedHands: room.raisedHands || []
        },
        isAdmin: existingParticipant.isAdmin
      });
      return;
    }
    
    // Check for duplicate names (different socket, same name)
    const duplicateName = room.participants.find(p => p.name === participantName && p.id !== socket.id);
    if (duplicateName) {
      console.log(`⚠️ Duplicate name ${participantName} detected in room ${roomId}`);
      socket.emit('error', `Name "${participantName}" is already taken in this room`);
      return;
    }
    
    // Set admin if this is the host joining
    if (isHost && !room.adminId) {
      room.adminId = socket.id;
      console.log(`👑 ${participantName} is now the admin of room ${roomId}`);
    }
    
    // Add participant to room
    const participant = {
      id: socket.id,
      name: participantName,
      email: participantEmail,
      isAdmin: isHost || socket.id === room.adminId,
      isVideoEnabled: true,
      isAudioEnabled: true,
      isScreenSharing: false,
      hasRaisedHand: false,
      joinedAt: new Date().toISOString()
    };
    
    room.participants.push(participant);
    userSockets.set(socket.id, { roomId, participant });
    
    socket.join(roomId);
    
    // Get ONLY existing participants (excluding the new one)
    const existingParticipants = room.participants.filter(p => p.id !== socket.id);
    
    console.log(`✅ ${participantName} joined room ${roomId}`);
    console.log(`📊 Room ${roomId} participants: ${room.participants.map(p => `${p.name}${p.isAdmin ? '(ADMIN)' : ''}`).join(', ')}`);
    console.log(`📊 Existing participants for new user: ${existingParticipants.map(p => p.name).join(', ')}`);
    console.log(`📊 Total room participants: ${room.participants.length}`);
    
    // Send room info with ONLY existing participants to the new user
    socket.emit('room-joined', {
      room: {
        id: room.id,
        creatorName: room.creatorName,
        adminId: room.adminId,
        participants: existingParticipants, // CRITICAL: Only existing participants
        chatMessages: room.chatMessages || [],
        raisedHands: room.raisedHands || []
      },
      isAdmin: participant.isAdmin
    });
    
    // Notify ONLY existing participants about new user
    socket.to(roomId).emit('user-joined', participant);
    
    // Broadcast updated participant count to all users in room
    const totalCount = room.participants.length;
    io.to(roomId).emit('participant-count-updated', { count: totalCount });
    
    console.log(`📊 Broadcasting participant count: ${totalCount} to room ${roomId}`);
  });

  // WebRTC signaling events
  socket.on('offer', ({ offer, targetId }) => {
    console.log(`📤 Relaying OFFER from ${socket.id} to ${targetId}`);
    socket.to(targetId).emit('offer', { offer, senderId: socket.id });
  });
  
  socket.on('answer', ({ answer, targetId }) => {
    console.log(`📥 Relaying ANSWER from ${socket.id} to ${targetId}`);
    socket.to(targetId).emit('answer', { answer, senderId: socket.id });
  });
  
  socket.on('ice-candidate', ({ candidate, targetId }) => {
    console.log(`🧊 Relaying ICE candidate from ${socket.id} to ${targetId}`);
    socket.to(targetId).emit('ice-candidate', { candidate, senderId: socket.id });
  });

  // Admin-only actions
  socket.on('admin-remove-participant', ({ participantId }) => {
    const userInfo = userSockets.get(socket.id);
    if (!userInfo) {
      console.log(`❌ No user info found for admin ${socket.id}`);
      return;
    }
    
    const { roomId } = userInfo;
    const room = rooms.get(roomId);
    
    if (!room || room.adminId !== socket.id) {
      console.log(`❌ Unauthorized remove attempt by ${socket.id}`);
      socket.emit('error', 'Only admin can remove participants');
      return;
    }
    
    const participantToRemove = room.participants.find(p => p.id === participantId);
    if (!participantToRemove) {
      console.log(`❌ Participant ${participantId} not found in room ${roomId}`);
      return;
    }
    
    console.log(`👑 Admin ${socket.id} removing participant ${participantId} (${participantToRemove.name})`);
    
    // First, remove from room data structures
    room.participants = room.participants.filter(p => p.id !== participantId);
    room.raisedHands = room.raisedHands.filter(h => h.participantId !== participantId);
    userSockets.delete(participantId);
    
    // Force disconnect the participant with immediate cleanup
    const participantSocket = io.sockets.sockets.get(participantId);
    if (participantSocket) {
      // Send force disconnect message
      participantSocket.emit('force-disconnect', { 
        reason: 'Removed by admin',
        message: 'You have been removed from the meeting by the host.'
      });
      
      // Force leave the room
      participantSocket.leave(roomId);
      
      // Disconnect the socket after a brief delay
      setTimeout(() => {
        if (participantSocket.connected) {
          participantSocket.disconnect(true);
        }
      }, 1000);
    }
    
    // Immediately notify all remaining participants about removal
    io.to(roomId).emit('participant-removed', { 
      participantId, 
      participantName: participantToRemove.name,
      removedBy: userInfo.participant.name
    });
    
    // Update participant count for all remaining users
    io.to(roomId).emit('participant-count-updated', { count: room.participants.length });
    
    console.log(`✅ Participant ${participantToRemove.name} successfully removed from room ${roomId}`);
    console.log(`📊 Remaining participants: ${room.participants.length}`);
  });

  socket.on('admin-end-meeting', () => {
    const userInfo = userSockets.get(socket.id);
    if (!userInfo) {
      console.log(`❌ No user info found for admin ${socket.id}`);
      return;
    }
    
    const { roomId } = userInfo;
    const room = rooms.get(roomId);
    
    if (!room || room.adminId !== socket.id) {
      console.log(`❌ Unauthorized end meeting attempt by ${socket.id}`);
      socket.emit('error', 'Only admin can end the meeting');
      return;
    }
    
    console.log(`👑 Admin ${socket.id} ending meeting for room ${roomId}`);
    
    // Notify all participants that meeting is ending
    io.to(roomId).emit('meeting-ended', {
      reason: 'Meeting ended by host',
      message: 'The meeting has been ended by the host.',
      endedBy: userInfo.participant.name
    });
    
    // Force disconnect all participants
    room.participants.forEach(participant => {
      if (participant.id !== socket.id) {
        const participantSocket = io.sockets.sockets.get(participant.id);
        if (participantSocket) {
          participantSocket.leave(roomId);
          setTimeout(() => {
            if (participantSocket.connected) {
              participantSocket.disconnect(true);
            }
          }, 2000);
        }
      }
      userSockets.delete(participant.id);
    });
    
    // Clean up room
    rooms.delete(roomId);
    console.log(`🗑️ Room ${roomId} deleted by admin`);
  });

  // Media control events
  socket.on('toggle-video', ({ isEnabled }) => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      const { roomId } = userInfo;
      const room = rooms.get(roomId);
      if (room) {
        const participant = room.participants.find(p => p.id === socket.id);
        if (participant) {
          participant.isVideoEnabled = isEnabled;
          socket.to(roomId).emit('participant-video-toggle', { 
            participantId: socket.id, 
            isEnabled 
          });
        }
      }
    }
  });

  socket.on('toggle-audio', ({ isEnabled }) => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      const { roomId } = userInfo;
      const room = rooms.get(roomId);
      if (room) {
        const participant = room.participants.find(p => p.id === socket.id);
        if (participant) {
          participant.isAudioEnabled = isEnabled;
          socket.to(roomId).emit('participant-audio-toggle', { 
            participantId: socket.id, 
            isEnabled 
          });
        }
      }
    }
  });

  // Chat functionality
  socket.on('send-chat-message', ({ message }) => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      const { roomId, participant } = userInfo;
      const room = rooms.get(roomId);
      if (room) {
        const chatMessage = {
          id: Date.now(),
          senderId: socket.id,
          senderName: participant.name,
          message,
          timestamp: new Date().toISOString()
        };
        
        room.chatMessages.push(chatMessage);
        io.to(roomId).emit('new-chat-message', chatMessage);
      }
    }
  });

  // Reactions
  socket.on('send-reaction', ({ reaction }) => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      const { roomId, participant } = userInfo;
      const reactionData = {
        id: Date.now(),
        senderId: socket.id,
        senderName: participant.name,
        reaction,
        timestamp: new Date().toISOString()
      };
      
      io.to(roomId).emit('new-reaction', reactionData);
    }
  });

  // Raise hand
  socket.on('toggle-raise-hand', ({ isRaised }) => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      const { roomId, participant } = userInfo;
      const room = rooms.get(roomId);
      if (room) {
        const roomParticipant = room.participants.find(p => p.id === socket.id);
        if (roomParticipant) {
          roomParticipant.hasRaisedHand = isRaised;
          
          if (isRaised) {
            room.raisedHands.push({
              participantId: socket.id,
              participantName: participant.name,
              timestamp: new Date().toISOString()
            });
          } else {
            room.raisedHands = room.raisedHands.filter(h => h.participantId !== socket.id);
          }
          
          io.to(roomId).emit('participant-hand-toggle', { 
            participantId: socket.id, 
            isRaised,
            participantName: participant.name
          });
        }
      }
    }
  });

  // Get room stats
  socket.on('get-room-stats', () => {
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      const { roomId } = userInfo;
      const room = rooms.get(roomId);
      if (room) {
        const stats = {
          totalParticipants: room.participants.length,
          chatMessages: room.chatMessages.length,
          raisedHands: room.raisedHands.length,
          videoEnabled: room.participants.filter(p => p.isVideoEnabled).length,
          audioEnabled: room.participants.filter(p => p.isAudioEnabled).length,
          roomDuration: Date.now() - new Date(room.createdAt).getTime()
        };
        
        socket.emit('room-stats', stats);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    const userInfo = userSockets.get(socket.id);
    if (userInfo) {
      const { roomId, participant } = userInfo;
      const room = rooms.get(roomId);
      
      if (room) {
        const initialCount = room.participants.length;
        
        // Check if admin is leaving
        if (room.adminId === socket.id) {
          console.log(`👑 Admin ${participant.name} left room ${roomId} - ENDING MEETING FOR ALL`);
          
          // Notify all participants that admin left and meeting is ending
          socket.to(roomId).emit('meeting-ended', {
            reason: 'Admin left the meeting',
            message: 'The meeting has ended because the host left.'
          });
          
          // Clean up all participants
          room.participants.forEach(p => {
            if (p.id !== socket.id) {
              userSockets.delete(p.id);
            }
          });
          
          // Delete the room
          rooms.delete(roomId);
          console.log(`🗑️ Room ${roomId} deleted - Admin left`);
        } else {
          // Regular participant leaving
          room.participants = room.participants.filter(p => p.id !== socket.id);
          room.raisedHands = room.raisedHands.filter(h => h.participantId !== socket.id);
          
          // Notify other participants
          socket.to(roomId).emit('user-left', socket.id);
          io.to(roomId).emit('participant-count-updated', { count: room.participants.length });
          
          console.log(`👋 ${participant.name} left room ${roomId}`);
          console.log(`📊 Participants before: ${initialCount}, after: ${room.participants.length}`);
          
          // Clean up empty rooms
          if (room.participants.length === 0) {
            rooms.delete(roomId);
            console.log(`🗑️ Room ${roomId} deleted (empty)`);
          }
        }
      }
      
      userSockets.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log("📹 WebRTC signaling server ready - ADMIN PRIVILEGES ENABLED");
  console.log("👑 Admin can remove participants and end meetings");
  console.log("💬 Chat and reactions enabled");
  console.log("🖐️ Raise hand functionality enabled");
  console.log("📊 Room statistics enabled");
});