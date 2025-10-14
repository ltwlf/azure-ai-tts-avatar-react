import { useRef, useState, useEffect } from 'react';
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
const deploymentName = process.env.REACT_APP_AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
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

// Helper function to get timestamp for logging
const getTimestamp = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
};

function App() {
  const styles = useStyles();
  const [isLoading, setIsLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Refs to hold Speech & Avatar objects
  const speechConfigRef = useRef<SpeechSDK.SpeechConfig>();
  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer>();
  const avatarSynthesizerRef = useRef<SpeechSDK.AvatarSynthesizer>();
  const isSpeakingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInterruptedRef = useRef<boolean>(false);
  const speechQueueRef = useRef<Promise<void>[]>([]);

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
        "You are Holly, a helpful assistant in real-time voice conversation. Speak naturally with short, clear sentences. Use contractions. Keep responses concise. No lists or formatting. Every word is spoken aloud. Be warm and professional."
    }
  ]);

  // Keep a ref that always has the latest messages
  const messagesRef = useRef<ChatMessage[]>(messages);

  // Update ref whenever messages state changes
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

    console.log('Azure OpenAI Configuration:');
    console.log('  Endpoint:', azureOpenAIEndpoint);
    console.log('  Deployment:', deploymentName);
    console.log('  API Version:', azureAPIVersion);

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

    // When user starts speaking, interrupt the avatar
    recognizerRef.current.recognizing = (_sender, e) => {
      if (e.result.text && e.result.text.trim().length > 0) {
        stopAvatarSpeech();
      }
    };

    recognizerRef.current.recognized = async (_sender, e) => {
      if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
        const userText = e.result.text.trim();
        console.log(`[${getTimestamp()}] USER: ${userText}`);

        // Ignore empty transcripts (breathing noise, silence, etc.)
        if (!userText) {
          console.log(`[${getTimestamp()}] Ignoring empty transcript`);
          return;
        }

        // Reset interruption flag for new user input
        isInterruptedRef.current = false;
        // Clear any pending speech queue
        speechQueueRef.current = [];

        // Create new messages array with user input using the ref to get latest state
        const updatedMessages: ChatMessage[] = [...messagesRef.current, { role: "user" as const, content: userText }];
        setMessages(updatedMessages);

        // 8) Use AzureOpenAI streaming from the v4 SDK
        if (!openAIRef.current) return;

        try {
          // Create new AbortController for this request
          abortControllerRef.current = new AbortController();

          console.log(`[${getTimestamp()}] Sending AI request with ${updatedMessages.length} messages`);
          const stream = await openAIRef.current.chat.completions.create({
            // If 'deployment' is set in the constructor, you can set model: "" or omit it
            model: "",
            // Or specify model: deploymentName if you prefer
            messages: updatedMessages,
            stream: true
            // Note: Removed max_completion_tokens - GPT-5 might have issues with it in multi-turn
          }, {
            signal: abortControllerRef.current.signal
          });

          // Collect full AI response
          let fullResponse = "";
          let partialBuffer = "";
          for await (const chunk of stream) {
            // Check if interrupted
            if (isInterruptedRef.current) {
              console.log(`[${getTimestamp()}] AI stream stopped due to interruption`);
              break;
            }

            const token = chunk.choices[0]?.delta?.content || "";
            if (token) {
              partialBuffer += token;
              fullResponse += token;
              // Chunk on multiple punctuation marks for lower latency
              if (token.match(/[.,;!?]/)) {
                const sentence = partialBuffer;
                partialBuffer = "";


                // Queue speech sequentially to maintain order but don't block stream
                // Only queue non-empty, non-whitespace chunks
                if (!isInterruptedRef.current && sentence.trim().length > 0) {
                  const previousSpeech = speechQueueRef.current[speechQueueRef.current.length - 1] || Promise.resolve();
                  const newSpeech = previousSpeech.then(() => {
                    if (!isInterruptedRef.current) {
                      return speakAvatar(sentence);
                    }
                  });
                  speechQueueRef.current.push(newSpeech);
                }
              }
            }
          }

          // If leftover after streaming and not interrupted
          if (partialBuffer && partialBuffer.trim().length > 0 && !isInterruptedRef.current) {
            fullResponse += partialBuffer;

            // Queue leftover speech
            const previousSpeech = speechQueueRef.current[speechQueueRef.current.length - 1] || Promise.resolve();
            const newSpeech = previousSpeech.then(() => {
              if (!isInterruptedRef.current) {
                return speakAvatar(partialBuffer);
              }
            });
            speechQueueRef.current.push(newSpeech);
            partialBuffer = "";
          }

          // Add complete AI response to messages (only if not interrupted and has content)
          if (fullResponse && !isInterruptedRef.current) {
            setMessages([...updatedMessages, { role: "assistant" as const, content: fullResponse }]);
          }

          // Clear abort controller when done
          abortControllerRef.current = null;
        } catch (err: any) {
          if (err.name === 'AbortError') {
            console.log(`[${getTimestamp()}] AI request was aborted by user interruption`);
          } else {
            console.error(`[${getTimestamp()}] AzureOpenAI streaming error:`, err);
          }
          abortControllerRef.current = null;
        }
      } else {
        console.log(`[${getTimestamp()}] Listening...`);
      }
    };

    recognizerRef.current.startContinuousRecognitionAsync();
  };

  // -------------------------------
  // STOP AVATAR SPEECH (for interruption)
  // -------------------------------
  const stopAvatarSpeech = async () => {
    // Set interruption flag to prevent new speech
    isInterruptedRef.current = true;

    // Clear the speech queue
    speechQueueRef.current = [];

    // Abort ongoing AI stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop any ongoing synthesis
    if (avatarSynthesizerRef.current && isSpeakingRef.current) {
      try {
        await avatarSynthesizerRef.current.stopSpeakingAsync();
        isSpeakingRef.current = false;
      } catch (err) {
        console.warn(`[${getTimestamp()}] Error stopping avatar speech:`, err);
      }
    }
  };

  // -------------------------------
  // AVATAR SPEAK function
  // -------------------------------
  const speakAvatar = async (text: string) => {
    if (!avatarSynthesizerRef.current) return;

    // Don't speak if interrupted
    if (isInterruptedRef.current) {
      return;
    }

    // Attempt auto-play
    if (videoRef.current) {
      try {
        await videoRef.current.play();
      } catch (err) {
        console.warn(`[${getTimestamp()}] Video autoplay issue:`, err);
      }
    }

    try {
      isSpeakingRef.current = true;
      const result = await avatarSynthesizerRef.current.speakTextAsync(text);
      isSpeakingRef.current = false;

      if (result.reason !== SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.warn(`[${getTimestamp()}] Synth incomplete. Reason:`, result.reason);
        if (result.reason === SpeechSDK.ResultReason.Canceled) {
          console.log(`[${getTimestamp()}] Canceled detail:`, result.errorDetails);
        }
      }
    } catch (err) {
      isSpeakingRef.current = false;
      console.error(`[${getTimestamp()}] Speak error:`, err);
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
          <Text size={500} weight="semibold">iLoveAgents.ai</Text>

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
