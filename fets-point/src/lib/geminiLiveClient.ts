/**
 * Gemini 3.1 Flash Live Multimodal Client
 * Powered by models/gemini-3.1-flash-live-preview
 * Supports real-time bidirectional audio (16kHz in / 24kHz out), video camera, screen sharing, and text turns.
 */

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
  getSession: () => Promise<{token:string;setup:Record<string,unknown>}>;
  executeTool: (name:string,args:Record<string,unknown>) => Promise<Record<string,unknown>>;
  onMediaChange?: (media:{mic:boolean;camera:boolean;screen:boolean})=>void;
  voiceName?: GeminiLiveVoice;
  model?: string;
  systemPrompt?: string;
  onTurnUpdate?: (turn: LiveMessageTurn) => void;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'error', errorMsg?: string) => void;
  onAudioVisualizerData?: (inputLevel: number, outputLevel: number, outputFrequencies: Uint8Array) => void;
  onToolActivity?: (toolName: string | null) => void;
}

export class GeminiLiveClient {
  private getSession: LiveClientConfig['getSession'];
  private executeTool: LiveClientConfig['executeTool'];
  private onMediaChange?: LiveClientConfig['onMediaChange'];
  private setup: Record<string,unknown> = {};
  private connectionReady=false;
  private generation=0;
  private sessionTimer: ReturnType<typeof setTimeout>|null=null;
  private settleConnection: ((error?:Error)=>void)|null=null;
  private userTranscriptId:string|null=null;
  private userTranscript='';
  private cancelledCalls=new Set<string>();
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
  private onToolActivity?: (toolName: string | null) => void;

  private currentGeminiTurnId: string | null = null;
  private currentGeminiTurnText = '';

  constructor(config: LiveClientConfig) {
    this.getSession=config.getSession;this.executeTool=config.executeTool;this.onMediaChange=config.onMediaChange;
    this.voiceName = config.voiceName || 'Zephyr';
    this.model = config.model || 'models/gemini-3.1-flash-live-preview';
    this.systemPrompt = config.systemPrompt || '';
    this.onTurnUpdate = config.onTurnUpdate;
    this.onStatusChange = config.onStatusChange;
    this.onAudioVisualizerData = config.onAudioVisualizerData;
    this.onToolActivity = config.onToolActivity;
  }

  public setVoice(voice: GeminiLiveVoice) {
    this.voiceName = voice;
  }

