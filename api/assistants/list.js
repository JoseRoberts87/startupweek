export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const assistants = [];

  // Add SOX Auditor if configured
  if (process.env.SOX_ASSISTANT_ID) {
    assistants.push({
      key: 'sox-auditor',
      name: 'SOX Compliance Auditor',
      description: 'Senior internal auditor specializing in SOX compliance and control testing',
      model: 'gpt-4-turbo-preview',
      assistantId: process.env.SOX_ASSISTANT_ID,
      endpoints: {
        chat: '/api/assistants/sox-chat',
        health: '/api/assistants/sox-health'
      }
    });
  }

  // Add Big 4 Reviewer if configured
  if (process.env.BIG4_ASSISTANT_ID) {
    assistants.push({
      key: 'big4-reviewer',
      name: 'Big 4 External Auditor',
      description: 'Big 4 external auditor specializing in SOX workpaper review and risk assessment',
      model: 'gpt-4-turbo-preview',
      assistantId: process.env.BIG4_ASSISTANT_ID,
      endpoints: {
        chat: '/api/assistants/big4-chat',
        health: '/api/assistants/big4-health'
      }
    });
  }

  return res.status(200).json({ assistants });
}