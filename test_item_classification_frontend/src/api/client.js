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

// PUBLIC_INTERFACE
export async function importTestPlanFile(file) {
  /** Uploads a CSV/XLSX as multipart/form-data to the backend import endpoint. */
  const form = new FormData();
  form.append('file', file);

  const resp = await fetch(buildUrl('/import/testplan'), {
    method: 'POST',
    body: form,
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
  const resp = await fetch(buildUrl('/suites'));
  const data = await readJsonOrText(resp);
  if (!resp.ok) throw new Error(data?.detail || 'Failed to load suites.');
  return data;
}

// PUBLIC_INTERFACE
export async function fetchSuiteTestcases({ suiteId, page = 1, pageSize = 20, category, priority, search }) {
  /** Fetch paginated test cases for a suite with optional filters. */
  const resp = await fetch(
    buildUrl(`/suites/${suiteId}/testcases`, {
      page,
      page_size: pageSize,
      category,
      priority,
      search,
    })
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
