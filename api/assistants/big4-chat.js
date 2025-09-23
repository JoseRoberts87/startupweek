import OpenAI from 'openai';

// Store threads in memory (Note: In production, use a database)
const threads = new Map();

async function waitForRun(openai, threadId, runId) {
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

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, sessionId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  if (!process.env.BIG4_ASSISTANT_ID) {
    return res.status(500).json({ error: 'Big 4 Assistant ID not configured' });
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Get or create thread
    let threadId = threads.get(sessionId);
    
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      threads.set(sessionId, threadId);
    }

    // Add message to thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.BIG4_ASSISTANT_ID
    });

    // Wait for completion
    await waitForRun(openai, threadId, run.id);

    // Get the response
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

    return res.status(200).json({
      response: responseText,
      threadId: threadId,
      runId: run.id,
      assistantName: 'Big 4 External Auditor'
    });

  } catch (error) {
    console.error('Error in Big 4 assistant chat:', error);
    
    if (error.status === 401) {
      return res.status(401).json({ error: 'Invalid API key' });
    } else if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    } else {
      return res.status(500).json({ error: error.message || 'An error occurred while processing your request' });
    }
  }
}