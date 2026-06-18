import { apiGet, apiPost, apiDelete } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: number;
  familyId: string;
  title: string;
  date: string;         // YYYY-MM-DD
  time?: string;        // HH:MM or undefined
  assignee: string;
  completed: boolean;
  completedBy?: string;
  points: number;
  icon: string;
  color: string;
  memo: string;
  createdAt: string;
}

// ─── Memo encoding (icon + color stored in memo field) ───────────────────────
// Format: JSON{"i":"emoji","c":"#hex"}|~|user memo text
// If no user memo:  JSON{"i":"emoji","c":"#hex"}

const SEP = '|~|';

function encodeMemo(icon: string, color: string, memo: string): string {
  const meta = JSON.stringify({ i: icon, c: color });
  return memo.trim() ? `${meta}${SEP}${memo}` : meta;
}

function decodeMemo(raw?: string | null): { icon: string; color: string; memo: string } {
  const fallback = { icon: '🗓', color: '#7C5CBF', memo: '' };
  if (!raw) return fallback;
  try {
    const sepIdx = raw.indexOf(SEP);
    if (sepIdx === -1) {
      const m = JSON.parse(raw);
      if (m.i) return { icon: m.i, color: m.c ?? fallback.color, memo: '' };
    } else {
      const m = JSON.parse(raw.slice(0, sepIdx));
      if (m.i) return { icon: m.i, color: m.c ?? fallback.color, memo: raw.slice(sepIdx + SEP.length) };
    }
  } catch {}
  return { ...fallback, memo: raw };
}

function decode(raw: any): CalendarEvent {
  const { icon, color, memo } = decodeMemo(raw.memo);
  return { ...raw, icon, color, memo };
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function getEvents(familyId: number | string): Promise<CalendarEvent[]> {
  const raw = await apiGet<any[]>(`/api/events/${familyId}`);
  return raw.map(decode);
}

export async function createEvent(data: {
  familyId: number | string;
  title: string;
  date: string;
  time?: string;
  assignee?: string;
  icon: string;
  color: string;
  memo?: string;
}): Promise<CalendarEvent> {
  const { icon, color, memo = '', familyId, title, date, time, assignee = '未定' } = data;
  const raw = await apiPost<any>('/api/events', {
    familyId,
    title,
    date,
    time: time || undefined,
    assignee,
    memo: encodeMemo(icon, color, memo),
  });
  return decode(raw);
}

export async function updateEvent(
  id: number,
  data: Partial<{ title: string; date: string; time: string; assignee: string; icon: string; color: string; memo: string }>,
  current: CalendarEvent,
): Promise<CalendarEvent> {
  const icon  = data.icon  ?? current.icon;
  const color = data.color ?? current.color;
  const memo  = data.memo  ?? current.memo;
  const raw = await apiPost<any>(`/api/events/${id}`, {
    title:    data.title    ?? current.title,
    date:     data.date     ?? current.date,
    time:     data.time     !== undefined ? (data.time || undefined) : current.time,
    assignee: data.assignee ?? current.assignee,
    memo:     encodeMemo(icon, color, memo),
  });
  return decode(raw);
}

export async function completeEvent(id: number, completedBy: string): Promise<CalendarEvent> {
  const raw = await apiPost<any>(`/api/events/${id}/complete`, { completedBy });
  return decode(raw);
}

export async function deleteEvent(id: number): Promise<void> {
  return apiDelete(`/api/events/${id}`);
}
