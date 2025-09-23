import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AssistantRegistry {
  constructor() {
    this.assistants = new Map();
    this.configs = new Map();
  }

  async loadAssistant(name, setupFunction, openai) {
    try {
      const assistant = await setupFunction(openai);
      this.assistants.set(name, assistant);
      
      // Load config
      const configPath = path.join(__dirname, '..', name, 'config.json');
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      this.configs.set(name, config);
      
      console.log(`📦 Loaded assistant: ${name} - ${config.name}`);
      return assistant;
    } catch (error) {
      console.error(`❌ Failed to load assistant ${name}:`, error.message);
      throw error;
    }
  }

  getAssistant(name) {
    return this.assistants.get(name);
  }

  getConfig(name) {
    return this.configs.get(name);
  }

  listAssistants() {
    return Array.from(this.configs.entries()).map(([key, config]) => ({
      key,
      name: config.name,
      description: config.description,
      model: config.model,
      endpoints: config.endpoints
    }));
  }

  getAssistantByEndpoint(endpoint) {
    for (const [key, config] of this.configs.entries()) {
      if (config.endpoints) {
        const baseEndpoint = config.endpoints.base;
        if (endpoint.startsWith(baseEndpoint)) {
          return {
            key,
            assistant: this.assistants.get(key),
            config: config
          };
        }
      }
    }
    return null;
  }
}