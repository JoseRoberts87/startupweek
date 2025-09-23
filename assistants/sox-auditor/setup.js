import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupSOXAssistant(openai) {
  const configPath = path.join(__dirname, 'config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  
  // Check if assistant already exists
  const runtimeConfigPath = path.join(__dirname, 'runtime.json');
  
  try {
    const runtimeConfig = JSON.parse(await fs.readFile(runtimeConfigPath, 'utf8'));
    
    // Try to retrieve existing assistant
    try {
      const assistant = await openai.beta.assistants.retrieve(runtimeConfig.assistantId);
      console.log(`✅ Found existing SOX assistant: ${assistant.name} (${assistant.id})`);
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
  
  console.log(`✅ Created SOX assistant: ${assistant.name} (${assistant.id})`);
  return assistant;
}

export async function getSOXAssistantConfig() {
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