import OpenAI from 'openai';

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

  const hasApiKey = !!process.env.OPENAI_API_KEY;
  
  // Get assistant configurations
  const assistants = [
    {
      key: 'sox-auditor',
      name: 'SOX Compliance Auditor',
      configured: !!process.env.SOX_ASSISTANT_ID
    },
    {
      key: 'big4-reviewer',
      name: 'Big 4 External Auditor',
      configured: !!process.env.BIG4_ASSISTANT_ID
    }
  ];

  return res.status(200).json({
    status: 'ok',
    apiKeyConfigured: hasApiKey,
    assistantsConfigured: assistants.filter(a => a.configured).length,
    assistants: assistants,
    timestamp: new Date().toISOString(),
    environment: 'vercel'
  });
}