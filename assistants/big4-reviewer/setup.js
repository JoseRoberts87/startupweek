import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupBig4Assistant(openai) {
  const configPath = path.join(__dirname, 'config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  
  // Check if assistant already exists
  const runtimeConfigPath = path.join(__dirname, 'runtime.json');
  
  try {
    const runtimeConfig = JSON.parse(await fs.readFile(runtimeConfigPath, 'utf8'));
    
    // Try to retrieve existing assistant
    try {
      const assistant = await openai.beta.assistants.retrieve(runtimeConfig.assistantId);
      console.log(`✅ Found existing Big 4 assistant: ${assistant.name} (${assistant.id})`);
      return assistant;
    } catch (error) {
      console.log('⚠️  Previous assistant not found, creating new one...');
    }
  } catch (error) {
    // No runtime config exists yet
  }
  
  // Create new assistant
  const assistant = await openai.beta.assistants.create({
    name: config.name,
    instructions: config.instructions,
    model: config.model,
    temperature: config.temperature,
    tools: config.tools
  });
  
  // Save runtime configuration
  const runtimeConfig = {
    assistantId: assistant.id,
    createdAt: new Date().toISOString(),
    ...config
  };
  
  await fs.writeFile(runtimeConfigPath, JSON.stringify(runtimeConfig, null, 2));
  
  console.log(`✅ Created Big 4 assistant: ${assistant.name} (${assistant.id})`);
  return assistant;
}

export async function getBig4AssistantConfig() {
  const configPath = path.join(__dirname, 'config.json');
  const runtimePath = path.join(__dirname, 'runtime.json');
  
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  
  try {
    const runtime = JSON.parse(await fs.readFile(runtimePath, 'utf8'));
    return { ...config, ...runtime };
  } catch (error) {
    return config;
  }
}

// Standalone setup script
if (import.meta.url === `file://${process.argv[1]}`) {
  import('dotenv').then(dotenv => {
    dotenv.config();
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    setupBig4Assistant(openai)
      .then(assistant => {
        console.log('\n🎉 Big 4 External Auditor assistant is ready!');
        console.log('Run the multi-assistant server to use it: npm start');
      })
      .catch(error => {
        console.error('❌ Failed to setup Big 4 assistant:', error.message);
        process.exit(1);
      });
  });
}