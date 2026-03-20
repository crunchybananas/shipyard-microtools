import Service from "@ember/service";
import { tracked } from "@glimmer/tracking";

// Extend Window to include the webkit-prefixed SpeechRecognition
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

export default class VoiceService extends Service {
  @tracked isListening: boolean = false;
  @tracked transcript: string = "";
  @tracked interimTranscript: string = "";
  @tracked isAvailable: boolean = false;

  private recognition: SpeechRecognitionInstance | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSubmitCallback: ((transcript: string) => void) | null = null;

  constructor(properties: object | undefined) {
    super(properties);
    this.isAvailable = this.checkAvailability();
  }

  private checkAvailability(): boolean {
    const win = window as unknown as Record<string, unknown>;
    return !!(win["SpeechRecognition"] || win["webkitSpeechRecognition"]);
  }

  private createRecognition(): SpeechRecognitionInstance | null {
    const win = window as unknown as Record<string, unknown>;
    const SpeechRecognitionClass = (win["SpeechRecognition"] ||
      win["webkitSpeechRecognition"]) as SpeechRecognitionConstructor | undefined;
    if (!SpeechRecognitionClass) return null;
    return new SpeechRecognitionClass();
  }

  startListening(onAutoSubmit?: (transcript: string) => void): void {
    if (!this.isAvailable) return;
    if (this.isListening) {
      this.stopListening();
      return;
    }

    this.autoSubmitCallback = onAutoSubmit ?? null;
    this.transcript = "";
    this.interimTranscript = "";

    const recognition = this.createRecognition();
    if (!recognition) return;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      this.isListening = true;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const text = result[0]!.transcript;
        if (result.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (final) {
        this.transcript = (this.transcript + " " + final).trim();
        this.interimTranscript = "";
        this.resetSilenceTimer();
      } else {
        this.interimTranscript = interim;
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        console.warn("Voice recognition error:", event.error);
      }
      this.isListening = false;
      this.clearSilenceTimer();
    };

    recognition.onend = () => {
      this.isListening = false;
      this.clearSilenceTimer();
    };

    this.recognition = recognition;

    try {
      recognition.start();
    } catch {
      this.isListening = false;
    }
  }

  stopListening(): void {
    this.clearSilenceTimer();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.isListening = false;
    this.interimTranscript = "";
  }

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      // Auto-submit after 2 seconds of silence following final result
      if (this.transcript.trim()) {
        this.stopListening();
        if (this.autoSubmitCallback) {
          this.autoSubmitCallback(this.transcript);
        }
      }
    }, 2000);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  get displayText(): string {
    if (this.interimTranscript) {
      return (this.transcript + " " + this.interimTranscript).trim();
    }
    return this.transcript;
  }

  willDestroy(): void {
    super.willDestroy();
    this.stopListening();
  }
}

declare module "@ember/service" {
  interface Registry {
    "voice-service": VoiceService;
  }
}
