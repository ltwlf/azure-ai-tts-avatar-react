# Azure AI TTS Avatar React Demo

This project demonstrates the integration of Azure AI Foundry with Azure OpenAI and Azure Text-to-Speech Avatar services to create an interactive virtual assistant.

## Features

- Interactive avatar using Azure TTS Avatar API
- Conversational AI powered by Azure AI Foundry
- Voice recognition for hands-free interaction
- Customizable system prompt
- Modern UI using Fluent UI components

## Prerequisites

- **Azure AI Foundry** (unified AI Services resource) with:
  - Azure OpenAI model deployment (GPT-4o or similar)
  - Speech Services with Avatar support enabled
  - Note: A single Azure AI Services resource provides both OpenAI and Speech capabilities
- **Node.js** version 18 or later (recommended)
- **npm** version 8 or later
- **Modern web browser** with microphone access (Chrome, Edge, or Safari recommended)

## Setup

1. Clone this repository:

   ```bash
   git clone https://github.com/ltwlf/azure-ai-tts-avatar-react.git
   cd azure-ai-tts-avatar-react
   ```

1. Install dependencies:

   ```bash
   npm install
   ```

1. Create a `.env` file in the root directory with your Azure credentials:

   ```env
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

1. Open [http://localhost:3000](http://localhost:3000) in your browser.

1. Click "Start Avatar" to initialize the services.

1. Speak into your microphone to interact with the avatar.

> **Note**: Your browser will prompt you to allow microphone access. This is required for voice interaction with the avatar.

## Important Notes

### Regional Availability

Azure TTS Avatar is available in specific regions. Supported regions include:

- Sweden Central
- West Europe
- East US
- West US

Ensure your Azure AI Services resource is deployed in a supported region.

### Security Considerations

⚠️ **Development vs Production**:

- This demo uses `dangerouslyAllowBrowser: true` for the OpenAI client, which exposes API keys in the browser
- **For production**, implement a backend proxy to handle API calls securely
- Never commit your `.env` file or expose API keys in client-side code
- Consider using Azure Managed Identity or other secure authentication methods for production

## Building for Production

```bash
npm run build
```

This builds the app for production to the `build` folder with:

- Code optimization and minification
- Source maps disabled for security
- JavaScript obfuscation applied

⚠️ **Important**: The production build still contains client-side API calls. For a secure production deployment, implement a backend API proxy.

## Customization

### Avatar Settings

You can customize the avatar character and style by modifying the environment variables in your `.env` file:

```env
REACT_APP_AVATAR_CHARACTER=lisa  # Available options may include: lisa, guy, etc.
REACT_APP_AVATAR_STYLE=casual-sitting  # Available styles vary by character
```

### System Prompt

You can customize the avatar's personality and capabilities by modifying the system prompt in the settings drawer (accessible via the settings icon in the top right corner).

## Troubleshooting

### Common Issues

#### "throwIfNullOrWhitespace: subscriptionKey" error

- Ensure your `.env` file exists and contains valid Azure credentials
- Restart the development server after creating/modifying `.env` file

#### Avatar not appearing

- Check that your Azure region supports TTS Avatar (see Regional Availability)
- Verify your Speech Services resource has Avatar features enabled
- Check browser console for WebRTC connection errors

#### Microphone not working

- Ensure browser has microphone permissions enabled
- Check that no other application is using the microphone
- Try a different browser (Chrome or Edge recommended)

#### OpenAI/Speech API errors

- Verify your API keys are correct and not expired
- Check that your deployment name matches your Azure OpenAI deployment
- Ensure your Azure subscription has sufficient quota

## Technology Stack

- **React** 18.2 with TypeScript
- **Azure Speech SDK** 1.46.0 (latest)
- **Azure OpenAI SDK** 4.86.2
- **Fluent UI** 9.x for modern UI components
- **WebRTC** for real-time avatar streaming

## License

[MIT](https://choosealicense.com/licenses/mit/)
