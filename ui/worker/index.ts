/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  IMBA_API_ORIGIN?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const GAME_SESSION_COOKIE = "imba_session";
const COUNTED_PLAYER_COOKIE = "imba_counted_player";
const COUNTED_PLAYER_MAX_AGE = 60 * 60 * 24 * 365;

function hasCookie(request: Request, name: string): boolean {
  const cookies = request.headers.get("cookie") ?? "";
  return cookies.split(";").some((part) => part.trim().startsWith(`${name}=`));
}

function setsCookie(headers: Headers, name: string): boolean {
  return (headers.get("set-cookie") ?? "").includes(`${name}=`);
}

async function incrementMetrics(db: D1Database | undefined, keys: string[]): Promise<void> {
  if (!db || keys.length === 0) return;
  const timestamp = Date.now();
  const statements = keys.map((key) => db.prepare(`
    INSERT INTO author_metrics (key, value, updated_at)
    VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = value + 1,
      updated_at = excluded.updated_at
  `).bind(key, timestamp));
  await db.batch(statements);
}

function recordMetrics(ctx: ExecutionContext, db: D1Database | undefined, keys: string[]): void {
  if (!db || keys.length === 0) return;
  ctx.waitUntil(incrementMetrics(db, keys).catch((error) => {
    console.error("author metric write failed", error);
  }));
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const configuredOrigin = env.IMBA_API_ORIGIN?.trim();
      const localRequest = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      const apiOrigin = configuredOrigin || (localRequest ? "http://127.0.0.1:8765" : "");
      if (!apiOrigin) {
        return Response.json(
          { ok: false, error: "The public Lean runtime is not configured yet." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
      const upstream = new URL(`${url.pathname}${url.search}`, apiOrigin);
      const headers = new Headers(request.headers);
      headers.delete("host");
      const body = request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer();
      const upstreamResponse = await fetch(new Request(upstream, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
      }));
      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.set("Cache-Control", "no-store");

      const isNewRuntimeSession = request.method === "GET"
        && url.pathname === "/api/state"
        && upstreamResponse.ok
        && setsCookie(responseHeaders, GAME_SESSION_COOKIE);
      if (isNewRuntimeSession) {
        recordMetrics(ctx, env.DB, ["launches_total"]);
      }

      const isSuccessfulAction = request.method === "POST"
        && url.pathname === "/api/action"
        && upstreamResponse.ok;
      if (isSuccessfulAction) {
        const metricKeys = ["actions_total"];
        if (!hasCookie(request, COUNTED_PLAYER_COOKIE)) {
          metricKeys.push("players_approx");
          responseHeaders.append(
            "Set-Cookie",
            `${COUNTED_PLAYER_COOKIE}=1; Path=/; Max-Age=${COUNTED_PLAYER_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
          );
        }
        recordMetrics(ctx, env.DB, metricKeys);
      }

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
