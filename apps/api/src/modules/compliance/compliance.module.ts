import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SYSTEM_ACTOR } from '../../common/types';
import { ComplianceCheck } from './compliance-check.entity';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { KeycloakDirectoryClient } from './keycloak-directory.client';

/** Contrôle automatique chaque nuit à 2 h (heure de Madagascar). */
@Injectable()
export class ComplianceScheduler {
  private readonly logger = new Logger(ComplianceScheduler.name);

  constructor(
    private readonly compliance: ComplianceService,
    private readonly directory: KeycloakDirectoryClient,
  ) {}

  @Cron('0 2 * * *', { name: 'compliance-nightly', timeZone: 'Indian/Antananarivo', disabled: process.env.NODE_ENV === 'test' })
  async nightly(): Promise<void> {
    if (!this.directory.enabled) return;
    try {
      await this.compliance.scan(SYSTEM_ACTOR);
    } catch (error) {
      this.logger.error(`Contrôle nocturne en échec : ${(error as Error).message}`);
    }
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([ComplianceCheck])],
  controllers: [ComplianceController],
  providers: [ComplianceService, KeycloakDirectoryClient, ComplianceScheduler],
  exports: [ComplianceService],
})
export class ComplianceModule {}
