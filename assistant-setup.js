import OpenAI from 'openai';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import readline from 'readline';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

class AssistantManager {
  constructor() {
    this.configFile = './assistant-config.json';
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(this.configFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async saveConfig(config) {
    await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
  }

  async createAssistant() {
    console.log('\n🤖 Creating a new OpenAI Assistant...\n');

    const name = await question('Assistant name (e.g., "Customer Support Bot"): ');
    const instructions = await question('Instructions (describe the assistant\'s behavior): ');
    const model = await question('Model (gpt-4-turbo-preview, gpt-4, gpt-3.5-turbo) [gpt-3.5-turbo]: ') || 'gpt-3.5-turbo';
    
    console.log('\n📋 Available tools:');
    console.log('1. Code Interpreter - Run Python code and work with files');
    console.log('2. File Search - Search through uploaded documents');
    console.log('3. Function Calling - Call custom functions');
    
    const toolsInput = await question('\nSelect tools (comma-separated numbers, or press Enter for none): ');
    
    const tools = [];
    if (toolsInput.includes('1')) tools.push({ type: 'code_interpreter' });
    if (toolsInput.includes('2')) tools.push({ type: 'file_search' });

    try {
      console.log('\n⏳ Creating assistant...');
      
      const assistant = await openai.beta.assistants.create({
        name: name,
        instructions: instructions,
        model: model,
        tools: tools,
      });

      const config = {
        assistantId: assistant.id,
        name: assistant.name,
        model: assistant.model,
        instructions: assistant.instructions,
        tools: assistant.tools,
        createdAt: new Date().toISOString(),
      };

      await this.saveConfig(config);
      
      console.log('\n✅ Assistant created successfully!');
      console.log('\n📊 Assistant Details:');
      console.log(`   ID: ${assistant.id}`);
      console.log(`   Name: ${assistant.name}`);
      console.log(`   Model: ${assistant.model}`);
      console.log(`   Tools: ${tools.length > 0 ? tools.map(t => t.type).join(', ') : 'None'}`);
      console.log(`\n💾 Configuration saved to: ${this.configFile}`);
      
      return assistant;
    } catch (error) {
      console.error('\n❌ Error creating assistant:', error.message);
      throw error;
    }
  }

  async listAssistants() {
    try {
      console.log('\n📋 Fetching all assistants...\n');
      
      const assistants = await openai.beta.assistants.list({
        limit: 100,
      });

      if (assistants.data.length === 0) {
        console.log('No assistants found.');
        return;
      }

      console.log(`Found ${assistants.data.length} assistant(s):\n`);
      
      assistants.data.forEach((assistant, index) => {
        console.log(`${index + 1}. ${assistant.name || 'Unnamed Assistant'}`);
        console.log(`   ID: ${assistant.id}`);
        console.log(`   Model: ${assistant.model}`);
        console.log(`   Created: ${new Date(assistant.created_at * 1000).toLocaleString()}`);
        const tools = assistant.tools?.map(t => t.type).join(', ') || 'None';
        console.log(`   Tools: ${tools}`);
        console.log('');
      });
      
      return assistants.data;
    } catch (error) {
      console.error('❌ Error listing assistants:', error.message);
      throw error;
    }
  }

  async getAssistant(assistantId) {
    try {
      const assistant = await openai.beta.assistants.retrieve(assistantId);
      return assistant;
    } catch (error) {
      console.error('❌ Error retrieving assistant:', error.message);
      throw error;
    }
  }

  async updateAssistant(assistantId) {
    try {
      console.log('\n📝 Update Assistant (press Enter to keep current value)\n');
      
      const current = await this.getAssistant(assistantId);
      
      console.log(`Current name: ${current.name}`);
      const name = await question('New name: ') || current.name;
      
      console.log(`\nCurrent instructions: ${current.instructions}`);
      const instructions = await question('New instructions: ') || current.instructions;
      
      console.log(`\nCurrent model: ${current.model}`);
      const model = await question('New model: ') || current.model;

      const updated = await openai.beta.assistants.update(assistantId, {
        name: name,
        instructions: instructions,
        model: model,
      });

      console.log('\n✅ Assistant updated successfully!');
      
      const config = {
        assistantId: updated.id,
        name: updated.name,
        model: updated.model,
        instructions: updated.instructions,
        tools: updated.tools,
        updatedAt: new Date().toISOString(),
      };

      await this.saveConfig(config);
      
      return updated;
    } catch (error) {
      console.error('❌ Error updating assistant:', error.message);
      throw error;
    }
  }

  async deleteAssistant(assistantId) {
    try {
      const confirmation = await question(`\n⚠️  Are you sure you want to delete assistant ${assistantId}? (yes/no): `);
      
      if (confirmation.toLowerCase() !== 'yes') {
        console.log('Deletion cancelled.');
        return;
      }

      await openai.beta.assistants.del(assistantId);
      console.log('\n✅ Assistant deleted successfully!');
      
      const config = await this.loadConfig();
      if (config && config.assistantId === assistantId) {
        await fs.unlink(this.configFile).catch(() => {});
        console.log('📝 Local configuration removed.');
      }
    } catch (error) {
      console.error('❌ Error deleting assistant:', error.message);
      throw error;
    }
  }

  async useExistingAssistant() {
    const assistants = await this.listAssistants();
    
    if (!assistants || assistants.length === 0) {
      console.log('\nNo assistants found. Please create one first.');
      return null;
    }

    const selection = await question('\nEnter the number of the assistant to use (or 0 to cancel): ');
    const index = parseInt(selection) - 1;
    
    if (index < 0 || index >= assistants.length) {
      console.log('Invalid selection.');
      return null;
    }

    const selected = assistants[index];
    
    const config = {
      assistantId: selected.id,
      name: selected.name,
      model: selected.model,
      instructions: selected.instructions,
      tools: selected.tools,
      selectedAt: new Date().toISOString(),
    };

    await this.saveConfig(config);
    console.log(`\n✅ Selected assistant: ${selected.name}`);
    console.log(`💾 Configuration saved to: ${this.configFile}`);
    
    return selected;
  }
}

async function main() {
  console.log('🚀 OpenAI Assistant Setup Tool\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY not found in .env file');
    process.exit(1);
  }

  const manager = new AssistantManager();
  
  const existingConfig = await manager.loadConfig();
  if (existingConfig) {
    console.log(`📂 Found existing configuration for: ${existingConfig.name}`);
    console.log(`   Assistant ID: ${existingConfig.assistantId}\n`);
  }

  console.log('What would you like to do?\n');
  console.log('1. Create a new assistant');
  console.log('2. List all assistants');
  console.log('3. Use an existing assistant');
  console.log('4. Update current assistant');
  console.log('5. Delete an assistant');
  console.log('6. Exit');

  const choice = await question('\nEnter your choice (1-6): ');

  try {
    switch (choice) {
      case '1':
        await manager.createAssistant();
        break;
      
      case '2':
        await manager.listAssistants();
        break;
      
      case '3':
        await manager.useExistingAssistant();
        break;
      
      case '4':
        if (existingConfig) {
          await manager.updateAssistant(existingConfig.assistantId);
        } else {
          console.log('\n❌ No assistant configured. Please create or select one first.');
        }
        break;
      
      case '5':
        const assistants = await manager.listAssistants();
        if (assistants && assistants.length > 0) {
          const deleteChoice = await question('\nEnter the number of the assistant to delete (or 0 to cancel): ');
          const index = parseInt(deleteChoice) - 1;
          if (index >= 0 && index < assistants.length) {
            await manager.deleteAssistant(assistants[index].id);
          }
        }
        break;
      
      case '6':
        console.log('\n👋 Goodbye!');
        break;
      
      default:
        console.log('\n❌ Invalid choice');
    }
  } catch (error) {
    console.error('\n❌ An error occurred:', error.message);
  }

  rl.close();
}

main().catch(console.error);