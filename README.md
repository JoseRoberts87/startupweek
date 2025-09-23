# OpenAI Assistant

A basic OpenAI-powered chat assistant with a clean web interface.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Add your OpenAI API key to the `.env` file:
```
OPENAI_API_KEY=your_actual_api_key_here
```

4. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

5. Open your browser to `http://localhost:3000`

## Features

- Clean, modern web interface
- Real-time chat with OpenAI's GPT-3.5-turbo
- Conversation history maintained during session
- Error handling for API issues
- Health check endpoint
- Responsive design

## API Endpoints

- `GET /` - Serves the web interface
- `POST /api/chat` - Send messages to the assistant
- `GET /api/health` - Check server status and API key configuration

## Environment Variables

- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `PORT` - Server port (default: 3000)

## Tech Stack

- Node.js with Express
- OpenAI SDK
- Vanilla JavaScript frontend
- Modern CSS with gradient design