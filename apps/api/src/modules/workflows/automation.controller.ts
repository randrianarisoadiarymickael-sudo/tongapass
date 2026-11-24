import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AutomationOnly } from '../../common/decorators/automation.decorator';
import { HmacSignatureGuard } from '../../common/guards/hmac-signature.guard';
import { AutomationEventDto } from './dto/automation-event.dto';
import { WorkflowsService } from './workflows.service';

@ApiTags('Automatisation (n8n)')
@Controller('automation')
export class AutomationController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Post('events')
  @HttpCode(200)
  @AutomationOnly()
  @SkipThrottle()
  @UseGuards(HmacSignatureGuard)
  @ApiOperation({
    summary: 'Recevoir un événement de progression envoyé par n8n',
    description:
      'Authentification machine à machine : signature `sha256=HMAC(secret, timestamp + "." + corps)` ' +
      'dans X-TongaPass-Signature, horodatage UNIX dans X-TongaPass-Timestamp (fenêtre de 5 min).',
  })
  @ApiHeader({ name: 'X-TongaPass-Signature', required: true })
  @ApiHeader({ name: 'X-TongaPass-Timestamp', required: true })
  @ApiOkResponse({ description: 'Événement pris en compte (ou ignoré si l’exécution est close)' })
  receive(@Body() dto: AutomationEventDto) {
    return this.workflows.applyEvent(dto);
  }
}
