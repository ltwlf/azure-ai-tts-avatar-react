import { useRef, useState } from 'react';
import './App.css';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

// 1) Import from openai v4
import { AzureOpenAI } from 'openai';

// Fluent UI imports
import {
  FluentProvider, 
  webLightTheme,
  Button,
  Drawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  Field,
  Textarea,
  Spinner,
  makeStyles,
  tokens,
  Text
} from '@fluentui/react-components';

// Import Fluent UI icon
import { Settings24Regular } from '@fluentui/react-icons';

// Define ChatMessage type
type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// --------------------
// Azure OpenAI Config
// --------------------
const azureOpenAIEndpoint = process.env.REACT_APP_AZURE_OPENAI_ENDPOINT || "";
const azureOpenAIKey = process.env.REACT_APP_AZURE_OPENAI_KEY || "";
const deploymentName = process.env.REACT_APP_AZURE_OPENAI_DEPLOYMENT || "gpt-4o";
const azureAPIVersion = process.env.REACT_APP_AZURE_API_VERSION || "2025-01-01-preview";    

// --------------------
// Azure Speech + Avatar
// --------------------
const speechKey = process.env.REACT_APP_AZURE_SPEECH_KEY || "";
const speechRegion = process.env.REACT_APP_AZURE_SPEECH_REGION || "westeurope";
const avatarCharacter = process.env.REACT_APP_AVATAR_CHARACTER || "lisa";
const avatarStyle = process.env.REACT_APP_AVATAR_STYLE || "casual-sitting";

// Custom styles for components
const useStyles = makeStyles({
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    padding: '0 20px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    height: '36px',
    marginRight: '20px',
  },
  toolbar: {
    display: 'flex',
    marginLeft: 'auto',
  },
  settingsIcon: {
    color: 'white',
    cursor: 'pointer',
    marginLeft: 'auto',
    padding: '8px',
  },
  avatarContainer: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarVideo: {
    maxHeight: '80vh',
    maxWidth: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  startButton: {
    marginTop: '20px',
  },
  systemPromptTextarea: {
    minHeight: '200px',
  }
});

