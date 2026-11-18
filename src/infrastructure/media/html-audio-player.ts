import type { AudioPlayer } from '../../application';

/** Reproduce tomas con un único elemento <audio> (una a la vez). */
export class HtmlAudioPlayer implements AudioPlayer {
  private readonly audio = new Audio();
  private url: string | null = null;
  private finish: (() => void) | null = null;

  constructor() {
    this.audio.addEventListener('ended', () => {
      this.settle();
    });
    this.audio.addEventListener('error', () => {
      this.settle();
    });
  }

  async play(blob: Blob): Promise<void> {
    this.stop();
    this.url = URL.createObjectURL(blob);
    this.audio.src = this.url;
    const done = new Promise<void>((resolve) => {
      this.finish = resolve;
    });
    await this.audio.play();
    return done;
  }

  stop(): void {
    this.audio.pause();
    this.settle();
  }

  private settle(): void {
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.finish?.();
    this.finish = null;
  }
}
