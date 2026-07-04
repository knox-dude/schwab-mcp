/** Parse a YYYY-MM-DD string to a Date object, or return undefined. */
export function parseDate(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date format: ${value}. Expected YYYY-MM-DD.`);
  }
  return value;
}

/**
 * Convert a date or datetime string into the ISO-8601 date-time format
 * (`yyyy-MM-dd'T'HH:mm:ss.SSSZ`) that Schwab's Trader API requires for
 * transaction time ranges (a "ZonedDateTime"). A plain `YYYY-MM-DD` date is
 * expanded to the start (00:00:00.000Z) or end (23:59:59.999Z) of that UTC
 * day; any other parseable datetime is normalized via `Date`. Returns
 * `undefined` for empty input so callers can apply their own defaults.
 */
export function toSchwabDateTime(
  value: string | undefined | null,
  boundary: "start" | "end" = "start",
): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  // Plain calendar date → expand to the start or end of that UTC day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return boundary === "end"
      ? `${trimmed}T23:59:59.999Z`
      : `${trimmed}T00:00:00.000Z`;
  }
  // Otherwise accept any parseable datetime and normalize it to ISO-8601.
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    throw new Error(
      `Invalid date/datetime: ${value}. Expected YYYY-MM-DD or an ISO-8601 date-time.`,
    );
  }
  return d.toISOString();
}

/** Parse an ISO datetime string, or return undefined. */
export function parseDatetime(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  // Validate it's parseable
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid datetime: ${value}. Expected ISO format.`);
  }
  return value;
}

/** Convert ISO datetime string to epoch milliseconds, or return undefined. */
export function toEpochMs(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid datetime: ${value}`);
  }
  return d.getTime();
}

/** Format a result for MCP tool output — compact JSON string. */
export function formatResult(data: unknown): string {
  if (typeof data === "string") return data;
  return JSON.stringify(data);
}
