/**
 * Limitador en memoria por ventana fija. Suficiente para una instancia del
 * servidor; si algún día hay varias, hay que moverlo a un almacén compartido.
 */
interface Bucket { count: number; resetAt: number }

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly windowMs: number) {
    setInterval(() => this.sweep(), 60_000).unref();
  }

  /** Segundos de espera si la clave ya superó el máximo; 0 si puede continuar. */
  retryAfter(key: string, max: number): number {
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= Date.now()) return 0;
    return b.count >= max ? Math.ceil((b.resetAt - Date.now()) / 1000) : 0;
  }

  hit(key: string): void {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
    else b.count += 1;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}
