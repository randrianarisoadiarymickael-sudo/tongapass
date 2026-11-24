import { SetMetadata } from '@nestjs/common';

export const IS_AUTOMATION_KEY = 'isAutomation';
/**
 * Route appelée par n8n : l'authentification se fait par signature HMAC
 * (voir HmacSignatureGuard) et non par jeton utilisateur.
 */
export const AutomationOnly = () => SetMetadata(IS_AUTOMATION_KEY, true);
