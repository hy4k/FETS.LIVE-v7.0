/**
 * Gemini 3.1 Flash Live Multimodal Client
 * Powered by models/gemini-3.1-flash-live-preview
 * Supports real-time bidirectional audio (16kHz in / 24kHz out), video camera, screen sharing, and text turns.
 */

import { supabase } from './supabase';

/** Fetch Gemini API key from app_config table (cached in memory) */
let _cachedGeminiKey: string | null = null;
async function fetchGeminiApiKey(): Promise<string> {
  if (_cachedGeminiKey) return _cachedGeminiKey;

  // Try env vars first (dev mode)
  const envKey = (import.meta.env.VITE_AI_API_KEY as string) || (import.meta.env.VITE_GEMINI_API_KEY as string) || (import.meta.env.VITE_GEMINI_LIVE_API_KEY as string);
  if (envKey) {
    _cachedGeminiKey = envKey;
    return envKey;
  }

  // Fetch from app_config table
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();
    if (data?.value) {
      _cachedGeminiKey = data.value;
      return data.value;
    }
  } catch (err) {
    console.warn('[GeminiLive] Failed to fetch API key from app_config:', err);
  }

  return '';
}

export type GeminiLiveVoice = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';

export interface LiveMessageTurn {
  id: string;
  sender: 'user' | 'gemini';
  text?: string;
  hasAudio?: boolean;
  timestamp: Date;
  isComplete?: boolean;
  imagePreview?: string;
}

export interface LiveClientConfig {
  apiKey?: string;
  voiceName?: GeminiLiveVoice;
  model?: string;
  systemPrompt?: string;
  onTurnUpdate?: (turn: LiveMessageTurn) => void;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error', errorMsg?: string) => void;
  onAudioVisualizerData?: (inputLevel: number, outputLevel: number, outputFrequencies: Uint8Array) => void;
}

export class GeminiLiveClient {
  private apiKey: string;
  private voiceName: GeminiLiveVoice;
  private model: string;
  private systemPrompt: string;
  private ws: WebSocket | null = null;
  private status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error' = 'disconnected';

  // Audio recording
  private audioInputContext: AudioContext | null = null;
  private audioInputStream: MediaStream | null = null;
  private audioInputProcessor: ScriptProcessorNode | null = null;
  private audioInputSource: MediaStreamAudioSourceNode | null = null;

  // Audio playback
  private audioOutputContext: AudioContext | null = null;
  private audioOutputAnalyser: AnalyserNode | null = null;
  private audioOutputQueue: AudioBufferSourceNode[] = [];
  private nextPlayTime = 0;

  // Video / Screen
  private cameraStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private videoIntervalTimer: any = null;
  private canvasElement: HTMLCanvasElement | null = null;

  // Visualizer loop
  private visualizerTimer: any = null;
  private currentInputLevel = 0;

  // Callbacks
  private onTurnUpdate?: (turn: LiveMessageTurn) => void;
  private onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error', errorMsg?: string) => void;
  private onAudioVisualizerData?: (inputLevel: number, outputLevel: number, outputFrequencies: Uint8Array) => void;

  private currentGeminiTurnId: string | null = null;
  private currentGeminiTurnText = '';
  private setupCompleteResolver: (() => void) | null = null;

  constructor(config: LiveClientConfig) {
    this.apiKey = config.apiKey || '';
    this.voiceName = config.voiceName || 'Zephyr';
    this.model = config.model || 'models/gemini-3.1-flash-live-preview';
    this.systemPrompt = config.systemPrompt || '';
    this.onTurnUpdate = config.onTurnUpdate;
    this.onStatusChange = config.onStatusChange;
    this.onAudioVisualizerData = config.onAudioVisualizerData;
  }

  public setApiKey(key: string) {
    this.apiKey = key;
  }

  public setVoice(voice: GeminiLiveVoice) {
    this.voiceName = voice;
  }

  public setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getStatus() {
    return this.status;
  }

  private updateStatus(status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error', errorMsg?: string) {
    this.status = status;
    this.onStatusChange?.(status, errorMsg);
  }

  /**
   * Connects to the Gemini 3.1 Flash Live preview endpoint
   */
  public async connect(): Promise<void> {
    const key = this.apiKey || await fetchGeminiApiKey();
    if (!key) {
      this.updateStatus('error', 'Gemini API Key is not configured. Add it to app_settings table or set VITE_AI_API_KEY.');
      throw new Error('API Key missing');
    }

    this.disconnect();
    this.updateStatus('connecting');

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${key}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          // Send setup message first — status stays 'connecting' until server confirms
          this.sendSetupMessage();
          this.initAudioPlayback();
          this.startVisualizerLoop();
          // Resolve immediately so caller can await connection open,
          // but status transitions to 'connected' only after setupComplete
          this.setupCompleteResolver = resolve;
        };

