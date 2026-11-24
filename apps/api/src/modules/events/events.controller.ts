import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { interval, map, merge, Observable } from 'rxjs';
import { EventsService } from './events.service';

@ApiTags('Temps réel')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Sse()
  @ApiOperation({
    summary: 'Flux Server-Sent Events des exécutions et étapes',
    description:
      'Le portail ouvre ce flux avec fetch() et l’en-tête Authorization (le jeton ne transite jamais dans l’URL).',
  })
  @ApiProduces('text/event-stream')
  stream(): Observable<MessageEvent> {
    const heartbeat = interval(25_000).pipe(
      map((): MessageEvent => ({ type: 'heartbeat', data: { at: new Date().toISOString() } })),
    );
    const events = this.events
      .stream()
      .pipe(map((event): MessageEvent => ({ type: event.type, data: event })));
    return merge(events, heartbeat);
  }
}