function App() {
  const styles = useStyles();
  const [isLoading, setIsLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Refs to hold Speech & Avatar objects
  const speechConfigRef = useRef<SpeechSDK.SpeechConfig>();
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer>();
  const avatarSynthesizerRef = useRef<SpeechSDK.AvatarSynthesizer>();

  // 2) The new AzureOpenAI client from openai v4
  const openAIRef = useRef<AzureOpenAI>();

  // Video/audio for real-time avatar
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Chat message array
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "system",
      content:
        "I'm Holly, your helpful virtual assistant. I'm designed to provide information, answer questions, and assist with various tasks in a clear and friendly manner. I'll respond conversationally while maintaining a professional tone. I'll ask clarifying questions when needed to better understand your requests."
    }
  ]);

  // State for system message editing
  const [systemMessage, setSystemMessage] = useState(messages[0].content);

  // Helper to update system message
  const updateSystemMessage = () => {
    const updatedMessages = [...messages];
    updatedMessages[0] = { ...updatedMessages[0], content: systemMessage };
    setMessages(updatedMessages);
    setIsSettingsOpen(false);
  };

  // -----------------------------
  // START APP: Initialize Avatar + OpenAI
  // -----------------------------
  const startApp = async () => {
    setIsLoading(true);

    // 1) Setup Speech for avatar
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechSynthesisLanguage = "en-US";
    speechConfig.speechSynthesisVoiceName = "en-US-JennyNeural";
    speechConfigRef.current = speechConfig;

    // 2) Avatar config
    const avatarConfig = new SpeechSDK.AvatarConfig(
      avatarCharacter,
      avatarStyle,
      new SpeechSDK.AvatarVideoFormat("H264")
    );

    // 3) Fetch ICE from TTS endpoint
    try {
      // Make sure we have the required keys
      if (!speechKey || !speechRegion) {
        console.error("Missing Azure Speech configuration. Please check your environment variables.");
        setIsLoading(false);
        return;
      }
      
      const iceResponse = await fetch(
        `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`,
        {
          method: 'GET',
          headers: { 'Ocp-Apim-Subscription-Key': speechKey }
        }
      );
      if (!iceResponse.ok) {
        throw new Error("Failed to fetch ICE config from TTS avatar endpoint");
      }
      const iceData = await iceResponse.json();
      console.log("Fetched ICE Data:", iceData);

      const configuration: RTCConfiguration = {
        iceServers: [
          {
            urls: iceData.Urls,
            username: iceData.Username,
            credential: iceData.Password
          }
        ]
      };

      // 4) Create peer connection
      const pc = new RTCPeerConnection(configuration);

      pc.ontrack = (event) => {
        if (event.track.kind === 'video' && videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.autoplay = true;
        } else if (event.track.kind === 'audio' && audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.autoplay = true;
        }
      };

      pc.addTransceiver('video', { direction: 'sendrecv' });
      pc.addTransceiver('audio', { direction: 'sendrecv' });

      // 5) AvatarSynthesizer
      avatarSynthesizerRef.current = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);
      const startResult = await avatarSynthesizerRef.current.startAvatarAsync(pc);
      if (startResult.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.log("Avatar started successfully (video & audio track live).");
      } else {
        console.warn("Avatar start result:", startResult.reason);
      }
    } catch (err) {
      console.error("ICE/Avatar start error:", err);
      setIsLoading(false);
      return;
    }

    // 6) Initialize AzureOpenAI with v4 library
    if (!azureOpenAIKey || !azureOpenAIEndpoint) {
      console.error("Missing Azure OpenAI configuration. Please check your environment variables.");
      setIsLoading(false);
      return;
    }
    
    openAIRef.current = new AzureOpenAI({
      apiKey: azureOpenAIKey,
      endpoint: azureOpenAIEndpoint,
      deployment: deploymentName,
      apiVersion: azureAPIVersion,
      dangerouslyAllowBrowser: true
    });

    setIsLoading(false);
    setReady(true);

    // 7) Start speech recognition
    startRecognition();
  };

  // -------------------------------------------------
  // START SPEECH RECOGNITION, handle recognized speech
  // -------------------------------------------------
  const startRecognition = () => {
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    recognizerRef.current = new SpeechSDK.SpeechRecognizer(speechConfigRef.current!, audioConfig);

    recognizerRef.current.recognized = async (_sender, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const userText = e.result.text.trim();
        console.log("USER:", userText);

        messages.push({ role: "user", content: userText });
        setMessages([...messages]);

        // 8) Use AzureOpenAI streaming from the v4 SDK
        if (!openAIRef.current) return;

        try {
          const stream = await openAIRef.current.chat.completions.create({
            // If 'deployment' is set in the constructor, you can set model: "" or omit it
            model: "",
            // Or specify model: deploymentName if you prefer
            messages,
            stream: true
          });

          let partialBuffer = "";
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || "";
            if (token) {
              partialBuffer += token;
              // (Optional) chunk on punctuation
              if (token.endsWith(".")) {
                const sentence = partialBuffer;
                partialBuffer = "";

                console.log("AI chunk:", sentence);
                messages.push({ role: "assistant", content: sentence });
                setMessages([...messages]);

                // Speak partial chunk
                await speakAvatar(sentence);
              }
            }
          }

          // If leftover after streaming
          if (partialBuffer) {
            console.log("AI leftover:", partialBuffer);
            messages.push({ role: "assistant", content: partialBuffer });
            setMessages([...messages]);

            await speakAvatar(partialBuffer);
            partialBuffer = "";
          }
        } catch (err) {
          console.error("AzureOpenAI streaming error:", err);
        }
      } else {
        console.log("Listening...");
      }
    };

    recognizerRef.current.startContinuousRecognitionAsync();
  };

  // -------------------------------
  // AVATAR SPEAK function
  // -------------------------------
  const speakAvatar = async (text: string) => {
    if (!avatarSynthesizerRef.current) return;

    // Attempt auto-play
    if (videoRef.current) {
      try {
        await videoRef.current.play();
      } catch (err) {
        console.warn("Video autoplay issue:", err);
      }
    }

    try {
      const result = await avatarSynthesizerRef.current.speakTextAsync(text);
      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.log("Avatar synthesized text:", text);
      } else {
        console.warn("Synth incomplete. Reason:", result.reason);
        if (result.reason === SpeechSDK.ResultReason.Canceled) {
          // Access error details directly from the result
          console.log("Canceled detail:", result.errorDetails);
        }
      }
    } catch (err) {
      console.error("Speak error:", err);
    }
  };

  // --------
  // UI
  // --------
  return (
    <FluentProvider theme={webLightTheme}>
      <div className={styles.root}>
        {/* Top Chrome Header */}
        <div className={styles.header}>
          <Text size={500} weight="semibold">Azure TTS Avatar Demo</Text>
          
          <div className={styles.toolbar}>
            <Settings24Regular 
              className={styles.settingsIcon} 
              onClick={() => setIsSettingsOpen(true)} 
            />
          </div>
        </div>

        {/* Avatar Content Area */}
        <div className={styles.avatarContainer}>
          <video ref={videoRef} className={styles.avatarVideo} autoPlay />
          <audio ref={audioRef} autoPlay />
          
          {/* Loading Overlay or Start Button */}
          {(!ready || isLoading) && (
            <div className={styles.loadingContainer}>
              {isLoading ? (
                <>
                  <Spinner size="large" />
                  <Text size={300} weight="medium" style={{ marginTop: '16px' }}>
                    Initializing Avatar...
                  </Text>
                </>
              ) : (
                <Button 
                  appearance="primary" 
                  size="large" 
                  className={styles.startButton}
                  onClick={startApp}
                >
                  Start Avatar
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Settings Drawer */}
        <Drawer
          open={isSettingsOpen}
          onOpenChange={(_, { open }) => setIsSettingsOpen(open)}
          position="end"
          size="medium"
        >
          <DrawerHeader>
            <DrawerHeaderTitle>System Settings</DrawerHeaderTitle>
          </DrawerHeader>
          <DrawerBody>
            <Field label="System Prompt">
              <Textarea
                className={styles.systemPromptTextarea}
                resize="vertical"
                value={systemMessage}
                onChange={(e) => setSystemMessage(e.target.value)}
              />
            </Field>
            <Button 
              appearance="primary"
              onClick={updateSystemMessage}
              style={{ marginTop: '16px' }}
            >
              Save Changes
            </Button>
          </DrawerBody>
        </Drawer>
      </div>
    </FluentProvider>
  );
}

export default App;// Add a comment
// Add another comment
// Fix issue
// Clean up
// Fluent UI
// Update system message
// Add a comment
// Add another comment
// Fix issue
// Clean up
// Fluent UI
// Update system message
