const PROXY_URL = "https://panelv1.elfar.my.id";

let credentials: { username: string; password: string } | null = null;

export function setCredentials(username: string, password: string) {
  credentials = { username, password };
  localStorage.setItem("cf_creds", JSON.stringify({ username, password }));
}

export function getCredentials() {
  if (credentials) return credentials;
  const stored = localStorage.getItem("cf_creds");
  if (stored) {
    try {
      credentials = JSON.parse(stored);
      return credentials;
    } catch {}
  }
  return null;
}

export function clearCredentials() {
  credentials = null;
  localStorage.removeItem("cf_creds");
}

export function isAuthenticated() {
  return !!getCredentials();
}

function getAuthHeader() {
  const creds = getCredentials();
  if (!creds) throw new Error("Not authenticated");
  return "Basic " + btoa(`${creds.username}:${creds.password}`);
}

async function cfRequest(path: string, options: RequestInit = {}) {
  const url = `${PROXY_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Response is plain text (e.g. Worker scripts return raw JS)
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

// Extract script content from multipart/form-data response (Cloudflare ES Module workers)
function extractScriptFromMultipart(text: string): string {
  // Check if it's a multipart response (starts with --)
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("--")) return text;

  const lines = text.split("\n");
  const scriptLines: string[] = [];
  let inPart = false;
  let headersDone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trimEnd();

    // New part boundary
    if (trimmedLine.startsWith("--") && trimmedLine.length > 2 && !trimmedLine.endsWith("--")) {
      inPart = true;
      headersDone = false;
      scriptLines.length = 0; // reset, take last part with JS content
      continue;
    }

    // End boundary
    if (trimmedLine.startsWith("--") && trimmedLine.endsWith("--")) break;

    if (inPart && !headersDone) {
      // Empty line = headers ended, content starts
      if (trimmedLine === "") {
        headersDone = true;
      }
      continue;
    }

    if (inPart && headersDone) {
      scriptLines.push(lines[i]);
    }
  }

  const result = scriptLines.join("\n").trimEnd();
  return result || text;
}

// Fetch raw text response (for Worker script downloads)
async function cfRequestText(path: string) {
  const url = `${PROXY_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: getAuthHeader() },
  });
  const text = await res.text();
  const data = extractScriptFromMultipart(text);
  return { ok: res.ok, status: res.status, data };
}

export async function testAuth(username: string, password: string) {
  const url = `${PROXY_URL}/zones?per_page=1`;
  const res = await fetch(url, {
    headers: {
      Authorization: "Basic " + btoa(`${username}:${password}`),
      "Content-Type": "application/json",
    },
  });
  return res.ok;
}

export const api = {
  get: (path: string) => cfRequest(path),
  getText: (path: string) => cfRequestText(path),
  post: (path: string, body: unknown) =>
    cfRequest(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    cfRequest(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) =>
    cfRequest(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => cfRequest(path, { method: "DELETE" }),
};
