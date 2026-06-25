export type LocalAnalyticsEvent = {
  id: string;
  name: string;
  wallet?: string;
  txHash?: string;
  serial?: string;
  createdAt: string;
};

const STORAGE_KEY = "battery_passport_level4_analytics";

export function trackLocalEvent(
  event: Omit<LocalAnalyticsEvent, "id" | "createdAt">,
) {
  const existing = getLocalEvents();

  const nextEvent: LocalAnalyticsEvent = {
    ...event,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([nextEvent, ...existing].slice(0, 100)),
  );

  return nextEvent;
}

export function getLocalEvents(): LocalAnalyticsEvent[] {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as LocalAnalyticsEvent[];
  } catch {
    return [];
  }
}

export function getWalletInteractionCount() {
  const events = getLocalEvents();
  const wallets = new Set(events.map((event) => event.wallet).filter(Boolean));

  return {
    events: events.length,
    uniqueWallets: wallets.size,
  };
}