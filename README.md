# Azure TTS Avatar Demo

This project demonstrates the integration of Azure OpenAI with Azure Text-to-Speech Avatar services to create an interactive virtual assistant.

## Features

- Interactive avatar using Azure TTS Avatar API
- Conversational AI powered by Azure OpenAI
- Voice recognition for hands-free interaction
- Customizable system prompt
- Modern UI using Fluent UI components

## Prerequisites

- Azure OpenAI subscription with a GPT-4 or similar model deployment
- Azure Speech Services subscription with Avatar support
- Node.js (version 16 or later recommended)
- npm (version 8 or later recommended)

## Setup

1. Clone this repository:
```bash
git clone https://github.com/yourusername/azure-tts-avatar.git
cd azure-tts-avatar
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Azure credentials:
```
# Azure OpenAI Configuration
REACT_APP_AZURE_OPENAI_ENDPOINT=your-azure-openai-endpoint
REACT_APP_AZURE_OPENAI_KEY=your-azure-openai-key
REACT_APP_AZURE_OPENAI_DEPLOYMENT=your-deployment-name
REACT_APP_AZURE_API_VERSION=2025-01-01-preview

# Azure Speech + Avatar Configuration
REACT_APP_AZURE_SPEECH_KEY=your-speech-key
REACT_APP_AZURE_SPEECH_REGION=your-speech-region
REACT_APP_AVATAR_CHARACTER=lisa
REACT_APP_AVATAR_STYLE=casual-sitting
```

> **Important**: Never commit your `.env` file or expose your API keys in your code.

## Running the Application

1. Start the development server:
```bash
npm start
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser.

3. Click "Start Avatar" to initialize the services.

4. Speak into your microphone to interact with the avatar.

## Building for Production

```bash
npm run build
```

This builds the app for production to the `build` folder, optimized for performance.

## Customization

### Avatar Settings

You can customize the avatar character and style by modifying the environment variables in your `.env` file:

```
REACT_APP_AVATAR_CHARACTER=lisa  # Available options may include: lisa, guy, etc.
REACT_APP_AVATAR_STYLE=casual-sitting  # Available styles vary by character
```

### System Prompt

You can customize the avatar's personality and capabilities by modifying the system prompt in the settings drawer (accessible via the settings icon in the top right corner).

## License

[MIT](https://choosealicense.com/licenses/mit/)// Final docs update
// Final docs update
