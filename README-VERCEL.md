# OpenAI Assistants Hub - Vercel Deployment

A serverless OpenAI Assistants application featuring SOX Compliance Auditor and Big 4 External Reviewer assistants.

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/clairvoyant-reviewer)

## 📋 Prerequisites

1. OpenAI API Key from [platform.openai.com](https://platform.openai.com)
2. Assistant IDs (created via OpenAI dashboard or setup scripts)
3. Vercel account (free tier works)

## 🛠️ Setup Instructions

### Step 1: Create OpenAI Assistants

You have two options:

#### Option A: Use Setup Scripts (Recommended)
```bash
# Clone the repository
git clone <your-repo-url>
cd clairvoyant-reviewer

# Install dependencies
npm install

# Set up your OpenAI API key
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Create assistants
npm run setup:sox    # Creates SOX Auditor
npm run setup:big4   # Creates Big 4 Reviewer

# Note the assistant IDs from the output
```

#### Option B: Manual Creation via OpenAI Dashboard
1. Go to [platform.openai.com/assistants](https://platform.openai.com/assistants)
2. Create two assistants with the configurations from:
   - `assistants/sox-auditor/config.json`
   - `assistants/big4-reviewer/config.json`
3. Note the assistant IDs

### Step 2: Deploy to Vercel

#### Via Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts and set environment variables when asked
```

#### Via Vercel Dashboard
1. Fork/clone this repository to your GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Add environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `SOX_ASSISTANT_ID`: SOX Auditor assistant ID
   - `BIG4_ASSISTANT_ID`: Big 4 Reviewer assistant ID
5. Click Deploy

### Step 3: Configure Environment Variables

In Vercel Dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add:
```
OPENAI_API_KEY=sk-...
SOX_ASSISTANT_ID=asst_...
BIG4_ASSISTANT_ID=asst_...
```

## 🏗️ Project Structure

```
/
├── api/                    # Vercel serverless functions
│   ├── health.js          # Health check endpoint
│   └── assistants/
│       ├── list.js        # List available assistants
│       ├── sox-chat.js    # SOX Auditor chat endpoint
│       └── big4-chat.js   # Big 4 Reviewer chat endpoint
├── public/                # Static files
│   ├── index.html        # Assistant selector hub
│   ├── sox-auditor.html  # SOX Auditor UI
│   └── big4-reviewer.html # Big 4 Reviewer UI
├── assistants/           # Assistant configurations
│   ├── sox-auditor/
│   └── big4-reviewer/
└── vercel.json          # Vercel configuration
```

## 🔌 API Endpoints

All endpoints are serverless functions:

- `GET /api/health` - Health check and status
- `GET /api/assistants/list` - List configured assistants
- `POST /api/assistants/sox-chat` - Chat with SOX Auditor
- `POST /api/assistants/big4-chat` - Chat with Big 4 Reviewer

## 🎯 Features

### SOX Compliance Auditor
- Tests SOX controls
- Analyzes CSV data
- Returns structured JSON with:
  - Workpaper documentation
  - Test results
  - Control conclusions
  - Exception rates
  - Remediation notes

### Big 4 External Reviewer
- Reviews SOX workpapers
- Applies professional skepticism
- Returns structured JSON with:
  - Review comments
  - Identified issues array
  - Overall risk assessment
  - Specific remediation recommendations

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Run with Vercel CLI
vercel dev

# Or run the Express version
npm run start:legacy
```

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |
| `SOX_ASSISTANT_ID` | SOX Auditor assistant ID | Yes |
| `BIG4_ASSISTANT_ID` | Big 4 Reviewer assistant ID | Yes |

## 🔒 Security Notes

- Never commit `.env` files
- Use Vercel's environment variables for production
- API keys are never exposed to the client
- All API calls are made server-side

## 💰 Cost Considerations

- OpenAI API usage charges apply
- Vercel free tier includes:
  - 100GB bandwidth/month
  - Serverless function execution time
- Consider setting up usage limits in OpenAI dashboard

## 🐛 Troubleshooting

### "Assistant not configured"
- Ensure environment variables are set correctly
- Check assistant IDs match your OpenAI dashboard

### "API key not configured"
- Verify OPENAI_API_KEY is set in Vercel environment variables
- Ensure the key is valid and has credits

### Timeout errors
- Vercel functions have a 10-second timeout on free tier
- Consider upgrading for longer timeouts (up to 60s on Pro)

## 📚 Resources

- [OpenAI Assistants API Docs](https://platform.openai.com/docs/assistants)
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)

## 📄 License

MIT