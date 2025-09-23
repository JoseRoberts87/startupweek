import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AssistantManager } from '../../assistants/shared/base-assistant.js';
import { AssistantRegistry } from '../../assistants/shared/assistant-registry.js';
import { setupSOXAssistant } from '../../assistants/sox-auditor/setup.js';
import { setupBig4Assistant } from '../../assistants/big4-reviewer/setup.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../../public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const registry = new AssistantRegistry();
const managers = new Map();

// Initialize assistants
async function initializeAssistants() {
  console.log('\n🚀 Initializing Multi-Assistant Server...\n');
  
  try {
    // Load SOX Auditor
    await registry.loadAssistant('sox-auditor', setupSOXAssistant, openai);
    managers.set('sox-auditor', new AssistantManager(openai));
    
    // Load Big 4 External Reviewer
    await registry.loadAssistant('big4-reviewer', setupBig4Assistant, openai);
    managers.set('big4-reviewer', new AssistantManager(openai));
    
    // Add more assistants here as needed
    
    console.log('\n✅ All assistants loaded successfully!\n');
  } catch (error) {
    console.error('❌ Failed to initialize assistants:', error);
    process.exit(1);
  }
}

// Root endpoint - assistant selector
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../../public/assistant-selector.html'));
});

// List all available assistants
app.get('/api/assistants', (req, res) => {
  const assistants = registry.listAssistants();
  res.json({ assistants });
});

// Get specific assistant info
app.get('/api/assistants/:name/info', (req, res) => {
  const { name } = req.params;
  const config = registry.getConfig(name);
  const assistant = registry.getAssistant(name);
  
  if (!config || !assistant) {
    return res.status(404).json({ error: 'Assistant not found' });
  }
  
  res.json({
    id: assistant.id,
    name: config.name,
    description: config.description,
    model: config.model,
    temperature: config.temperature,
    tools: config.tools || [],
    endpoints: config.endpoints
  });
});

// Assistant-specific chat endpoint
app.post('/api/assistants/:name/chat', async (req, res) => {
  const { name } = req.params;
  const { message, sessionId } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  const assistant = registry.getAssistant(name);
  const config = registry.getConfig(name);
  const manager = managers.get(name);
  
  if (!assistant || !manager) {
    return res.status(404).json({ error: 'Assistant not found' });
  }
  
  try {
    const result = await manager.sendMessage(assistant.id, sessionId, message);
    
    res.json({
      ...result,
      assistantName: config.name
    });
  } catch (error) {
    console.error(`Error in ${name} chat:`, error);
    
    if (error.status === 401) {
      res.status(401).json({ error: 'Invalid API key' });
    } else if (error.status === 429) {
      res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    } else {
      res.status(500).json({ error: error.message || 'An error occurred while processing your request' });
    }
  }
});

// Assistant-specific health endpoint
app.get('/api/assistants/:name/health', (req, res) => {
  const { name } = req.params;
  const assistant = registry.getAssistant(name);
  const config = registry.getConfig(name);
  const manager = managers.get(name);
  
  if (!assistant || !manager) {
    return res.status(404).json({ error: 'Assistant not found' });
  }
  
  res.json({
    status: 'ok',
    assistantName: config.name,
    assistantId: assistant.id,
    model: config.model,
    activeThreads: manager.getActiveThreadCount(),
    timestamp: new Date().toISOString()
  });
});

// Create new thread for an assistant
app.post('/api/assistants/:name/threads/new', async (req, res) => {
  const { name } = req.params;
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }
  
  const manager = managers.get(name);
  
  if (!manager) {
    return res.status(404).json({ error: 'Assistant not found' });
  }
  
  try {
    const threadId = await manager.createThread(sessionId);
    
    res.json({
      threadId,
      sessionId
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: 'Failed to create new thread' });
  }
});

// Get thread messages
app.get('/api/assistants/:name/threads/:threadId/messages', async (req, res) => {
  const { name, threadId } = req.params;
  const manager = managers.get(name);
  
  if (!manager) {
    return res.status(404).json({ error: 'Assistant not found' });
  }
  
  try {
    const messages = await manager.getThreadMessages(threadId);
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Global health check
app.get('/api/health', (req, res) => {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const assistantList = registry.listAssistants();
  
  res.json({
    status: 'ok',
    apiKeyConfigured: hasApiKey,
    assistantsLoaded: assistantList.length,
    assistants: assistantList.map(a => ({
      key: a.key,
      name: a.name,
      activeThreads: managers.get(a.key)?.getActiveThreadCount() || 0
    })),
    timestamp: new Date().toISOString()
  });
});

// Serve assistant-specific UI
app.get('/assistant/:name', (req, res) => {
  const { name } = req.params;
  const config = registry.getConfig(name);
  
  if (!config) {
    return res.status(404).send('Assistant not found');
  }
  
  // Serve a specific UI file if it exists, otherwise use generic
  res.sendFile(join(__dirname, '../../public/assistants/assistant-ui.html'));
});

async function startServer() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY not found in .env file');
    process.exit(1);
  }
  
  await initializeAssistants();
  
  app.listen(port, () => {
    console.log(`📡 Multi-Assistant Server running at http://localhost:${port}`);
    console.log(`📊 API Key: ✅ Configured`);
    console.log(`🤖 Assistants: ${registry.listAssistants().length} loaded`);
    
    registry.listAssistants().forEach(assistant => {
      console.log(`   - ${assistant.name} (${assistant.key})`);
      console.log(`     Endpoints: ${assistant.endpoints.chat}`);
    });
    
    console.log(`\n🌐 Web Interface: http://localhost:${port}`);
  });
}

startServer().catch(console.error);