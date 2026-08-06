/**
 * Display mode preference and resolution.
 *
 * `preference` is what the operator chose and may be "system". `resolved` is
 * the concrete palette applied to the document, so `globals.css` defines each
 * palette exactly once instead of duplicating it under a media query.
 */
export const displayPreferences = [
  "system",
  "day",
  "night",
  "contrast",
] as const;

export type DisplayPreference = (typeof displayPreferences)[number];

export type ResolvedDisplayMode = "day" | "night" | "contrast";

export const displayStorageKey = "race-planner-display-mode";

export function isDisplayPreference(
  value: string | null,
): value is DisplayPreference {
  return (
    value !== null && (displayPreferences as readonly string[]).includes(value)
  );
}

export function resolveDisplayMode(
  preference: DisplayPreference,
  prefersDark: boolean,
): ResolvedDisplayMode {
  if (preference === "system") return prefersDark ? "night" : "day";
  return preference;
}

/**
 * Runs before first paint, so the stored palette is applied without a flash of
 * the day theme. Kept as a string because it is injected as an inline script;
 * it must stay dependency-free and side-effect-safe if it throws.
 */
export const displayModeInitScript = `(function(){try{
var k=${JSON.stringify(displayStorageKey)};
var p=localStorage.getItem(k);
if(p!=="day"&&p!=="night"&&p!=="contrast")p="system";
var d=p==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"night":"day"):p;
var e=document.documentElement;
e.dataset.displayPreference=p;
e.dataset.displayMode=d;
}catch(_){}})();`;

const darkQuery = "(prefers-color-scheme: dark)";

/**
 * The document element is the source of truth for the active preference: the
 * inline init script sets it before React runs. Exposing it as an external
 * store lets components read it through `useSyncExternalStore`, which avoids
 * both a hydration mismatch and setting state inside an effect.
 */
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToDisplayPreference(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab may change the stored preference.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readDisplayPreference(): DisplayPreference {
  const value = document.documentElement.dataset.displayPreference ?? null;
  return isDisplayPreference(value) ? value : "system";
}

/** Server render has no document, so it always assumes the device default. */
export function readServerDisplayPreference(): DisplayPreference {
  return "system";
}

/** Writes the preference to the document, storage, and any subscribers. */
export function setDisplayPreference(preference: DisplayPreference): void {
  const root = document.documentElement;
  root.dataset.displayPreference = preference;
  root.dataset.displayMode = resolveDisplayMode(
    preference,
    window.matchMedia(darkQuery).matches,
  );

  if (preference === "system") {
    window.localStorage.removeItem(displayStorageKey);
  } else {
    window.localStorage.setItem(displayStorageKey, preference);
  }

  emit();
}

/** Re-resolves the palette when the device switches appearance. */
export function subscribeToDeviceAppearance(): () => void {
  const media = window.matchMedia(darkQuery);
  const onChange = () => {
    if (readDisplayPreference() === "system") setDisplayPreference("system");
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
