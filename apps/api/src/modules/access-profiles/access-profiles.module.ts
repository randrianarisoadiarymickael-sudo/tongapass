import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessProfile } from './access-profile.entity';
import { AccessProfilesController } from './access-profiles.controller';
import { AccessProfilesService } from './access-profiles.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccessProfile])],
  controllers: [AccessProfilesController],
  providers: [AccessProfilesService],
  exports: [AccessProfilesService],
})
export class AccessProfilesModule {}
