import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { connectLiveEvents, type LiveEvent } from '@/lib/sse';
import { keys } from './queries';

/** Nombre d'événements conservés pour le fil d'activité en direct. */
const BUFFER = 30;

export interface LiveEntry extends LiveEvent {
  /** Identifiant local, croissant : sert de clé d'animation. */
  seq: number;
}

export interface LiveState {
  connected: boolean;
  lastEvent: LiveEvent | null;
  /** Derniers événements reçus, du plus récent au plus ancien. */
  events: LiveEntry[];
  /** Événements arrivés depuis la dernière ouverture du fil d'activité. */
  unread: number;
  markRead: () => void;
}

export const LiveContext = createContext<LiveState>({ connected: false, lastEvent: null, events: [], unread: 0, markRead: () => undefined });

/**
 * Ouvre le flux SSE de l'API et invalide les données concernées à chaque événement :
 * les étapes d'un workflow s'allument en direct sans rechargement. Les événements sont
 * aussi conservés (30 derniers) pour le fil d’activité.
 */
export function useLiveEventsConnection(enabled: boolean): LiveState {
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<LiveEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const pending = new Set<string>();
    const activeRuns = new Set<string>();
    let timer: number | null = null;
    let hasConnected = false;

    const flush = () => {
      timer = null;
      for (const key of pending) void client.invalidateQueries({ queryKey: JSON.parse(key) as unknown[] });
      pending.clear();
    };
    const schedule = (queryKey: readonly unknown[]) => {
      pending.add(JSON.stringify(queryKey));
      timer ??= window.setTimeout(flush, 250);
    };

    void connectLiveEvents({
      signal: controller.signal,
      onStatus: (online) => {
        if (controller.signal.aborted) return;
        setConnected(online);
        if (!online) activeRuns.clear();
        if (online && hasConnected) {
          for (const key of ['dashboard', 'runs', 'run', 'employees', 'employee', 'compliance', 'employee-compliance', 'employee-history', 'audit']) schedule([key]);
        }
        if (online) hasConnected = true;
      },
      onEvent: (event) => {
        if (controller.signal.aborted) return;
        const { runId, employeeId } = event.data as { runId?: string; employeeId?: string };
        if (runId) schedule(keys.run(runId));
        if (employeeId) schedule(keys.employee(employeeId));
        schedule(['runs']);
        schedule(keys.dashboard);
        if (event.type === 'employee.updated') {
          schedule(['employees']);
          if (event.data.scope === 'compliance') {
            schedule(keys.compliance);
            schedule(['employee-compliance']);
          }
        }

        // Chaque rappel n8n peut confirmer à nouveau que la même exécution est en cours.
        if (event.type === 'run.updated' && runId) {
          if (event.data.status === 'RUNNING') {
            if (activeRuns.has(runId)) return;
            activeRuns.add(runId);
          } else {
            activeRuns.delete(runId);
          }
        }
        seq.current += 1;
        const entry: LiveEntry = { ...event, seq: seq.current };
        setEvents((previous) => [entry, ...previous].slice(0, BUFFER));
        setUnread((count) => Math.min(count + 1, 99));
      },
    });
    return () => {
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [client, enabled]);

  const markRead = useCallback(() => setUnread(0), []);

  return { connected, lastEvent: events[0] ?? null, events, unread, markRead };
}

export const useLive = () => useContext(LiveContext);
