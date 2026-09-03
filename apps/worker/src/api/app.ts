import { Hono } from "hono";
import type { Env } from "../env";
import { adminRoutes } from "./admin";
import { publicRoutes } from "./public";
import { pushRoutes } from "./push";
import { reportRoutes } from "./reports";

export const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": c.req.header("origin") ?? "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type,authorization",
        "access-control-max-age": "86400"
      }
    });
  }
  await next();
  const origin = c.req.header("origin");
  if (origin && (origin === c.env.APP_URL || origin.startsWith("http://localhost"))) {
    c.header("access-control-allow-origin", origin);
    c.header("vary", "Origin");
  }
});

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "internal error" }, 500);
});

app.route("/", publicRoutes);
app.route("/", reportRoutes);
app.route("/", pushRoutes);
app.route("/", adminRoutes);

app.notFound((c) => c.json({ error: "not found" }, 404));
