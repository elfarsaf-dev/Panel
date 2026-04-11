import { Router, type Request, type Response, type NextFunction } from "express";

const router = Router();

const CF_PROXY_URL = "https://panelv1.elfar.my.id";

async function handleProxy(req: Request, res: Response, _next: NextFunction) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      res.status(401).json({ success: false, errors: [{ message: "Authorization header required" }] });
      return;
    }

    // req.path here is the part after /cf-proxy
    const cfPath = req.path === "/" ? "" : req.path;
    const qs = Object.keys(req.query).length
      ? "?" + new URLSearchParams(req.query as Record<string, string>).toString()
      : "";
    const targetUrl = `${CF_PROXY_URL}${cfPath}${qs}`;

    const proxyHeaders: Record<string, string> = {
      Authorization: authHeader,
      "Content-Type": req.headers["content-type"] ?? "application/json",
    };

    let body: string | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: proxyHeaders,
      body,
    });

    const contentType = upstream.headers.get("content-type") ?? "application/json";
    const text = await upstream.text();

    res.status(upstream.status).set("Content-Type", contentType).send(text);
  } catch (err) {
    res.status(502).json({
      success: false,
      errors: [{ message: `Proxy error: ${err instanceof Error ? err.message : String(err)}` }],
    });
  }
}

// Mount as middleware so all paths under /cf-proxy/* are matched
router.use("/cf-proxy", handleProxy);

export default router;
