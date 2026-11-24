import { config } from './config';
import { getAccessToken } from './keycloak';

export interface LiveEvent {
  type: string;
  at: string;
  data: Record<string, unknown>;
}

interface SseOptions {
  onEvent: (event: LiveEvent) => void;
  onStatus: (connected: boolean) => void;
  signal: AbortSignal;
}

/**
 * Client Server-Sent Events basé sur fetch : le jeton part dans l'en-tête Authorization
 * (EventSource ne le permet pas), avec reconnexion progressive en cas de coupure.
 */
export async function connectLiveEvents({ onEvent, onStatus, signal }: SseOptions): Promise<void> {
  let attempt = 0;
  while (!signal.aborted) {
    try {
      const token = await getAccessToken();
      const response = await fetch(`${config.apiUrl}/events`, {
        headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal,
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      onStatus(true);
      attempt = 0;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = chunk
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n');
          if (data) {
            try {
              const parsed = JSON.parse(data) as LiveEvent;
              if (parsed?.type) onEvent(parsed);
            } catch {
              /* battement de cœur ou trame partielle */
            }
          }
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch {
      if (signal.aborted) return;
    }
    onStatus(false);
    attempt += 1;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
