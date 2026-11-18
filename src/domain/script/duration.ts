/** Duración en segundos (inmutable, nunca negativa). */
export class Duration {
  static readonly ZERO = new Duration(0);

  private constructor(readonly seconds: number) {}

  static ofSeconds(seconds: number): Duration {
    return seconds <= 0 || !Number.isFinite(seconds) ? Duration.ZERO : new Duration(seconds);
  }

  plus(other: Duration): Duration {
    return Duration.ofSeconds(this.seconds + other.seconds);
  }

  isLongerThan(seconds: number): boolean {
    return this.seconds > seconds;
  }

  /** Segundos redondeados a un decimal, para mostrar ("4.8 s"). */
  rounded(): number {
    return Math.round(this.seconds * 10) / 10;
  }
}
