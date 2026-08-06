import { describe, expect, it } from "vitest";
import {
  analyticsConsentStorageKey,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from "./analytics-consent";

describe("analytics consent storage", () => {
  it("keeps analytics pending when a storage read fails", () => {
    expect(
      readAnalyticsConsent({
        getItem: () => {
          throw new Error("Storage is unavailable");
        },
      }),
    ).toBe("pending");
  });

  it("keeps the requested choice in memory when a storage write fails", () => {
    writeAnalyticsConsent("granted", {
      setItem: () => {
        throw new Error("Storage is unavailable");
      },
    });

    expect(
      readAnalyticsConsent({
        getItem: () => {
          throw new Error("Storage is unavailable");
        },
      }),
    ).toBe("granted");
  });

  it("uses the stored choice when storage is available", () => {
    let storedValue: string | null = null;
    const storage = {
      getItem: (key: string) =>
        key === analyticsConsentStorageKey ? storedValue : null,
      setItem: (key: string, value: string) => {
        if (key === analyticsConsentStorageKey) {
          storedValue = value;
        }
      },
    };

    writeAnalyticsConsent("denied", storage);

    expect(readAnalyticsConsent(storage)).toBe("denied");
  });
});
