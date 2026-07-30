import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { OpenAI } from "openai";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Receive audio from client
  socket.on("send-audio", async (audioData) => {
    try {
      // Convert base64 audio to file
      const buffer = Buffer.from(audioData.split(",")[1], "base64");
      fs.writeFileSync("temp.wav", buffer);

      // Transcribe audio
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream("temp.wav"),
        model: "whisper-1"
      });

      const text = transcription.text;

      // Translate text (example to Spanish)
      const translation = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: `Translate this to Spanish: ${text}` }
        ]
      });

      // Send original + translated text back
      socket.emit("transcription-result", {
        original: text,
        translated: translation.choices[0].message.content
      });

      // Delete temp file
      fs.unlinkSync("temp.wav");

    } catch (err) {
      console.error("Error processing audio:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));