const DEFAULT_DEV_BACKEND = 'http://localhost:3001';

/**
 * Resolve backend base URL from env vars, with a dev fallback.
 * Priority:
 *  - REACT_APP_API_BASE
 *  - REACT_APP_BACKEND_URL
 *  - window.location.origin with port 3001 (or localhost:3001)
 */
function resolveApiBase() {
  const fromEnv = process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL;
  if (fromEnv && String(fromEnv).trim().length > 0) return String(fromEnv).replace(/\/+$/, '');

  // Fallback: same host, port 3001. If cannot parse, use localhost:3001.
  try {
    const url = new URL(window.location.origin);
    const host = url.hostname || 'localhost';
    const protocol = url.protocol || 'http:';
    return `${protocol}//${host}:3001`;
  } catch (e) {
    return DEFAULT_DEV_BACKEND;
  }
}

const API_BASE = resolveApiBase();

async function readJsonOrText(resp) {
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return resp.json();
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

function buildUrl(path, query) {
  const url = new URL(API_BASE + path);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

/**
 * Wrapper around fetch that turns network-level failures (CORS, DNS, backend down)
 * into an Error message that includes the URL being called.
 */
async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (e) {
    // Browser network failures typically throw TypeError("Failed to fetch").
    // Add context so the UI can guide the user to the actual root cause.
    const hint =
      `Network request failed.\n\n` +
      `URL: ${url}\n` +
      `Resolved API base: ${API_BASE}\n\n` +
      `Common causes:\n` +
      `- Backend not running / not reachable on that host+port\n` +
      `- Wrong REACT_APP_API_BASE / REACT_APP_BACKEND_URL\n` +
      `- CORS/preflight blocked by backend configuration\n`;
    const msg = e?.message ? `${e.message}\n\n${hint}` : hint;
    throw new Error(msg);
  }
}

// PUBLIC_INTERFACE
export async function checkBackendHealth() {
  /** Calls GET / health endpoint; useful for diagnostics before upload. */
  const resp = await safeFetch(buildUrl('/'), { method: 'GET', credentials: 'include' });
  const data = await readJsonOrText(resp);
  if (!resp.ok) throw new Error(data?.detail || 'Backend health check failed.');
  return data;
}

// PUBLIC_INTERFACE
export async function importTestPlanFile(file) {
  /** Uploads a CSV/XLSX as multipart/form-data to the backend import endpoint. */
  const form = new FormData();
  form.append('file', file);

  const resp = await safeFetch(buildUrl('/import/testplan'), {
    method: 'POST',
    body: form,
    // Keep consistent with backend CORS allow_credentials=True.
    credentials: 'include',
  });

  const data = await readJsonOrText(resp);
  if (!resp.ok) {
    const msg = data?.detail || 'Import failed.';
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

// PUBLIC_INTERFACE
export async function fetchSuites() {
  /** Fetch all suites with counts. */
  const resp = await safeFetch(buildUrl('/suites'), { credentials: 'include' });
  const data = await readJsonOrText(resp);
  if (!resp.ok) throw new Error(data?.detail || 'Failed to load suites.');
  return data;
}

// PUBLIC_INTERFACE
export async function fetchSuiteTestcases({ suiteId, page = 1, pageSize = 20, category, priority, search }) {
  /** Fetch paginated test cases for a suite with optional filters. */
  const resp = await safeFetch(
    buildUrl(`/suites/${suiteId}/testcases`, {
      page,
      page_size: pageSize,
      category,
      priority,
      search,
    }),
    { credentials: 'include' }
  );
  const data = await readJsonOrText(resp);
  if (!resp.ok) throw new Error(data?.detail || 'Failed to load test cases.');
  return data;
}

// PUBLIC_INTERFACE
export function getApiBase() {
  /** Returns the resolved API base URL for display/debug purposes. */
  return API_BASE;
}
