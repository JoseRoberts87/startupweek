import OpenAI from 'openai';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function updateToSOXAssistant() {
  try {
    // Load existing config to get assistant ID
    const configData = await fs.readFile('./assistant-config.json', 'utf8');
    const config = JSON.parse(configData);
    
    console.log('🔄 Updating assistant to SOX Auditor...\n');
    console.log(`Current assistant: ${config.name} (${config.assistantId})\n`);
    
    const updatedAssistant = await openai.beta.assistants.update(config.assistantId, {
      name: "SOX Compliance Auditor",
      instructions: `You are a senior internal auditor specializing in SOX (Sarbanes-Oxley) compliance. 

CRITICAL REQUIREMENTS:
1. You must ONLY base findings on provided data
2. Never make assumptions or use information not explicitly provided
3. When asked to run a test, you MUST return a single JSON object with EXACTLY these keys:
   - workpaper_md: Markdown formatted workpaper documenting the test
   - results_json: JSON object containing test results and findings
   - control_conclusion: "Effective", "Ineffective", or "Partially Effective"
   - exception_rate: Numeric percentage (0-100)
   - notes: Additional observations or recommendations

4. Use the provided CSV content or other data as evidence
5. Be precise, objective, and thorough in your analysis
6. Follow standard audit procedures and documentation requirements
7. Maintain professional skepticism

OUTPUT FORMAT:
Always return test results as a properly formatted JSON object. Do not include any text before or after the JSON when running tests.`,
      model: "gpt-4-turbo-preview",
      temperature: 0.1,
      tools: [
        { type: 'code_interpreter' },
        { type: 'file_search' }
      ]
    });

    const updatedConfig = {
      assistantId: updatedAssistant.id,
      name: updatedAssistant.name,
      model: updatedAssistant.model,
      instructions: updatedAssistant.instructions,
      tools: updatedAssistant.tools,
      temperature: 0.1,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile('./assistant-config.json', JSON.stringify(updatedConfig, null, 2));
    
    console.log('✅ Assistant updated successfully!\n');
    console.log('📊 Updated Assistant Details:');
    console.log(`   ID: ${updatedAssistant.id}`);
    console.log(`   Name: ${updatedAssistant.name}`);
    console.log(`   Model: ${updatedAssistant.model}`);
    console.log(`   Temperature: 0.1`);
    console.log(`   Tools: ${updatedAssistant.tools.map(t => t.type).join(', ')}`);
    console.log(`\n💾 Configuration updated in: assistant-config.json`);
    console.log('\n⚠️  Please restart the server to use the updated assistant');
    console.log('   Run: npm run start:assistant');
    
    return updatedAssistant;
  } catch (error) {
    console.error('❌ Error updating assistant:', error.message);
    if (error.message.includes('No such assistant')) {
      console.error('\n⚠️  The assistant ID in the config file is invalid.');
      console.error('   Please run: node create-assistant.js to create a new one.');
    }
    process.exit(1);
  }
}

updateToSOXAssistant();