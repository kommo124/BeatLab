/**
 * Static file server for the Telegram Mini App.
 * Build the bundle first: `bun run web:build`
 */
import { join, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dir, "..", "..", "web", "public");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";

    const filePath = resolve(join(ROOT, pathname));
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }

    const type = MIME[filePath.slice(filePath.lastIndexOf("."))] ?? "application/octet-stream";
    return new Response(file, {
      headers: {
        "content-type": type,
        "cache-control": "no-store",
      },
    });
  },
});

console.log(`🌐 Mini app running at http://localhost:${server.port}`);
