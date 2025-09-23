import OpenAI from 'openai';

export class AssistantManager {
  constructor(openai) {
    this.openai = openai;
    this.threads = new Map();
  }

  async createThread(sessionId) {
    const thread = await this.openai.beta.threads.create();
    this.threads.set(sessionId, thread.id);
    return thread.id;
  }

  async getOrCreateThread(sessionId) {
    let threadId = this.threads.get(sessionId);
    
    if (!threadId) {
      threadId = await this.createThread(sessionId);
      console.log(`🧵 Created new thread: ${threadId} for session: ${sessionId}`);
    }
    
    return threadId;
  }

  async sendMessage(assistantId, sessionId, message) {
    const threadId = await this.getOrCreateThread(sessionId);
    
    // Add user message to thread
    await this.openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: message
    });

    // Run the assistant
    const run = await this.openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId
    });

    console.log(`🏃 Started run: ${run.id} for thread: ${threadId}`);

    // Wait for completion
    const completedRun = await this.waitForRun(threadId, run.id);

    // Get the response
    const messages = await this.openai.beta.threads.messages.list(threadId);
    const lastMessage = messages.data[0];

    let responseText = '';
    if (lastMessage.role === 'assistant') {
      for (const content of lastMessage.content) {
        if (content.type === 'text') {
          responseText += content.text.value;
        }
      }
    }

    return {
      response: responseText,
      threadId: threadId,
      runId: run.id
    };
  }

  async waitForRun(threadId, runId) {
    let run;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      run = await this.openai.beta.threads.runs.retrieve(threadId, runId);
      
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

  async getThreadMessages(threadId, limit = 100) {
    const messages = await this.openai.beta.threads.messages.list(threadId, {
      limit: limit
    });

    return messages.data.reverse().map(msg => {
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
  }

  clearThread(sessionId) {
    return this.threads.delete(sessionId);
  }

  getActiveThreadCount() {
    return this.threads.size;
  }
}