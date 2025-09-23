import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let assistantConfig = null;
const threads = new Map();

async function loadAssistantConfig() {
  try {
    const data = await fs.readFile('./assistant-config.json', 'utf8');
    assistantConfig = JSON.parse(data);
    console.log(`📂 Loaded assistant: ${assistantConfig.name} (${assistantConfig.assistantId})`);
    return assistantConfig;
  } catch (error) {
    console.log('⚠️  No assistant configuration found. Run assistant-setup.js to create one.');
    return null;
  }
}

async function waitForRun(threadId, runId) {
  let run;
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    run = await openai.beta.threads.runs.retrieve(threadId, runId);
    
    if (run.status === 'completed') {
      return run;
    } else if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
      throw new Error(`Run ${run.status}: ${run.last_error?.message || 'Unknown error'}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  throw new Error('Run timeout - took too long to complete');
}

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'assistant.html'));
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    if (!assistantConfig) {
      return res.status(500).json({ error: 'No assistant configured. Run: node assistant-setup.js' });
    }

    let threadId = threads.get(sessionId);
    
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      threads.set(sessionId, threadId);
      console.log(`🧵 Created new thread: ${threadId} for session: ${sessionId}`);
    }

    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message
    });

    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantConfig.assistantId
    });

    console.log(`🏃 Started run: ${run.id} for thread: ${threadId}`);

    const completedRun = await waitForRun(threadId, run.id);

    const messages = await openai.beta.threads.messages.list(threadId);
    const lastMessage = messages.data[0];

    let responseText = '';
    if (lastMessage.role === 'assistant') {
      for (const content of lastMessage.content) {
        if (content.type === 'text') {
          responseText += content.text.value;
        }
      }
    }

    res.json({ 
      response: responseText,
      threadId: threadId,
      runId: run.id,
      assistantName: assistantConfig.name
    });
  } catch (error) {
    console.error('Error in assistant chat:', error);
    
    if (error.status === 401) {
      res.status(401).json({ error: 'Invalid API key' });
    } else if (error.status === 429) {
      res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    } else {
      res.status(500).json({ error: error.message || 'An error occurred while processing your request' });
    }
  }
});

app.post('/api/threads/new', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const thread = await openai.beta.threads.create();
    threads.set(sessionId, thread.id);
    
    console.log(`🧵 Created new thread: ${thread.id} for session: ${sessionId}`);
    
    res.json({ 
      threadId: thread.id,
      sessionId: sessionId
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: 'Failed to create new thread' });
  }
});

app.get('/api/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    
    const messages = await openai.beta.threads.messages.list(threadId, {
      limit: 100
    });

    const formattedMessages = messages.data.reverse().map(msg => {
      let content = '';
      for (const c of msg.content) {
        if (c.type === 'text') {
          content += c.text.value;
        }
      }
      return {
        role: msg.role,
        content: content,
        createdAt: msg.created_at
      };
    });

    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/health', (req, res) => {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const hasAssistant = !!assistantConfig;
  
  res.json({ 
    status: 'ok',
    apiKeyConfigured: hasApiKey,
    assistantConfigured: hasAssistant,
    assistantName: assistantConfig?.name || null,
    assistantId: assistantConfig?.assistantId || null,
    activeThreads: threads.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/assistant/info', (req, res) => {
  if (!assistantConfig) {
    return res.status(404).json({ error: 'No assistant configured' });
  }
  
  res.json({
    id: assistantConfig.assistantId,
    name: assistantConfig.name,
    model: assistantConfig.model,
    instructions: assistantConfig.instructions,
    tools: assistantConfig.tools || []
  });
});

async function startServer() {
  await loadAssistantConfig();
  
  app.listen(port, () => {
    console.log(`\n🚀 Assistant Server running at http://localhost:${port}`);
    console.log(`📊 Status:`);
    console.log(`   API Key: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   Assistant: ${assistantConfig ? `✅ ${assistantConfig.name}` : '❌ Not configured'}`);
    
    if (!assistantConfig) {
      console.log(`\n⚠️  To configure an assistant, run: node assistant-setup.js`);
    }
  });
}

startServer().catch(console.error);