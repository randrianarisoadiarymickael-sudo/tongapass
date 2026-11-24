import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export type AppEventType = 'run.updated' | 'step.updated' | 'employee.updated' | 'audit.appended';

export interface AppEvent {
  type: AppEventType;
  at: string;
  data: Record<string, unknown>;
}

/** Bus d'événements en mémoire diffusé aux portails connectés via Server-Sent Events. */
@Injectable()
export class EventsService {
  private readonly subject = new Subject<AppEvent>();

  emit(type: AppEventType, data: Record<string, unknown>): void {
    this.subject.next({ type, at: new Date().toISOString(), data });
  }

  stream(): Observable<AppEvent> {
    return this.subject.asObservable();
  }
}