  public setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt;
  }

  public isConnected(): boolean {
    return this.connectionReady && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
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
    this.disconnect();const generation=this.generation;this.updateStatus('connecting');
    try {
      const session=await this.getSession();if(generation!==this.generation)throw new Error('Session cancelled.');
      this.setup=session.setup;
      await new Promise<void>((resolve,reject)=>{
        const ws=new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(session.token)}`);
        this.ws=ws;
        const timer=setTimeout(()=>{if(this.ws===ws){this.disconnect();this.updateStatus('error','Gemini did not finish connecting. Try again.');}},20000);
        this.settleConnection=(error)=>{clearTimeout(timer);this.settleConnection=null;error?reject(error):resolve();};
        ws.onopen=()=>{if(this.ws===ws)ws.send(JSON.stringify({setup:this.setup}));};
        ws.onmessage=event=>{if(this.ws===ws)this.handleServerMessage(event.data,ws);};
        ws.onerror=()=>{if(this.ws!==ws)return;this.disconnect();this.updateStatus('error','The live connection failed. Try again.');};
        ws.onclose=()=>{if(this.ws!==ws)return;this.disconnect();this.updateStatus('disconnected','Live session ended. Start again when you are ready.');};
      });
      if(generation!==this.generation)return;
      // Stop before the short-lived token expires, including any shared media.
      this.sessionTimer=setTimeout(()=>{this.disconnect();this.updateStatus('disconnected','The 9-minute session ended. Start a new session to continue.');},9*60000);
    } catch(error) { if(generation===this.generation){this.disconnect();this.updateStatus('error',error instanceof Error?error.message:'Live setup is unavailable.');}throw error; }
  }

  public updatePageContext(page:string) {
    if(this.isConnected())this.ws!.send(JSON.stringify({clientContent:{turns:[{role:'user',parts:[{text:`Workspace navigation update: the user is now on ${page}. This updates page context only; do not respond until asked.`}]}],turnComplete:false}}));
  }
  private mediaChanged(){this.onMediaChange?.({mic:Boolean(this.audioInputStream),camera:Boolean(this.cameraStream),screen:Boolean(this.screenStream)});}

  /**
   * Disconnects and cleans up all active streams and audio nodes
   */
  public disconnect() {
    this.generation++;this.connectionReady=false;this.settleConnection?.(new Error('Live connection ended before setup completed.'));
    if(this.sessionTimer)clearTimeout(this.sessionTimer);this.sessionTimer=null;
    this.cancelledCalls.clear();this.currentGeminiTurnId=null;this.currentGeminiTurnText='';this.userTranscriptId=null;this.userTranscript='';
    this.stopAudioInput();
    this.stopCameraStream();
    this.stopScreenStream();
    this.stopVisualizerLoop();
    this.clearAudioPlaybackQueue();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if(this.audioOutputContext){this.audioOutputContext.close().catch(()=>{});this.audioOutputContext=null;this.audioOutputAnalyser=null;}
    this.mediaChanged();this.updateStatus('disconnected');
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
    if(!this.isConnected())throw new Error('Start a live session first.');
    this.stopAudioInput();const generation=this.generation;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if(generation!==this.generation||!this.isConnected()){stream.getTracks().forEach(t=>t.stop());throw new Error('Session ended while requesting the microphone.');}
      this.audioInputStream=stream;this.mediaChanged();
      stream.getTracks().forEach(t=>{t.onended=()=>this.stopAudioInput();});
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
      this.stopAudioInput();throw new Error('Microphone access was not granted. You can still type.');
    }
  }

  public stopAudioInput() {
    if(this.audioInputStream&&this.isConnected())this.ws!.send(JSON.stringify({realtimeInput:{audioStreamEnd:true}}));
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
    this.currentInputLevel = 0;this.mediaChanged();
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
    if(!this.isConnected())throw new Error('Start a live session first.');
    this.stopScreenStream();this.stopCameraStream();const generation=this.generation;
    const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:5,max:10}}});
    if(generation!==this.generation||!this.isConnected()){stream.getTracks().forEach(t=>t.stop());throw new Error('Session ended.');}
    this.cameraStream=stream;stream.getVideoTracks().forEach(t=>{t.onended=()=>this.stopCameraStream();});
    this.mediaChanged();this.ensureVideoStreaming();return stream;
  }
  public stopCameraStream() {
    this.cameraStream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.cameraStream=null;
    if(!this.screenStream)this.stopVideoStreamingInterval();this.mediaChanged();
  }
  public async startScreenStream(): Promise<MediaStream> {
    if(!this.isConnected())throw new Error('Start a live session first.');
    if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen sharing is unavailable in this browser. Try desktop Chrome or Edge.');
    this.stopCameraStream();this.stopScreenStream();const generation=this.generation;
    const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:5,max:10}},audio:false});
    if(generation!==this.generation||!this.isConnected()){stream.getTracks().forEach(t=>t.stop());throw new Error('Session ended.');}
    this.screenStream=stream;stream.getVideoTracks().forEach(t=>{t.onended=()=>this.stopScreenStream();});
    this.mediaChanged();this.ensureVideoStreaming();return stream;
  }
  public stopScreenStream() {
    this.screenStream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.screenStream=null;
    if(!this.cameraStream)this.stopVideoStreamingInterval();this.mediaChanged();
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
      if (!this.isConnected() || document.hidden) return;

      const activeStream = this.screenStream || this.cameraStream;
      if (!activeStream || activeStream.getVideoTracks().length === 0) return;

      if (videoEl.srcObject !== activeStream) {
        videoEl.srcObject = activeStream;
        videoEl.play().catch(() => {});
      }

      if (videoEl.readyState >= 2 && this.canvasElement) {
        const ctx = this.canvasElement.getContext('2d');
        if (ctx) {
          this.canvasElement.width=640;this.canvasElement.height=Math.max(1,Math.round(640*(videoEl.videoHeight||480)/(videoEl.videoWidth||640)));
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

    // Use new format: realtimeInput.audio / realtimeInput.video (mediaChunks is deprecated)
    const mediaPayload = { data: base64Data, mimeType };

    const msg: any = { realtimeInput: {} };
    if (mimeType.startsWith('audio/')) {
      msg.realtimeInput.audio = mediaPayload;
    } else if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
      msg.realtimeInput.video = mediaPayload;
    } else {
      msg.realtimeInput.audio = mediaPayload;
    }

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
  private handleServerMessage(rawData: any, socket=this.ws) {
    if(socket!==this.ws)return;
    try {
      // Handle Blob data from WebSocket (convert to text first)
      if (rawData instanceof Blob) {
        rawData.text().then((text: string) => this.handleServerMessage(text,socket));
        return;
      }

      const msg = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

      // Handle setupComplete — server confirmed our setup
      if (msg.setupComplete) {
        this.connectionReady=true;this.initAudioPlayback();this.startVisualizerLoop();
        this.updateStatus('connected');this.settleConnection?.();
        return;
      }

      if(msg.toolCallCancellation){for(const id of msg.toolCallCancellation.ids||[])this.cancelledCalls.add(id);return;}
      if(msg.goAway){this.disconnect();this.updateStatus('disconnected','Gemini ended this live session. Start again to continue.');return;}
      // Handle toolCall from Gemini (function calling)
      if (msg.toolCall) {
        this.handleToolCalls(msg.toolCall);
        return;
      }

      // Handle serverContent
      if (msg.serverContent) {
        const sc = msg.serverContent;
        if(sc.inputTranscription?.text){
          this.userTranscriptId ||= `u-${crypto.randomUUID()}`;this.userTranscript+=sc.inputTranscription.text;
          this.onTurnUpdate?.({id:this.userTranscriptId,sender:'user',text:this.userTranscript,timestamp:new Date(),isComplete:false});
        }
        if(sc.outputTranscription?.text){
          this.currentGeminiTurnId ||= `g-${crypto.randomUUID()}`;this.currentGeminiTurnText+=sc.outputTranscription.text;
          this.onTurnUpdate?.({id:this.currentGeminiTurnId,sender:'gemini',text:this.currentGeminiTurnText,timestamp:new Date(),isComplete:false});
        }

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
          if(this.userTranscriptId)this.onTurnUpdate?.({id:this.userTranscriptId,sender:'user',text:this.userTranscript,timestamp:new Date(),isComplete:true});
          this.userTranscriptId=null;this.userTranscript='';
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
  /*                          TOOL CALL HANDLING                                */
  /* -------------------------------------------------------------------------- */

  private async handleToolCalls(toolCall: any) {
    const socket=this.ws;const responses:any[]=[];
    for(const fc of (toolCall.functionCalls||[]).slice(0,8)){
      if(socket!==this.ws||this.cancelledCalls.has(fc.id))continue;
      this.onToolActivity?.(fc.name);let response;
      try{response=await this.executeTool(fc.name,fc.args||{});}catch{response={error:'The lookup failed. Do not assume there are no records.'};}
      if(socket!==this.ws)return;
      if(!this.cancelledCalls.has(fc.id))responses.push({id:fc.id,name:fc.name,response});
    }
    this.onToolActivity?.(null);
    if(socket===this.ws&&this.isConnected()&&responses.length)this.ws!.send(JSON.stringify({toolResponse:{functionResponses:responses}}));
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
