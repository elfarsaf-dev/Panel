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

  const data = await res.json();
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
  post: (path: string, body: unknown) =>
    cfRequest(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    cfRequest(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) =>
    cfRequest(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => cfRequest(path, { method: "DELETE" }),
};
