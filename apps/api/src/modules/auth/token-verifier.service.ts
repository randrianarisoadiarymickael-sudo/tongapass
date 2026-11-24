import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, errors, JWTPayload, jwtVerify } from 'jose';
import { APP_ROLES, AppRole } from '../../common/enums';
import type { AuthenticatedUser } from '../../common/types';
import { AppConfig } from '../../config/configuration';

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedUser>;
}

export interface KeycloakClaims extends JWTPayload {
  preferred_username?: string;
  name?: string;
  email?: string;
  azp?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}

/** Transforme les revendications Keycloak en utilisateur applicatif (seuls les rôles tp-* sont conservés). */
export function claimsToUser(claims: KeycloakClaims, audience: string): AuthenticatedUser {
  const realmRoles = claims.realm_access?.roles ?? [];
  const clientRoles = claims.resource_access?.[audience]?.roles ?? [];
  const roles = Array.from(new Set([...realmRoles, ...clientRoles])).filter((role): role is AppRole =>
    APP_ROLES.includes(role as AppRole),
  );
  return {
    sub: claims.sub ?? '',
    username: claims.preferred_username ?? claims.sub ?? 'inconnu',
    name: claims.name,
    email: claims.email,
    roles,
  };
}

/**
 * Vérifie les jetons d'accès émis par Keycloak : signature (JWKS mis en cache et
 * renouvelé automatiquement lors d'une rotation de clé), émetteur, audience et expiration.
 */
@Injectable()
export class KeycloakTokenVerifier implements TokenVerifier {
  private readonly logger = new Logger(KeycloakTokenVerifier.name);
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(config: ConfigService<AppConfig, true>) {
    const keycloak = config.get('keycloak', { infer: true });
    this.issuer = keycloak.issuer;
    this.audience = keycloak.audience;
    this.jwks = createRemoteJWKSet(new URL(keycloak.jwksUri), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const { payload } = await jwtVerify<KeycloakClaims>(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256', 'ES256', 'PS256'],
        clockTolerance: 5,
      });
      return claimsToUser(payload, this.audience);
    } catch (error) {
      if (error instanceof errors.JWTExpired) throw new UnauthorizedException('Session expirée');
      if (error instanceof errors.JOSEError) {
        this.logger.debug(`Jeton refusé : ${error.code}`);
        throw new UnauthorizedException('Jeton invalide');
      }
      this.logger.error(`Vérification du jeton impossible : ${(error as Error).message}`);
      throw new UnauthorizedException("Le fournisseur d'identité est injoignable");
    }
  }
}
