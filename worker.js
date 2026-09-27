export default {
  async fetch(request, env) {

    // ======================
    // CONFIG FROM ENVIRONMENT (Secrets/Variables)
    // ======================
    const API_TOKEN = env?.API_TOKEN || "";
    const ACCOUNT_ID = env?.ACCOUNT_ID || "";

    const AUTH_USER = env?.AUTH_USER || "";
    const AUTH_PASS = env?.AUTH_PASS || "";

    // ======================
    // CORS PREFLIGHT
    // ======================
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ======================
    // BASIC AUTH
    // ======================
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Basic ")) {
      return new Response("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Secure API"',
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    let user = "";
    let pass = "";
    try {
      const decoded = atob(auth.split(" ")[1] || "");
      const colonIndex = decoded.indexOf(":");
      if (colonIndex !== -1) {
        user = decoded.slice(0, colonIndex);
        pass = decoded.slice(colonIndex + 1);
      }
    } catch {
      return new Response("Invalid Authorization header", {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    if (!AUTH_USER || !AUTH_PASS || user !== AUTH_USER || pass !== AUTH_PASS) {
      return new Response("Forbidden", {
        status: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    if (!API_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          errors: [{ message: "Server misconfiguration: API_TOKEN is missing in Worker environment." }],
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // ======================
    // BUILD TARGET URL
    // ======================
    const url = new URL(request.url);

    if (ACCOUNT_ID && !url.pathname.startsWith("/accounts/") && !url.searchParams.has("account.id")) {
      url.searchParams.set("account.id", ACCOUNT_ID);
    }

    const queryString = url.searchParams.toString();
    const target =
      "https://api.cloudflare.com/client/v4" +
      url.pathname +
      (queryString ? `?${queryString}` : "");

    // ======================
    // PROXY REQUEST
    // ======================
    const proxyHeaders = new Headers();
    proxyHeaders.set("Authorization", `Bearer ${API_TOKEN}`);
    const contentType = request.headers.get("Content-Type");
    if (contentType) {
      proxyHeaders.set("Content-Type", contentType);
    }

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const body = hasBody ? await request.arrayBuffer() : undefined;

    const proxyRequest = new Request(target, {
      method: request.method,
      headers: proxyHeaders,
      body,
    });

    const res = await fetch(proxyRequest);

    return new Response(await res.text(), {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  },
};