        this.ws.onmessage = (event) => {
          this.handleServerMessage(event.data);
        };

        this.ws.onerror = (err) => {
          console.error('[GeminiLive] WebSocket Error:', err);
          this.updateStatus('error', 'WebSocket connection error. Check API key and network.');
          this.setupCompleteResolver = null;
          reject(err);
        };

        this.ws.onclose = (event) => {
          console.log('[GeminiLive] WebSocket Closed:', event.code, event.reason);
          this.cleanupStreams();
          // If we never got setupComplete, resolve the promise anyway to avoid hanging
          if (this.setupCompleteResolver) {
            this.setupCompleteResolver();
            this.setupCompleteResolver = null;
          }
          this.updateStatus('disconnected');
        };
      } catch (err: any) {
        this.updateStatus('error', err?.message || 'Connection failed');
        reject(err);
      }
    });
  }

  /**
   * Sends the initial Setup message with Gemini 3.1 Flash Live parameters
   */
  private sendSetupMessage() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const setupPayload = {
      setup: {
        model: this.model,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.voiceName,
              },
            },
          },
          thinkingConfig: {
            thinkingLevel: 'MINIMAL',
          },
          mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
          contextWindowCompression: {
            triggerTokens: '104857',
            slidingWindow: { targetTokens: '52428' },
          },
        },
        systemInstruction: {
          parts: [
            {
              text:
                this.systemPrompt ||
                `You are FETS LIVE OMNI, the real-time AI operational assistant for FETS (Frontline Examination & Testing Services). ` +
                `You assist test centre administrators, duty officers, and invigilators with exam operations (Pearson VUE, Prometric, IELTS, CELPIP, PSI, CMA), ` +
                `candidate verification, technical incident triage, staff rosters, and centre health. ` +
                `Be concise, proactive, friendly, and authoritative in exam logistics. Answer using crisp voice and natural cadence.`,
            },
          ],
        },
      },
    };

    this.ws.send(JSON.stringify(setupPayload));
  }

  /**
   * Disconnects and cleans up all active streams and audio nodes
   */
  public disconnect() {
    this.stopAudioInput();
    this.stopCameraStream();
    this.stopScreenStream();
    this.stopVisualizerLoop();
    this.clearAudioPlaybackQueue();
    this.setupCompleteResolver = null;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.updateStatus('disconnected');
  }

  private cleanupStreams() {
    this.stopAudioInput();
    this.stopCameraStream();
    this.stopScreenStream();
    this.stopVisualizerLoop();
    this.clearAudioPlaybackQueue();
  }

  /* -------------------------------------------------------------------------- */
  /*                          AUDIO INPUT (MICROPHONE)                          */
  /* -------------------------------------------------------------------------- */

  public async startAudioInput(): Promise<void> {
    try {
      this.audioInputStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioInputContext = new AudioCtx({ sampleRate: 16000 });
      if (this.audioInputContext.state === 'suspended') {
        await this.audioInputContext.resume();
      }

      this.audioInputSource = this.audioInputContext.createMediaStreamSource(this.audioInputStream);
      this.audioInputProcessor = this.audioInputContext.createScriptProcessor(2048, 1, 1);

      this.audioInputProcessor.onaudioprocess = (e) => {
        if (!this.isConnected()) return;

        const inputData = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        this.currentInputLevel = Math.min(1, Math.sqrt(sum / inputData.length) * 4);

        // Convert Float32 to 16-bit PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);
        this.sendRealtimeMedia('audio/pcm;rate=16000', base64Audio);
      };

      this.audioInputSource.connect(this.audioInputProcessor);
      this.audioInputProcessor.connect(this.audioInputContext.destination);
      this.updateStatus('listening');
    } catch (err: any) {
      console.error('[GeminiLive] Mic error:', err);
      this.updateStatus('error', `Microphone access error: ${err.message}`);
    }
  }

  public stopAudioInput() {
    if (this.audioInputProcessor) {
      this.audioInputProcessor.disconnect();
      this.audioInputProcessor = null;
    }
    if (this.audioInputSource) {
      this.audioInputSource.disconnect();
      this.audioInputSource = null;
    }
    if (this.audioInputStream) {
      this.audioInputStream.getTracks().forEach((t) => t.stop());
      this.audioInputStream = null;
    }
    if (this.audioInputContext) {
      try {
        this.audioInputContext.close();
      } catch {}
      this.audioInputContext = null;
    }
    this.currentInputLevel = 0;
    if (this.status === 'listening') {
      this.updateStatus('connected');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                          AUDIO OUTPUT (SPEECH SYNTHESIS)                   */
  /* -------------------------------------------------------------------------- */

  private initAudioPlayback() {
    if (this.audioOutputContext && this.audioOutputContext.state !== 'closed') return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioOutputContext = new AudioCtx({ sampleRate: 24000 });
    this.audioOutputAnalyser = this.audioOutputContext.createAnalyser();
    this.audioOutputAnalyser.fftSize = 64;
    this.audioOutputAnalyser.connect(this.audioOutputContext.destination);
    this.nextPlayTime = this.audioOutputContext.currentTime;
  }

  private playPcmChunk(base64Pcm: string, sampleRate = 24000) {
    if (!this.audioOutputContext || this.audioOutputContext.state === 'closed') {
      this.initAudioPlayback();
    }
    if (this.audioOutputContext!.state === 'suspended') {
      this.audioOutputContext!.resume();
    }

    try {
      const rawBytes = this.base64ToArrayBuffer(base64Pcm);
      const int16Data = new Int16Array(rawBytes);
      const float32Data = new Float32Array(int16Data.length);

      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }

      const audioBuffer = this.audioOutputContext!.createBuffer(1, float32Data.length, sampleRate);
      audioBuffer.copyToChannel(float32Data, 0, 0);

      const source = this.audioOutputContext!.createBufferSource();
      source.buffer = audioBuffer;

      if (this.audioOutputAnalyser) {
        source.connect(this.audioOutputAnalyser);
      } else {
        source.connect(this.audioOutputContext!.destination);
      }

      const currentTime = this.audioOutputContext!.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);
      source.start(startTime);

      this.nextPlayTime = startTime + audioBuffer.duration;
      this.audioOutputQueue.push(source);

      this.updateStatus('speaking');

      source.onended = () => {
        const idx = this.audioOutputQueue.indexOf(source);
        if (idx !== -1) {
          this.audioOutputQueue.splice(idx, 1);
        }
        if (this.audioOutputQueue.length === 0 && this.status === 'speaking') {
          this.updateStatus(this.audioInputStream ? 'listening' : 'connected');
        }
      };
    } catch (err) {
      console.error('[GeminiLive] PCM playback error:', err);
    }
  }

  private clearAudioPlaybackQueue() {
    this.audioOutputQueue.forEach((src) => {
      try {
        src.stop();
      } catch {}
    });
    this.audioOutputQueue = [];
    if (this.audioOutputContext) {
      this.nextPlayTime = this.audioOutputContext.currentTime;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                          CAMERA & SCREEN STREAMING                         */
  /* -------------------------------------------------------------------------- */

  public async startCameraStream(): Promise<MediaStream> {
    this.stopCameraStream();
    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 5, max: 10 },
      },
    });

    this.ensureVideoStreaming();
    return this.cameraStream;
  }

  public stopCameraStream() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop());
      this.cameraStream = null;
    }
    if (!this.screenStream) {
      this.stopVideoStreamingInterval();
    }
  }

  public async startScreenStream(): Promise<MediaStream> {
    this.stopScreenStream();
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 5, max: 10 },
      },
    });

    this.screenStream.getVideoTracks()[0].onended = () => {
      this.stopScreenStream();
    };

    this.ensureVideoStreaming();
    return this.screenStream;
  }

  public stopScreenStream() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    if (!this.cameraStream) {
      this.stopVideoStreamingInterval();
    }
  }

  private ensureVideoStreaming() {
    if (this.videoIntervalTimer) return;

    if (!this.canvasElement) {
      this.canvasElement = document.createElement('canvas');
      this.canvasElement.width = 640;
      this.canvasElement.height = 480;
    }

    const videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.playsInline = true;

    // Send 1 frame per second (1000ms)
    this.videoIntervalTimer = setInterval(() => {
      if (!this.isConnected()) return;

      const activeStream = this.screenStream || this.cameraStream;
      if (!activeStream || activeStream.getVideoTracks().length === 0) return;

      if (videoEl.srcObject !== activeStream) {
        videoEl.srcObject = activeStream;
        videoEl.play().catch(() => {});
      }

      if (videoEl.readyState >= 2 && this.canvasElement) {
        const ctx = this.canvasElement.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, this.canvasElement.width, this.canvasElement.height);
          const dataUrl = this.canvasElement.toDataURL('image/jpeg', 0.6);
          const base64Data = dataUrl.split(',')[1];
          if (base64Data) {
            this.sendRealtimeMedia('image/jpeg', base64Data);
          }
        }
      }
    }, 1000);
  }

  private stopVideoStreamingInterval() {
    if (this.videoIntervalTimer) {
      clearInterval(this.videoIntervalTimer);
      this.videoIntervalTimer = null;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                          MESSAGING & COMMUNICATION                         */
  /* -------------------------------------------------------------------------- */

  public sendRealtimeMedia(mimeType: string, base64Data: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType,
            data: base64Data,
          },
        ],
      },
    };
    this.ws.send(JSON.stringify(msg));
  }

  public sendText(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !text.trim()) return;

    const userTurn: LiveMessageTurn = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
      isComplete: true,
    };
    this.onTurnUpdate?.(userTurn);

    const msg = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: text.trim() }],
          },
        ],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(msg));
  }

  /**
   * Handles incoming WebSocket messages from the Gemini Live server
   */
  private handleServerMessage(rawData: any) {
    try {
      const msg = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

      // Handle setupComplete — server confirmed our setup, now we're truly connected
      if (msg.setupComplete) {
        this.updateStatus('connected');
        if (this.setupCompleteResolver) {
          this.setupCompleteResolver();
          this.setupCompleteResolver = null;
        }
        return;
      }

      // Handle serverContent
      if (msg.serverContent) {
        const sc = msg.serverContent;

        // User interruption: Model stopped producing speech because user interrupted
        if (sc.interrupted) {
          this.clearAudioPlaybackQueue();
          if (this.currentGeminiTurnId) {
            this.onTurnUpdate?.({
              id: this.currentGeminiTurnId,
              sender: 'gemini',
              text: this.currentGeminiTurnText + ' [Interrupted]',
              timestamp: new Date(),
              isComplete: true,
            });
            this.currentGeminiTurnId = null;
            this.currentGeminiTurnText = '';
          }
        }

        // Model Turn Parts
        if (sc.modelTurn?.parts) {
          if (!this.currentGeminiTurnId) {
            this.currentGeminiTurnId = `g-${Date.now()}`;
            this.currentGeminiTurnText = '';
          }

          for (const part of sc.modelTurn.parts) {
            // Text part
            if (part.text) {
              this.currentGeminiTurnText += part.text;
              this.onTurnUpdate?.({
                id: this.currentGeminiTurnId,
                sender: 'gemini',
                text: this.currentGeminiTurnText,
                timestamp: new Date(),
                isComplete: false,
              });
            }

            // Audio PCM inline data
            if (part.inlineData) {
              const inline = part.inlineData;
              const mime = inline.mimeType || 'audio/pcm;rate=24000';
              let sampleRate = 24000;
              if (mime.includes('rate=')) {
                const match = mime.match(/rate=(\d+)/);
                if (match) sampleRate = parseInt(match[1], 10);
              }

              this.playPcmChunk(inline.data, sampleRate);

              this.onTurnUpdate?.({
                id: this.currentGeminiTurnId,
                sender: 'gemini',
                text: this.currentGeminiTurnText || '🎙️ (Speaking...)',
                hasAudio: true,
                timestamp: new Date(),
                isComplete: false,
              });
            }
          }
        }

        // Turn complete
        if (sc.turnComplete) {
          if (this.currentGeminiTurnId) {
            this.onTurnUpdate?.({
              id: this.currentGeminiTurnId,
              sender: 'gemini',
              text: this.currentGeminiTurnText,
              hasAudio: true,
              timestamp: new Date(),
              isComplete: true,
            });
            this.currentGeminiTurnId = null;
            this.currentGeminiTurnText = '';
          }
        }
      }
    } catch (err) {
      console.error('[GeminiLive] Parse message error:', err);
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                          VISUALIZER & FREQUENCIES                          */
  /* -------------------------------------------------------------------------- */

  private startVisualizerLoop() {
    this.stopVisualizerLoop();
    const freqData = new Uint8Array(32);

    this.visualizerTimer = setInterval(() => {
      let outputLevel = 0;
      if (this.audioOutputAnalyser && this.audioOutputQueue.length > 0) {
        this.audioOutputAnalyser.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < freqData.length; i++) sum += freqData[i];
        outputLevel = Math.min(1, sum / (freqData.length * 180));
      }

      this.onAudioVisualizerData?.(this.currentInputLevel, outputLevel, freqData);
    }, 50);
  }

  private stopVisualizerLoop() {
    if (this.visualizerTimer) {
      clearInterval(this.visualizerTimer);
      this.visualizerTimer = null;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                          BASE64 UTILS                                      */
  /* -------------------------------------------------------------------------- */

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
