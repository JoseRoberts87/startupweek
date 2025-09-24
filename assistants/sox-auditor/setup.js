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
  
  // Upload data files for the assistant
  console.log('📁 Uploading data files...');
  const dataDir = path.join(path.dirname(__dirname), '..', 'data');
  const files = [];
  
  try {
    // Upload Active Directory data
    const adData = await fs.readFile(path.join(dataDir, 'active_directory.json'), 'utf8');
    const adFile = await openai.files.create({
      file: new Blob([adData], { type: 'application/json' }),
      purpose: 'assistants'
    });
    files.push(adFile.id);
    console.log('  ✓ Uploaded active_directory.json');
    
    // Upload HR Termination Report
    const hrData = await fs.readFile(path.join(dataDir, 'hr_termination_report.json'), 'utf8');
    const hrFile = await openai.files.create({
      file: new Blob([hrData], { type: 'application/json' }),
      purpose: 'assistants'
    });
    files.push(hrFile.id);
    console.log('  ✓ Uploaded hr_termination_report.json');
  } catch (error) {
    console.log('⚠️  Could not upload data files:', error.message);
  }
  
  // Create new assistant
  const assistantConfig = {
    name: config.name,
    instructions: config.instructions,
    model: config.model,
    temperature: config.temperature,
    tools: config.tools
  };
  
  if (files.length > 0) {
    assistantConfig.file_ids = files;
  }
  
  const assistant = await openai.beta.assistants.create(assistantConfig);
  
  // Save runtime configuration
  const runtimeConfig = {
    assistantId: assistant.id,
    createdAt: new Date().toISOString(),
    fileIds: files,
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