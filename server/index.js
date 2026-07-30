import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import fs from "fs";
import os from "os";
import path from "path";

dotenv.config();

const app = express();

// Always allow both local dev and Render production origins
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://video-meet-client.onrender.com',
  'https://video-meet-aj54.onrender.com'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  },
  // Increase limits for audio data
  maxHttpBufferSize: 10 * 1024 * 1024 // 10MB
});

// Initialize Groq
if (!process.env.GROQ_API_KEY) {
  console.error('❌ GROQ_API_KEY is not set! Translation will not work.');
} else {
  console.log('✅ GROQ_API_KEY loaded');
}
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Use OS temp directory for audio files (works on Render and locally)
const TEMP_DIR = os.tmpdir();

// Clean up any leftover temp files from previous sessions
const cleanupTempFiles = () => {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const tempFiles = files.filter(f => f.startsWith('vm_temp_') && f.endsWith('.wav'));
    if (tempFiles.length > 0) {
      tempFiles.forEach(f => {
        try { fs.unlinkSync(path.join(TEMP_DIR, f)); } catch (e) {}
      });
      console.log(`🧹 Cleaned up ${tempFiles.length} leftover temp files`);
    }
  } catch (e) {}
};
cleanupTempFiles();

// Store rooms and their participants
const rooms = new Map();
const userSockets = new Map();
// Per-room active speaker lock: roomId → { socketId, lockedAt }
const activeSpeakers = new Map();
const SPEAKER_LOCK_TIMEOUT_MS = 12000; // auto-release if server hangs
// Per-room whiteboard stroke history for late-joiner sync
const whiteboardState = new Map(); // roomId → stroke[]

// Health check endpoint (keeps Render service alive)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    groqConfigured: !!process.env.GROQ_API_KEY,
    rooms: rooms.size,
    uptime: process.uptime()
  });
});

// Room management endpoints
app.post('/api/rooms', (req, res) => {
  const { creatorName, creatorEmail, roomId, passcode, meetingDate, meetingTime } = req.body;
  
  console.log('📥 Room creation request:', { roomId, creatorName, creatorEmail });
  
  if (rooms.has(roomId)) {
    console.log(`❌ Room ${roomId} already exists`);
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
  console.log(`📊 Total rooms in memory: ${rooms.size}`);
  res.json({ success: true, room });
});

app.get('/api/rooms', (req, res) => {
  console.log('📋 Listing all rooms');
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    creatorName: room.creatorName,
    meetingDate: room.meetingDate,
    meetingTime: room.meetingTime,
    participantCount: room.participants.length,
    createdAt: room.createdAt
  }));
  console.log(`📊 Total rooms: ${roomList.length}`);
  res.json(roomList);
});

app.post('/api/rooms/:roomId/verify', (req, res) => {
  const { roomId } = req.params;
  const { passcode } = req.body;
  
  console.log(`🔍 Room verification request for: ${roomId}`);
  console.log(`📊 Available rooms: ${Array.from(rooms.keys()).join(', ') || 'none'}`);
  
  const room = rooms.get(roomId);
  if (!room) {
    console.log(`❌ Room ${roomId} not found`);
    return res.status(404).json({ error: 'Room not found' });
  }
  
  if (room.passcode !== passcode) {
    console.log(`❌ Invalid passcode for room ${roomId}`);
    return res.status(401).json({ error: 'Invalid passcode' });
  }
  
  console.log(`✅ Room ${roomId} verified successfully`);
  res.json({ success: true });
});

