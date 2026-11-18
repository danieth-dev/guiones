import type { AudioPlayer, AudioRecorder } from '../../src/application';

/** Micrófono y altavoz de prueba (sin dispositivos reales). */
export class FakeRecorder implements AudioRecorder {
  supported = true;
  recording = false;
  failStart: Error | null = null;
  failStop = false;
  isSupported(): boolean {
    return this.supported;
  }
  start(): Promise<void> {
    if (this.failStart) return Promise.reject(this.failStart);
    this.recording = true;
    return Promise.resolve();
  }
  stop(): Promise<Blob> {
    this.recording = false;
    if (this.failStop) return Promise.reject(new Error('cortado'));
    return Promise.resolve(new Blob(['voz'], { type: 'audio/webm' }));
  }
  cancel(): void {
    this.recording = false;
  }
}

export class FakePlayer implements AudioPlayer {
  played: Blob[] = [];
  fail = false;
  private finish: (() => void) | null = null;
  play(audio: Blob): Promise<void> {
    if (this.fail) return Promise.reject(new Error('sin audio'));
    this.played.push(audio);
    return new Promise((resolve) => {
      this.finish = resolve;
    });
  }
  /** Simula el final de la reproducción. */
  end(): void {
    this.finish?.();
    this.finish = null;
  }
  stop(): void {
    this.end();
  }
}
