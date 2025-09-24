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
    
    // If it's the first message and we have data, prepend it
    if (isFirstMessage && this.activeDirectoryData && this.hrTerminationData) {
      const dataContext = `
Here is the data for the audit:

ACTIVE DIRECTORY DATA:
${JSON.stringify(this.activeDirectoryData, null, 2)}

HR TERMINATION REPORT:
${JSON.stringify(this.hrTerminationData, null, 2)}

USER REQUEST:
${message}`;
      
      enhancedMessage = dataContext;
      console.log('📊 Added data context to SOX auditor message');
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