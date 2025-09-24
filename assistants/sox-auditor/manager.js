import { AssistantManager } from '../shared/base-assistant.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SOXAssistantManager extends AssistantManager {
  constructor(openai) {
    super(openai);
    this.dataLoaded = false;
    this.activeDirectoryData = null;
    this.hrTerminationData = null;
  }

  async loadDataFiles() {
    if (this.dataLoaded) return;
    
    try {
      // Load Active Directory data
      const adPath = path.join(__dirname, '../../data/active_directory.json');
      this.activeDirectoryData = JSON.parse(await fs.readFile(adPath, 'utf8'));
      
      // Load HR Termination Report
      const hrPath = path.join(__dirname, '../../data/hr_termination_report.json');
      this.hrTerminationData = JSON.parse(await fs.readFile(hrPath, 'utf8'));
      
      this.dataLoaded = true;
      console.log('✅ Loaded SOX audit data files');
    } catch (error) {
      console.error('⚠️  Could not load data files:', error.message);
    }
  }

  async sendMessage(assistantId, sessionId, message) {
    // Load data files if not already loaded
    await this.loadDataFiles();
    
    // For the SOX auditor, prepend the data context to the first message in a session
    const threadId = await this.getOrCreateThread(sessionId);
    
    // Check if this is the first message in the thread
    const existingMessages = await this.openai.beta.threads.messages.list(threadId);
    const isFirstMessage = existingMessages.data.length === 0;
    
    let enhancedMessage = message;
    
    // Extract user IDs from message
    const userIdPattern = /u\d{4}/gi;
    const matches = message.match(userIdPattern);
    const userIds = matches ? [...new Set(matches.map(id => id.toLowerCase()))] : [];
    
    // If it's the first message and we have data, filter and prepend it
    if (isFirstMessage && userIds.length > 0 && this.activeDirectoryData && this.hrTerminationData) {
      // Filter data to only requested users
      const filteredAD = {
        ...this.activeDirectoryData,
        users: this.activeDirectoryData.users.filter(user => 
          userIds.includes(user.user_id.toLowerCase())
        )
      };
      
      const filteredHR = {
        ...this.hrTerminationData,
        terminations: this.hrTerminationData.terminations.filter(term => 
          userIds.includes(term.user_id.toLowerCase())
        )
      };
      
      const dataContext = `
I need you to audit the following terminated users for SOX compliance.

The requirement is that user accounts must be disabled within 10 minutes of termination.

RELEVANT ACTIVE DIRECTORY DATA:
${JSON.stringify(filteredAD, null, 2)}

RELEVANT HR TERMINATION DATA:
${JSON.stringify(filteredHR, null, 2)}

USER REQUEST:
${message}

Please analyze if each user's account was disabled within 10 minutes of termination and provide a compliance report.`;
      
      enhancedMessage = dataContext;
      console.log(`📊 Filtered data to ${userIds.length} users for SOX audit`);
    }
    
    // Add user message to thread
    await this.openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: enhancedMessage
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
}