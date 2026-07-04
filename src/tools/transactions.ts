import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SchwabClient } from "../client.js";
import { toSchwabDateTime } from "./utils.js";

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

// Schwab's transactions endpoint requires the `types` query param and accepts
// a single TransactionType per request. To return "all" transactions we query
// each type and merge. Full enum from the Trader API spec (TransactionType).
const ALL_TRANSACTION_TYPES = [
  "TRADE",
  "RECEIVE_AND_DELIVER",
  "DIVIDEND_OR_INTEREST",
  "ACH_RECEIPT",
  "ACH_DISBURSEMENT",
  "CASH_RECEIPT",
  "CASH_DISBURSEMENT",
  "ELECTRONIC_FUND",
  "WIRE_OUT",
  "WIRE_IN",
  "JOURNAL",
  "MEMORANDUM",
  "MARGIN_CALL",
  "MONEY_MARKET",
  "SMA_ADJUSTMENT",
] as const;

export function register(server: McpServer, client: SchwabClient): void {
  server.tool(
    "get_transactions",
    "Get transaction history (trades, deposits, dividends, etc.) for an account. Filter by date range (max 60 days past), type, symbol. Types: TRADE, DIVIDEND_OR_INTEREST, ACH_RECEIPT, ACH_DISBURSEMENT, etc.",
    {
      account_hash: z
        .string()
        .describe(
          "Account hash for the Schwab account (from get_account_numbers)",
        ),
      start_date: z
        .string()
        .optional()
        .describe(
          "Start date (YYYY-MM-DD or ISO-8601 date-time, max 60 days past, default 60 days ago). Sent to Schwab as a full ISO-8601 timestamp.",
        ),
      end_date: z
        .string()
        .optional()
        .describe(
          "End date (YYYY-MM-DD or ISO-8601 date-time, default now). Sent to Schwab as a full ISO-8601 timestamp.",
        ),
      transaction_type: z
        .string()
        .optional()
        .describe(
          "Filter by type(s) (comma-separated): TRADE, DIVIDEND_OR_INTEREST, ACH_RECEIPT, etc. Default all.",
        ),
      symbol: z
        .string()
        .optional()
        .describe("Filter transactions by security symbol"),
    },
    async ({ account_hash, start_date, end_date, transaction_type, symbol }) => {
      // Schwab's transactions endpoint requires both bounds as full ISO-8601
      // date-times. Default to the maximum supported window (last 60 days).
      const now = new Date();
      const endDate = toSchwabDateTime(end_date, "end") ?? now.toISOString();
      const startDate =
        toSchwabDateTime(start_date, "start") ??
        new Date(now.getTime() - SIXTY_DAYS_MS).toISOString();

      // `types` is required by Schwab and takes one TransactionType per call.
      // Query each requested type (all of them when unfiltered) and merge; an
      // error on any call propagates rather than silently yielding [].
      const types = transaction_type
        ? transaction_type.split(",").map((t) => t.trim()).filter(Boolean)
        : [...ALL_TRANSACTION_TYPES];

      const responses = await Promise.all(
        types.map((type) =>
          client.getTransactions(account_hash, {
            startDate,
            endDate,
            types: type,
            symbol,
          }),
        ),
      );

      const merged: unknown[] = [];
      const seen = new Set<string>();
      for (const resp of responses) {
        if (!Array.isArray(resp)) continue;
        for (const txn of resp) {
          const id = String((txn as Record<string, unknown>)?.activityId ?? "");
          const key = id || JSON.stringify(txn);
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(txn);
          }
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(merged) }],
      };
    },
  );

  server.tool(
    "get_transaction",
    "Get detailed info for a specific transaction by ID. Params: account_hash, transaction_id.",
    {
      account_hash: z
        .string()
        .describe("Account hash for the Schwab account"),
      transaction_id: z
        .string()
        .describe("Transaction ID (from get_transactions)"),
    },
    async ({ account_hash, transaction_id }) => {
      const result = await client.getTransaction(account_hash, transaction_id);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );
}
