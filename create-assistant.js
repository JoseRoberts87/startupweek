import OpenAI from 'openai';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function createDefaultAssistant() {
  try {
    console.log('🤖 Creating a default assistant...\n');
    
    const assistant = await openai.beta.assistants.create({
      name: "Helpful Assistant",
      instructions: "You are a helpful, professional assistant. Provide clear, concise, and accurate responses. Be friendly but professional in your tone. If you're unsure about something, be honest about it.",
      model: "gpt-3.5-turbo",
      tools: []
    });

    const config = {
      assistantId: assistant.id,
      name: assistant.name,
      model: assistant.model,
      instructions: assistant.instructions,
      tools: assistant.tools,
      createdAt: new Date().toISOString(),
    };

    await fs.writeFile('./assistant-config.json', JSON.stringify(config, null, 2));
    
    console.log('✅ Assistant created successfully!\n');
    console.log('📊 Assistant Details:');
    console.log(`   ID: ${assistant.id}`);
    console.log(`   Name: ${assistant.name}`);
    console.log(`   Model: ${assistant.model}`);
    console.log(`\n💾 Configuration saved to: assistant-config.json`);
    console.log('\n🚀 You can now start the assistant server with: npm run start:assistant');
    
    return assistant;
  } catch (error) {
    console.error('❌ Error creating assistant:', error.message);
    process.exit(1);
  }
}

createDefaultAssistant();