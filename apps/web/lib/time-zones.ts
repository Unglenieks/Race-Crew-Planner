/**
 * Canonical IANA time zones supported by modern browser Intl implementations.
 * UTC is intentionally included because `Intl.supportedValuesOf` omits it even
 * though it is a valid and useful event time zone.
 */
export const eventTimeZones = ["UTC", ...Intl.supportedValuesOf("timeZone")];
