# 🎥 Video Meet – Real-Time Multilingual Video Conferencing

A real-time video conferencing application built with **React**, **Node.js**, **Socket.IO**, and **WebRTC** that supports **live voice translation** using the **Groq API** (Whisper + Llama 3.3).

---

# 📌 Features

* 🎥 Real-time video conferencing using WebRTC
* 🎤 Live voice communication
* 🌐 Real-time speech translation
* 💬 Live chat messaging
* 😀 Emoji reactions
* 🖐️ Raise hand feature
* 👑 Admin controls

  * Remove participants
  * End meeting
* 📊 Room statistics
* 🔒 Room ID & passcode protection
* ⚡ Fast translation powered by Groq AI

---

# 🛠️ Tech Stack

## Frontend

* React.js
* HTML5
* CSS3
* JavaScript
* WebRTC
* Socket.IO Client

## Backend

* Node.js
* Express.js
* Socket.IO
* Multer
* Dotenv
* fs (File System)

## AI Services

* Groq API

### Models Used

| Purpose        | Model                   |
| -------------- | ----------------------- |
| Speech-to-Text | whisper-large-v3        |
| Translation    | llama-3.3-70b-versatile |

---

# 📁 Project Structure

```
video-meet/
│
├── client/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── ...
│
├── server/
│   ├── index.js
│   ├── package.json
│   ├── .env
│   └── ...
│
├── README.md
└── .gitignore
```

---

# ⚙️ Installation

## Clone Repository

```bash
git clone <repository-url>
cd video-meet
```

---

## Install Backend

```bash
cd server
npm install
```

---

## Install Frontend

```bash
cd ../client
npm install
```

---

# 🔑 Environment Variables

Create a `.env` file inside the **server** folder.

```
GROQ_API_KEY=your_groq_api_key_here
PORT=5001
```

> Never upload your actual API key to GitHub.

---

# ▶️ Run Backend

```
cd server
node index.js
```

Expected Output

```
✅ GROQ_API_KEY loaded

🚀 Server running on port 5001

📹 WebRTC signaling server ready

🎤 Audio translation powered by Groq (Whisper + Llama 3.3)

👑 Admin can remove participants and end meetings

💬 Chat and reactions enabled

🖐️ Raise hand functionality enabled

📊 Room statistics enabled
```

---

# ▶️ Run Frontend

```
cd client
npm start
```

Application runs at

```
http://localhost:3000
```

---

# 🌐 Voice Translation Workflow

The application performs live voice translation using Groq AI.

### Step 1

User speaks through microphone.

↓

### Step 2

Browser records audio.

↓

### Step 3

Audio is sent to the Node.js server through Socket.IO.

↓

### Step 4

Server stores the audio temporarily as a `.wav` file.

↓

### Step 5

Groq Whisper (`whisper-large-v3`) converts speech into text.

↓

### Step 6

Groq Llama (`llama-3.3-70b-versatile`) translates the text into the participant's selected language.

↓

### Step 7

Server broadcasts the translated text to all other participants.

↓

### Step 8

Clients display:

* Original Speech
* Translated Speech

---

# 🌍 Example

### Speaker (English)

```
Hello, how are you today?
```

↓

### Whisper

```
Hello, how are you today?
```

↓

### Llama Translation (Spanish)

```
Hola, ¿cómo estás hoy?
```

↓

Displayed to participant.

---

# 🎤 Translation Pipeline

```
Microphone

↓

WebRTC Audio

↓

Socket.IO

↓

Node.js Server

↓

Groq Whisper

↓

Speech to Text

↓

Groq Llama

↓

Translation

↓

Socket.IO

↓

Participants
```

---

# 🧠 Admin Features

* Create Meeting
* End Meeting
* Remove Participants
* Room Management

---

# 👥 Participant Features

* Join Meeting
* Video Call
* Audio Call
* Live Translation
* Chat
* Raise Hand
* Emoji Reactions

---

# 🔄 Translation Flow

```
Participant Speaks

↓

Audio Chunk

↓

Server Receives

↓

Whisper Transcription

↓

Llama Translation

↓

Broadcast Translation

↓

Display on Client
```

---

# 📋 Server Console Logs

Successful processing displays logs similar to:

```
🎤 CONTINUOUS AUDIO RECEIVED

📝 Transcribed:
"Hello, how are you?"

🔄 Translating to Spanish...

✅ Translated:
"Hola, ¿cómo estás?"

📤 Translation Sent

✅ Processing Complete
```

---

# 🧪 Testing

## Terminal 1

```
cd server

node index.js
```

## Terminal 2

```
cd client

npm start
```

---

## Browser Tab 1

Create Room

---

## Browser Tab 2

Join Room

---

Enable **Auto Translate** on both tabs and start speaking.

---

# 🚀 Future Improvements

* Screen Sharing
* Meeting Recording
* AI Meeting Summary
* Live Captions
* Multiple Translation Models
* Noise Suppression
* User Authentication
* Cloud Deployment
* Docker Support
* Kubernetes Deployment

---

# ☁️ Deployment

This project can be deployed using:

* Docker
* Jenkins
* GitHub
* AWS IAM
* AWS ECR
* AWS EC2
* Nginx
* GitHub Webhooks

CI/CD Pipeline

```
GitHub

↓

Webhook

↓

Jenkins

↓

Build Client

↓

Build Server

↓

Docker Images

↓

AWS ECR

↓

EC2

↓

Docker Compose

↓

Application Running
```

---

# 🔒 Security

* Room Passcode Protection
* Admin Authorization
* Environment Variables
* Secure API Key Storage
* Socket-Based Communication

---

# 📌 Requirements

* Node.js 18+ (Recommended)
* npm
* Modern Browser
* Microphone
* Webcam
* Internet Connection
* Groq API Key

---

# 👨‍💻 Author

**Rajasakthikumar**

Built as a real-time multilingual video conferencing application using **React**, **Node.js**, **WebRTC**, **Socket.IO**, and **Groq AI** for instant voice translation.

---

# 📄 License

This project is intended for educational and learning purposes.
