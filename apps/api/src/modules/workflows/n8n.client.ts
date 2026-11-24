import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RunType } from '../../common/enums';
import { AppConfig } from '../../config/configuration';

export const WEBHOOK_PATHS: Record<RunType, string> = {
  [RunType.ONBOARDING]: 'tongapass/onboarding',
  [RunType.MOBILITY]: 'tongapass/mobility',
  [RunType.OFFBOARDING]: 'tongapass/offboarding',
};

export interface TriggerResult {
  executionId: string | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Déclenche les workflows n8n par webhook authentifié (en-tête secret), avec reprises. */
@Injectable()
export class N8nClient {
  private readonly logger = new Logger(N8nClient.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async trigger(type: RunType, payload: Record<string, unknown>): Promise<TriggerResult> {
    const { n8nBaseUrl, webhookToken } = this.config.get('automation', { infer: true });
    const url = `${n8nBaseUrl.replace(/\/$/, '')}/webhook/${WEBHOOK_PATHS[type]}`;
    const delays = [0, 600, 1800];
    let lastError = 'inconnue';

    for (const [attempt, delay] of delays.entries()) {
      if (delay) await sleep(delay);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-TongaPass-Token': webhookToken },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
        if (response.ok) {
          const body = (await response.json().catch(() => ({}))) as { executionId?: unknown };
          return { executionId: body.executionId != null ? String(body.executionId) : null };
        }
        lastError = `HTTP ${response.status}`;
        if (response.status < 500 && response.status !== 404) break;
      } catch (error) {
        lastError = (error as Error).message;
      }
      this.logger.warn(`Déclenchement n8n ${type} : tentative ${attempt + 1} échouée (${lastError})`);
    }
    throw new ServiceUnavailableException(`Le moteur d’automatisation n8n est injoignable (${lastError})`);
  }
}
