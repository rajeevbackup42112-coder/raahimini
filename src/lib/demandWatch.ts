'use client';

const DEMAND_WATCH_KEY = 'raahi_active_demand_watch';

export type DemandWatch = {
  passengerId: string;
  routeId: string;
  intentId: string;
  expiresAt: string;
};

export function saveDemandWatch(passengerId: string, routeId: string, intentId: string, minutes = 30) {
  if (typeof window === 'undefined') return;
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const watch: DemandWatch = { passengerId, routeId, intentId, expiresAt };
  localStorage.setItem(DEMAND_WATCH_KEY, JSON.stringify(watch));
}

export function readDemandWatch(passengerId: string): DemandWatch | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(DEMAND_WATCH_KEY);
  if (!raw) return null;
  try {
    const watch = JSON.parse(raw) as DemandWatch;
    if (!watch.passengerId || !watch.routeId || !watch.intentId || !watch.expiresAt) throw new Error('invalid watch');
    if (watch.passengerId !== passengerId) return null;
    if (new Date(watch.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(DEMAND_WATCH_KEY);
      return null;
    }
    return watch;
  } catch {
    localStorage.removeItem(DEMAND_WATCH_KEY);
    return null;
  }
}

export function clearDemandWatch(passengerId: string, intentId?: string) {
  if (typeof window === 'undefined') return;
  const watch = readDemandWatch(passengerId);
  if (!watch) return;
  if (intentId && watch.intentId !== intentId) return;
  localStorage.removeItem(DEMAND_WATCH_KEY);
}
