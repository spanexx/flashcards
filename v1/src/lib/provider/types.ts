// WHY: A provider call needs the same four facts in the old local lane and in
// the browser lane. Keeping the type alone in a pure module lets both import it
// without pulling in file access or the operating-system key store.
// PACK: browser-app
// 2026-10-20 opencode: extracted from provider/config.ts.

/** Everything a provider call needs, resolved fresh. */
export interface ProviderConfig {
  url: string;
  model: string;
  key: string;
  swappedForWsl: boolean;
  /** The service root that can carry a call the browser cannot make. */
  relayBase?: string;
  /** True when this host is known to refuse browser calls. */
  preferRelay?: boolean;
}