io.on("connection", socket => {
  console.log(`🔗 User connected: ${socket.id}`);

  // Audio transcription and translation
  socket.on("send-audio", async (audioData) => {
    try {
      console.log(`🎤 Received audio from ${socket.id}`);
      
      const { audio, targetLanguage = 'es' } = audioData;
      
      // Convert base64 audio to file
      const buffer = Buffer.from(audio.split(",")[1], "base64");
      const tempFilePath = path.join(TEMP_DIR, `vm_temp_${socket.id}_${Date.now()}.wav`);
      fs.writeFileSync(tempFilePath, buffer);
      console.log(`✅ Audio file created: ${tempFilePath} (${buffer.length} bytes)`);

      // Transcribe audio using Whisper
      console.log(`🎙️ Sending to Groq Whisper...`);
      let text;
      try {
        const transcription = await groq.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: "whisper-large-v3",
          response_format: "json"
        });

        text = transcription.text;
        console.log(`📝 Transcribed: ${text}`);
      } catch (transcriptionError) {
        console.error(`❌ Transcription failed:`, transcriptionError.message);
        fs.unlinkSync(tempFilePath);
        socket.emit("transcription-error", { 
          error: "Failed to transcribe audio",
          details: transcriptionError.message 
        });
        return;
      }

      // Get language name for better translation
      const languageNames = {
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
        'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
        'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi',
        'tr': 'Turkish', 'nl': 'Dutch', 'pl': 'Polish'
      };
      
      const targetLangName = languageNames[targetLanguage] || 'Spanish';

      // Translate text to target language
      console.log(`🔄 Translating to ${targetLangName}...`);
      const translation = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { 
            role: "system", 
            content: `You are a professional translator. Translate the given text to ${targetLangName}. Only provide the translation, no explanations.` 
          },
          { 
            role: "user", 
            content: text 
          }
        ],
        temperature: 0.3,
        max_tokens: 1024
      });

      const translatedText = translation.choices[0].message.content;
      console.log(`🌐 Translated to ${targetLangName}: ${translatedText}`);

      // Send original + translated text back
      socket.emit("transcription-result", {
        original: text,
        translated: translatedText,
        targetLanguage,
        targetLanguageName: targetLangName
      });

      // Delete temp file
      fs.unlinkSync(tempFilePath);
      console.log(`✅ Audio processing complete for ${socket.id}`);

    } catch (err) {
      console.error("❌ Error processing audio:", err);
      socket.emit("transcription-error", { 
        error: "Failed to process audio",
        details: err.message 
      });
    }
  });

  // Continuous audio translation - broadcasts to all participants
  socket.on("continuous-audio", async (audioData) => {
    try {
      const { audio, roomId, speakerName } = audioData;

      const room = rooms.get(roomId);
      if (!room) {
        console.log(`❌ Room ${roomId} not found`);
        return;
      }

      // ── Speaker lock: only one active speaker per room ───────────────────
      const now = Date.now();
      const current = activeSpeakers.get(roomId);

      if (current && current.socketId !== socket.id) {
        // Auto-release stale lock (in case previous processing hung)
        if (now - current.lockedAt < SPEAKER_LOCK_TIMEOUT_MS) {
          console.log(`🔒 Room ${roomId} busy — ${current.speakerName} is speaking, dropping ${speakerName}'s chunk`);
          socket.emit('speaker-busy', { activeSpeaker: current.speakerName });
          return;
        }
        console.log(`⏰ Stale speaker lock released for ${current.speakerName}`);
      }

      // Acquire lock
      activeSpeakers.set(roomId, { socketId: socket.id, speakerName, lockedAt: now });
      console.log(`🔓 Speaker lock acquired: ${speakerName} in room ${roomId}`);

      console.log(`🎤 Audio chunk | Speaker: ${speakerName} | Room: ${roomId} | Size: ${audio ? audio.length : 0} chars`);

      // Convert base64 audio to file
      if (!audio || !audio.includes(',')) {
        console.log(`❌ Invalid audio data format`);
        activeSpeakers.delete(roomId);
        return;
      }

      const buffer = Buffer.from(audio.split(",")[1], "base64");

      // Reject suspiciously small buffers (pure silence / codec header only)
      if (buffer.length < 1000) {
        console.log(`⚠️ Buffer too small (${buffer.length}B), skipping`);
        activeSpeakers.delete(roomId);
        return;
      }

      const tempFilePath = path.join(TEMP_DIR, `vm_temp_${socket.id}_${Date.now()}.wav`);
      fs.writeFileSync(tempFilePath, buffer);

      // Transcribe
      let text;
      try {
        const transcription = await groq.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: "whisper-large-v3",
          response_format: "json"
        });
        text = transcription.text?.trim();
        console.log(`📝 Transcribed: "${text}"`);

        if (!text || text.length < 2) {
          console.log(`⚠️ Empty/too-short transcription, skipping`);
          fs.unlinkSync(tempFilePath);
          activeSpeakers.delete(roomId);
          return;
        }

        // Filter Whisper hallucinations — common silence artifacts
        const HALLUCINATIONS = [
          /^(thank you|thanks|you|bye|goodbye|\.+|,+|\s+)$/i,
          /^\[.*\]$/, // e.g. [Music], [Applause]
          /^(um+|uh+|hmm+|ah+)$/i
        ];
        if (HALLUCINATIONS.some(re => re.test(text))) {
          console.log(`🚫 Hallucination filtered: "${text}"`);
          fs.unlinkSync(tempFilePath);
          activeSpeakers.delete(roomId);
          return;
        }
      } catch (transcriptionError) {
        console.error(`❌ Transcription failed:`, transcriptionError.message);
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
        activeSpeakers.delete(roomId);
        return;
      }

      // Language map
      const languageNames = {
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
        'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
        'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi',
        'tr': 'Turkish', 'nl': 'Dutch', 'pl': 'Polish'
      };

      // Group other participants by their preferred translation language
      const participantsByLanguage = new Map();
      room.participants
        .filter(p => p.id !== socket.id)
        .forEach(participant => {
          const lang = participant.translationLanguage || 'en';
          if (!participantsByLanguage.has(lang)) participantsByLanguage.set(lang, []);
          participantsByLanguage.get(lang).push(participant);
        });

      if (participantsByLanguage.size === 0) {
        console.log(`⚠️ No other participants to translate for`);
        fs.unlinkSync(tempFilePath);
        activeSpeakers.delete(roomId);
        return;
      }

      // Translate once per unique target language, send to all who need it
      const translationPromises = Array.from(participantsByLanguage.entries()).map(async ([targetLang, participants]) => {
        try {
          const targetLangName = languageNames[targetLang] || 'English';
          console.log(`🔄 Translating to ${targetLangName}...`);

          const translation = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `You are a professional real-time interpreter. Translate the following speech to ${targetLangName}. Output only the translation, nothing else.`
              },
              { role: "user", content: text }
            ],
            temperature: 0.2,
            max_tokens: 512
          });

          const translatedText = translation.choices[0].message.content?.trim();
          if (!translatedText) return;

          console.log(`✅ → ${targetLangName}: "${translatedText}"`);

          participants.forEach(participant => {
            const participantSocket = io.sockets.sockets.get(participant.id);
            if (participantSocket) {
              participantSocket.emit('participant-translation', {
                original: text,
                translated: translatedText,
                targetLanguage: targetLang,
                targetLanguageName: targetLangName,
                speakerName
              });
            }
          });
        } catch (err) {
          console.error(`❌ Translation error for ${targetLang}:`, err.message);
        }
      });

      await Promise.all(translationPromises);
      fs.unlinkSync(tempFilePath);

      // Release speaker lock
      activeSpeakers.delete(roomId);
      console.log(`🔓 Speaker lock released: ${speakerName}`);

    } catch (err) {
      console.error("❌ Error processing continuous audio:", err.message);
      // Always release lock on error
      try {
        const { roomId } = audioData || {};
        if (roomId) activeSpeakers.delete(roomId);
      } catch (e) {}
    }
  });

  socket.on('join-room', ({ roomId, passcode, participantName, participantEmail, isHost, translationLanguage }) => {
    console.log(`👤 ${participantName} (${socket.id}) attempting to join room ${roomId} as ${isHost ? 'ADMIN' : 'PARTICIPANT'} with translation: ${translationLanguage || 'none'}`);
    
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

    // Check for reconnect by name — update socket ID instead of rejecting
    const reconnecting = room.participants.find(p => p.name === participantName && p.email === participantEmail && p.id !== socket.id);
    if (reconnecting) {
      console.log(`🔄 Participant ${participantName} reconnecting — updating socket ID from ${reconnecting.id} to ${socket.id}`);
      const oldId = reconnecting.id;
      reconnecting.id = socket.id;
      if (room.adminId === oldId) room.adminId = socket.id;
      userSockets.delete(oldId);
      userSockets.set(socket.id, { roomId, participant: reconnecting });
      socket.join(roomId);
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
        isAdmin: reconnecting.isAdmin
      });
      socket.to(roomId).emit('user-joined', reconnecting);
      return;
    }
    
    // Set admin if this is the host joining
    if (isHost && !room.adminId) {
      room.adminId = socket.id;
      console.log(`👑 ${participantName} is now the admin of room ${roomId}`);
    }
    
    // Add participant to room with translation language
    const participant = {
      id: socket.id,
      name: participantName,
      email: participantEmail,
      isAdmin: isHost || socket.id === room.adminId,
      isVideoEnabled: true,
      isAudioEnabled: true,
      isScreenSharing: false,
      hasRaisedHand: false,
      translationLanguage: translationLanguage || 'en', // Store user's preferred language
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
    whiteboardState.delete(roomId);
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

  // ── Whiteboard ────────────────────────────────────────────────────────────

  // A participant drew a stroke — broadcast to room, persist for late joiners
  socket.on('wb-draw', ({ roomId, stroke }) => {
    if (!roomId || !stroke) return;
    const room = rooms.get(roomId);
    if (!room) return;

    // Persist stroke
    if (!whiteboardState.has(roomId)) whiteboardState.set(roomId, []);
    whiteboardState.get(roomId).push(stroke);

    // Broadcast to everyone else in the room
    socket.to(roomId).emit('wb-draw', { stroke });
  });

  // A participant cleared the board
  socket.on('wb-clear', ({ roomId }) => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    whiteboardState.set(roomId, []);
    socket.to(roomId).emit('wb-clear');
    console.log(`🗑️ Whiteboard cleared in room ${roomId} by ${socket.id}`);
  });

  // A newly joined participant requests the current board state
  socket.on('wb-state-request', ({ roomId }) => {
    if (!roomId) return;
    const strokes = whiteboardState.get(roomId) || [];
    socket.emit('wb-state-sync', { strokes });
    console.log(`📋 Sent ${strokes.length} whiteboard strokes to ${socket.id} for room ${roomId}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    // Clean up any temp files for this socket
    try {
      const files = fs.readdirSync(TEMP_DIR);
      files.filter(f => f.startsWith(`vm_temp_${socket.id}`) && f.endsWith('.wav'))
           .forEach(f => { try { fs.unlinkSync(path.join(TEMP_DIR, f)); } catch (e) {} });
    } catch (e) {}

    // Release speaker lock if this socket held it
    activeSpeakers.forEach((value, roomId) => {
      if (value.socketId === socket.id) {
        activeSpeakers.delete(roomId);
        console.log(`🔓 Speaker lock released on disconnect for room ${roomId}`);
      }
    });
    
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
          whiteboardState.delete(roomId);
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
  console.log("🎤 Audio translation powered by Groq (Whisper + Llama 3.3)");
  console.log("👑 Admin can remove participants and end meetings");
  console.log("💬 Chat and reactions enabled");
  console.log("🖐️ Raise hand functionality enabled");
  console.log("📊 Room statistics enabled");
});