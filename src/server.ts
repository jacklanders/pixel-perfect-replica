import * as Sentry from "@sentry/cloudflare";

import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  initServerObservability,
  reportServerError,
  sentryWorkerOptions,
  type WaitUntilContext,
} from "./lib/server/observability";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  ctx: WaitUntilContext,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const error = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(error);
  reportServerError(error, { stage: "ssr_h3_swallowed", status: 500 }, ctx);
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default Sentry.withSentry(() => sentryWorkerOptions(), {
  async fetch(request: Request, env: unknown, ctx: WaitUntilContext) {
    // Sin VITE_POSTHOG_KEY es un no-op. Con la key presente precarga el cliente
    // de PostHog para que el primer evento del request ya lo encuentre listo.
    initServerObservability();
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response, ctx);
    } catch (error) {
      console.error(error);
      reportServerError(error, { stage: "worker_fetch", url: safeUrl(request) }, ctx);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
});

/** Solo path + método: la query puede traer datos del usuario (tokens, ids). */
function safeUrl(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}
