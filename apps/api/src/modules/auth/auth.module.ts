import { Global, Module } from '@nestjs/common';
import { KeycloakTokenVerifier, TOKEN_VERIFIER } from './token-verifier.service';
import { MeController } from './me.controller';

@Global()
@Module({
  controllers: [MeController],
  providers: [{ provide: TOKEN_VERIFIER, useClass: KeycloakTokenVerifier }],
  exports: [TOKEN_VERIFIER],
})
export class AuthModule {}
