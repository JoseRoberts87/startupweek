import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';

// Store threads in memory (Note: In production, use a database)
const threads = new Map();

// Load data files
async function loadDataFiles() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    
    // Load Active Directory data
    const adData = JSON.parse(await fs.readFile(path.join(dataDir, 'active_directory.json'), 'utf8'));
    
    // Load HR Termination Report
    const hrData = JSON.parse(await fs.readFile(path.join(dataDir, 'hr_termination_report.json'), 'utf8'));
    
    return { adData, hrData };
  } catch (error) {
    console.error('Could not load data files:', error);
    return { adData: null, hrData: null };
  }
}

// Extract user IDs from message
function extractUserIds(message) {
  // Match patterns like u1001, u1002, etc.
  const userIdPattern = /u\d{4}/gi;
  const matches = message.match(userIdPattern);
  return matches ? [...new Set(matches.map(id => id.toLowerCase()))] : [];
}

// Filter data to only relevant users
function filterDataForUsers(adData, hrData, userIds) {
  if (!adData || !hrData || userIds.length === 0) {
    return { filteredAD: null, filteredHR: null };
  }
  
  const filteredAD = {
    ...adData,
    users: adData.users.filter(user => userIds.includes(user.user_id.toLowerCase()))
  };
  
  const filteredHR = {
    ...hrData,
    terminations: hrData.terminations.filter(term => userIds.includes(term.user_id.toLowerCase()))
  };
  
  return { filteredAD, filteredHR };
}

async function waitForRun(openai, threadId, runId) {
  let run;
  let attempts = 0;
  const maxAttempts = 55;  // Set to 55 seconds to be safe with 60 second Vercel timeout

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

  if (!process.env.SOX_ASSISTANT_ID) {
    return res.status(500).json({ error: 'SOX Assistant ID not configured' });
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
    
    // Extract user IDs from the message
    const userIds = extractUserIds(message);
    
    // Check if this is the first message in the thread
    const existingMessages = await openai.beta.threads.messages.list(threadId);
    const isFirstMessage = existingMessages.data.length === 0;
    
    let enhancedMessage = message;
    
    // If it's the first message and we found user IDs, load and filter data
    if (isFirstMessage && userIds.length > 0) {
      const { adData, hrData } = await loadDataFiles();
      
      if (adData && hrData) {
        // Filter data to only include requested users
        const { filteredAD, filteredHR } = filterDataForUsers(adData, hrData, userIds);
        
        if (filteredAD && filteredHR) {
          // Create a simplified data context
          enhancedMessage = `
I need you to audit the following terminated users for SOX compliance.

The requirement is that user accounts must be disabled within 10 minutes of termination.

RELEVANT ACTIVE DIRECTORY DATA:
${JSON.stringify(filteredAD, null, 2)}

RELEVANT HR TERMINATION DATA:
${JSON.stringify(filteredHR, null, 2)}

USER REQUEST:
${message}

Please analyze if each user's account was disabled within 10 minutes of termination and provide a compliance report.`;
          
          console.log(`Filtered data to ${userIds.length} users for SOX audit`);
        }
      }
    }

    // Add message to thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: enhancedMessage
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.SOX_ASSISTANT_ID
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
      assistantName: 'SOX Compliance Auditor'
    });

  } catch (error) {
    console.error('Error in SOX assistant chat:', error);
    
    if (error.status === 401) {
      return res.status(401).json({ error: 'Invalid API key' });
    } else if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    } else {
      return res.status(500).json({ error: error.message || 'An error occurred while processing your request' });
    }
  }
}