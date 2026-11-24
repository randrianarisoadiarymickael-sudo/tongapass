import { Popover } from 'radix-ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { IconPulse } from '@/components/icons';
import { useLive } from '@/hooks/useLiveEvents';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { TONE_TEXT } from '@/lib/labels';
import { describeLiveEvent } from '@/lib/live-event';

/* ------------------------------------------------------------------ Fil d'activité */


/** Bouton « activité en direct » de la barre supérieure : compteur de nouveautés et fil des derniers événements. */
export function LiveActivity() {
  const { events, unread, markRead, connected } = useLive();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && unread) markRead();
  }, [open, unread, markRead]);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) markRead();
      }}
    >
      <Popover.Trigger
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink"
        aria-label={unread ? `Activité en direct, ${unread} nouveauté${unread > 1 ? 's' : ''}` : 'Activité en direct'}
        title="Activité en direct"
      >
        <span key={events[0]?.seq ?? 0} className={events.length && connected ? 'incoming-signal' : undefined}><IconPulse className="size-[18px]" /></span>
        {unread > 0 ? (
          <span
            className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-on-brand ring-2 ring-[var(--tp-canvas)]"
            aria-hidden="true"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={10} collisionPadding={12} className="panel-raised z-50 w-[min(92vw,380px)] overflow-hidden rounded-lg" aria-label="Activité en direct">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Activité en direct</p>
              <p className="text-xs text-ink-3">Derniers événements reçus de n8n et de l’API</p>
            </div>
            <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', connected ? 'text-success' : 'text-ink-3')}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              {connected ? 'En direct' : 'Hors ligne'}
            </span>
          </div>
          {events.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium">Aucun événement pour l’instant</p>
              <p className="mt-1 text-[13px] text-ink-3">Les étapes exécutées par n8n s’afficheront ici.</p>
            </div>
          ) : (
            <ol className="max-h-[min(60vh,420px)] divide-y divide-line overflow-y-auto">
              {events.map((event) => {
                  const item = describeLiveEvent(event);
                  const body = (
                    <>
                      <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-hover', TONE_TEXT[item.tone])}>
                        <item.icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">{item.title}</span>
                        <span className="block truncate text-xs text-ink-3">{item.detail}</span>
                      </span>
                      <span className="shrink-0 pt-0.5 text-[11px] tabular text-ink-3">{formatRelative(event.at)}</span>
                    </>
                  );
                  return (
                    <li key={event.seq} className="activity-entry">
                      {item.to ? (
                        <Popover.Close asChild>
                          <Link to={item.to} className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-hover">
                            {body}
                          </Link>
                        </Popover.Close>
                      ) : (
                        <div className="flex items-start gap-3 px-4 py-2.5">{body}</div>
                      )}
                    </li>
                  );
                })}
            </ol>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
