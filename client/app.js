import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://video-meet-aj54.onrender.com");

function App() {
  const [original, setOriginal] = useState("");
  const [translated, setTranslated] = useState("");

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();

    mediaRecorder.ondataavailable = (e) => {
      const reader = new FileReader();
      reader.readAsDataURL(e.data);
      reader.onloadend = () => {
        socket.emit("send-audio", reader.result);
      };
    };
  };

  useEffect(() => {
    socket.on("transcription-result", (data) => {
      setOriginal(data.original);
      setTranslated(data.translated);
    });
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Voice Translate App</h2>
      <button onClick={startRecording}>Start Speaking</button>
      <h3>Original:</h3>
      <p>{original}</p>
      <h3>Translated:</h3>
      <p>{translated}</p>
    </div>
  );
}

export default App;