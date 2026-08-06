/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  resumeActiveMonitoringRun,
  runMonitoringHeartbeat,
  startMonitoringRun,
} from "./monitoring";
import { verifyGithubActionsScheduler } from "./github-actions-oidc";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
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

interface ScheduledEvent {
  scheduledTime: number;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/scheduler/heartbeat") {
      if (request.method !== "POST") {
        return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 405 });
      }
      if (!(await verifyGithubActionsScheduler(request))) {
        return Response.json({ error: "유효하지 않은 스케줄러 요청입니다." }, { status: 401 });
      }
      await runMonitoringHeartbeat(env, Date.now());
      return Response.json({ ok: true });
    }

    if (
      url.pathname === "/api/monitoring-runs" &&
      request.method === "POST"
    ) {
      return startMonitoringRun(request, env);
    }

    if (
      url.pathname === "/api/monitoring-runs" &&
      request.method === "GET"
    ) {
      await resumeActiveMonitoringRun(env);
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
  async scheduled(
    controller: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(runMonitoringHeartbeat(env, controller.scheduledTime));
  },
};

export default worker;
