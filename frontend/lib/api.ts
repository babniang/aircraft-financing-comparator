import type {
  CompareRequest,
  CompareResponse,
  MarketContext,
  ReferenceResponse,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: "timeout" | "network" | "http",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 25000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Only set Content-Type when there is actually a body. Sending it on a GET
    // makes the request non-simple, which forces a CORS preflight OPTIONS on
    // every call, doubling the round trips against a cold backend for nothing.
    const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) ?? {}) };
    if (init?.body != null) headers["Content-Type"] = "application/json";

    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
    });
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.detail) detail = String(body.detail);
      } catch {
        /* ignore */
      }
      throw new ApiError(detail, "http");
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("The model took too long to respond.", "timeout");
    }
    throw new ApiError("Could not reach the model.", "network");
  } finally {
    clearTimeout(timer);
  }
}

export function getReference(): Promise<ReferenceResponse> {
  return request<ReferenceResponse>("/api/reference", { method: "GET" }, 25000);
}

export function getMarketContext(): Promise<MarketContext> {
  return request<MarketContext>("/api/market-context", { method: "GET" }, 25000);
}

export function postCompare(body: CompareRequest): Promise<CompareResponse> {
  return request<CompareResponse>(
    "/api/compare",
    { method: "POST", body: JSON.stringify(body) },
    25000,
  );
}

/**
 * Download the formula-driven Excel model for the current inputs. Streams the
 * workbook straight from the backend and hands the browser a save dialog.
 */
export async function downloadExcelModel(body: CompareRequest): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 40000);
  try {
    const res = await fetch(`${BASE_URL}/api/export.xlsx`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = `Export failed (${res.status})`;
      try {
        const j = await res.json();
        if (j?.detail) detail = String(j.detail);
      } catch {
        /* ignore */
      }
      throw new ApiError(detail, "http");
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] ?? "financing_model.xlsx";

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("The export took too long. Try again.", "timeout");
    }
    throw new ApiError("Could not reach the model to export.", "network");
  } finally {
    clearTimeout(timer);
  }
}
