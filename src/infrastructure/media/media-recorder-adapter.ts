import type { AudioRecorder } from '../../application';

/** Formatos preferidos: Opus en WebM (Chrome/Firefox) y AAC en MP4 (Safari). */
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

/** Graba con MediaRecorder; el audio nunca sale del dispositivo. */
export class MediaRecorderAdapter implements AudioRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];

  isSupported(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'mediaDevices' in navigator &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    // Después de esperar: si otro start() ganó mientras tanto, se libera su micrófono.
    this.cancel();
    this.stream = stream;
    const mimeType = MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : {});
    this.chunks = [];
    this.recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    });
    this.recorder.start();
  }

  stop(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') {
      return Promise.reject(new Error('No hay ninguna grabación en curso.'));
    }
    return new Promise((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          resolve(new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' }));
          this.release();
        },
        { once: true },
      );
      recorder.stop();
    });
  }

  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.release();
  }

  /** Libera el micrófono (apaga el indicador de grabación del sistema). */
  private release(): void {
    this.stream?.getTracks().forEach((track) => {
      track.stop();
    });
    this.stream = null;
    this.recorder = null;
  }
}
