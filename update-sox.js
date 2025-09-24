import OpenAI from 'openai';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function updateSOXAssistant() {
  try {
    console.log('🔄 Updating SOX assistant with new instructions...');
    
    // Read the current config
    const config = JSON.parse(await fs.readFile('./assistants/sox-auditor/config.json', 'utf8'));
    const runtime = JSON.parse(await fs.readFile('./assistants/sox-auditor/runtime.json', 'utf8'));
    
    // Upload data files
    console.log('📁 Uploading data files...');
    const files = [];
    
    try {
      // Upload Active Directory data
      const adData = await fs.readFile('./data/active_directory.json', 'utf8');
      const adFile = await openai.files.create({
        file: new Blob([adData], { type: 'application/json' }),
        purpose: 'assistants'
      });
      files.push(adFile.id);
      console.log('  ✓ Uploaded active_directory.json');
      
      // Upload HR Termination Report
      const hrData = await fs.readFile('./data/hr_termination_report.json', 'utf8');
      const hrFile = await openai.files.create({
        file: new Blob([hrData], { type: 'application/json' }),
        purpose: 'assistants'
      });
      files.push(hrFile.id);
      console.log('  ✓ Uploaded hr_termination_report.json');
    } catch (error) {
      console.log('⚠️  Could not upload data files:', error.message);
    }
    
    // Update the assistant with new instructions
    const updatedAssistant = await openai.beta.assistants.update(
      runtime.assistantId,
      {
        instructions: config.instructions,
        file_ids: files
      }
    );
    
    // Update runtime.json with new instructions and file IDs
    const updatedRuntime = {
      ...runtime,
      instructions: config.instructions,
      fileIds: files,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(
      './assistants/sox-auditor/runtime.json',
      JSON.stringify(updatedRuntime, null, 2)
    );
    
    console.log('✅ Successfully updated SOX assistant!');
    console.log(`   Assistant ID: ${updatedAssistant.id}`);
    console.log(`   Files attached: ${files.length}`);
    
  } catch (error) {
    console.error('❌ Error updating assistant:', error.message);
    process.exit(1);
  }
}

updateSOXAssistant();