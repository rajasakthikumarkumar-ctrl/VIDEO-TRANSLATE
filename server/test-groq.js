// Test Groq API to verify it's working
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function testGroq() {
  console.log('🧪 Testing Groq API...\n');

  try {
    // Test 1: Simple chat completion
    console.log('1️⃣ Testing Chat Completion (Translation)');
    const chatResponse = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { 
          role: "system", 
          content: "You are a professional translator. Translate the given text to Spanish. Only provide the translation, no explanations." 
        },
        { 
          role: "user", 
          content: "Hello, how are you?" 
        }
      ],
      temperature: 0.3,
      max_tokens: 1024
    });
    
    console.log('✅ Translation test passed!');
    console.log('   Original: "Hello, how are you?"');
    console.log('   Translated:', chatResponse.choices[0].message.content);
    console.log('');

    console.log('✅ Groq API is working correctly!');
    console.log('');
    console.log('⚠️ Note: Whisper transcription requires actual audio file.');
    console.log('   The server will test this when you speak in the meeting.');
    console.log('');

  } catch (error) {
    console.error('❌ Groq API test failed!');
    console.error('Error:', error.message);
    if (error.status) {
      console.error('Status:', error.status);
    }
    if (error.error) {
      console.error('Details:', error.error);
    }
    console.log('');
    console.log('💡 Possible issues:');
    console.log('   1. Invalid API key');
    console.log('   2. Network connection problem');
    console.log('   3. Groq service is down');
    console.log('');
  }
}

testGroq();
