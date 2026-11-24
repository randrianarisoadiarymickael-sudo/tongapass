import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

export interface FieldError {
  field: string;
  messages: string[];
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: FieldError[];
  requestId?: string;
}

const TITLES: Record<number, string> = {
  400: 'Requête invalide',
  401: 'Authentification requise',
  403: 'Accès refusé',
  404: 'Ressource introuvable',
  409: 'Conflit',
  422: 'Données non traitables',
  429: 'Trop de requêtes',
  500: 'Erreur interne',
  502: 'Service tiers indisponible',
  503: 'Service indisponible',
};

/** Toutes les erreurs sont renvoyées au format RFC 9457 (application/problem+json). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Une erreur inattendue est survenue. Réessayez ou contactez un administrateur.';
    let errors: FieldError[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        detail = body;
      } else if (typeof body === 'object' && body !== null) {
        const payload = body as { message?: unknown; errors?: FieldError[] };
        if (Array.isArray(payload.errors)) errors = payload.errors;
        if (typeof payload.message === 'string') detail = payload.message;
        else if (Array.isArray(payload.message)) detail = payload.message.join(' · ');
      }
    } else if (exception instanceof QueryFailedError) {
      const code = (exception as QueryFailedError & { code?: string }).code;
      if (code === '23505') {
        status = HttpStatus.CONFLICT;
        detail = "Cette ressource existe déjà (contrainte d'unicité).";
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    } else {
      const error = exception as Error;
      this.logger.error(error?.message ?? String(exception), error?.stack);
    }

    if (status >= 500 && exception instanceof HttpException) {
      this.logger.warn(`${status} ${request.method} ${request.originalUrl} : ${detail}`);
    }

    const problem: ProblemDetails = {
      type: `https://tongapass.dev/problems/${status}`,
      title: TITLES[status] ?? 'Erreur',
      status,
      detail,
      instance: request.originalUrl ?? request.url,
      ...(errors ? { errors } : {}),
      ...(request.id ? { requestId: String(request.id) } : {}),
    };

    response.status(status).type('application/problem+json').json(problem);
  }
}
