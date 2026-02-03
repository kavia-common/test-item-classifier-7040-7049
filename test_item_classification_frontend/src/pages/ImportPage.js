import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSuiteTestcases, fetchSuites, getApiBase, importTestPlanFile } from '../api/client';
import { useToast } from '../components/ToastProvider';
import '../styles/import.css';

const MAX_BYTES = 20 * 1024 * 1024; // ~20MB client-side limit
const ALLOWED_EXT = ['.xlsx', '.csv'];

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function extOf(name) {
  const lower = (name || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot >= 0 ? lower.slice(dot) : '';
}

// PUBLIC_INTERFACE
export default function ImportPage() {
  /** Import flow UI: upload file -> backend import -> fetch suites/testcases and render in a table. */
  const { addToast, removeToast } = useToast();

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [importSummary, setImportSummary] = useState(null);
  const [importPreview, setImportPreview] = useState([]);

  const [suites, setSuites] = useState([]);
  const [suiteId, setSuiteId] = useState('');

  const [filters, setFilters] = useState({ search: '', category: '', priority: '' });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [tcPage, setTcPage] = useState({ items: [], total: 0, page: 1, page_size: pageSize, filters: {} });
  const [loadingSuites, setLoadingSuites] = useState(false);
  const [loadingTestcases, setLoadingTestcases] = useState(false);

  const lastReq = useRef(0);

  const apiBase = useMemo(() => getApiBase(), []);

  const loadSuites = async () => {
    setLoadingSuites(true);
    try {
      const data = await fetchSuites();
      setSuites(data?.suites || []);
      if (!suiteId && (data?.suites || []).length > 0) {
        setSuiteId(String(data.suites[0].id));
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to load suites', message: e.message });
    } finally {
      setLoadingSuites(false);
    }
  };

  const loadTestcases = async ({ suiteIdParam, pageParam, filtersParam }) => {
    if (!suiteIdParam) return;
    setLoadingTestcases(true);
    const reqId = ++lastReq.current;

    try {
      const data = await fetchSuiteTestcases({
        suiteId: Number(suiteIdParam),
        page: pageParam,
        pageSize,
        category: filtersParam.category || undefined,
        priority: filtersParam.priority || undefined,
        search: filtersParam.search || undefined,
      });

      // Ignore stale requests when user changes suite/filters quickly
      if (reqId !== lastReq.current) return;

      setTcPage(data);
    } catch (e) {
      if (reqId !== lastReq.current) return;
      addToast({ type: 'error', title: 'Failed to load test cases', message: e.message });
    } finally {
      if (reqId === lastReq.current) setLoadingTestcases(false);
    }
  };

  useEffect(() => {
    loadSuites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suiteId]);

  useEffect(() => {
    loadTestcases({ suiteIdParam: suiteId, pageParam: page, filtersParam: filters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suiteId, page]);

  const onFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const extension = extOf(file.name);
    if (!ALLOWED_EXT.includes(extension)) {
      addToast({
        type: 'error',
        title: 'Unsupported file type',
        message: `Please upload ${ALLOWED_EXT.join(', ')}.`,
      });
      e.target.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      addToast({
        type: 'error',
        title: 'File too large',
        message: `Max allowed size is ${formatBytes(MAX_BYTES)}.`,
      });
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const doImport = async () => {
    if (!selectedFile) {
      addToast({ type: 'error', title: 'No file selected', message: 'Please choose a .xlsx or .csv file first.' });
      return;
    }

    setUploading(true);
    const toastId = addToast({ type: 'info', title: 'Uploading', message: 'Import in progress…', durationMs: 0 });

    try {
      const data = await importTestPlanFile(selectedFile);
      setImportSummary({
        suites_created: data?.suites_created ?? 0,
        testcases_created: data?.testcases_created ?? 0,
        duplicates_skipped: data?.duplicates_skipped ?? 0,
        warnings: data?.warnings || [],
      });
      setImportPreview(data?.preview || []);
      addToast({ type: 'success', title: 'Import complete', message: 'Suites and test cases were imported successfully.' });

      // Refresh suites and testcases after import
      await loadSuites();
      await loadTestcases({
        suiteIdParam: suiteId || (suites[0] ? String(suites[0].id) : ''),
        pageParam: 1,
        filtersParam: filters,
      });
      setPage(1);
    } catch (e) {
      addToast({ type: 'error', title: 'Import failed', message: e.message });
    } finally {
      // Critical: always dismiss the indefinite progress toast so the UI doesn't appear stuck.
      if (toastId) removeToast(toastId);
      setUploading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil((tcPage?.total || 0) / pageSize));

  const onApplyFilters = () => {
    setPage(1);
    loadTestcases({ suiteIdParam: suiteId, pageParam: 1, filtersParam: filters });
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-dot" />
          <div className="brand-title">Test Item Classifier</div>
        </div>

        <nav className="nav">
          <a className="nav-item nav-item-active" href="/import" aria-current="page">
            Import
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="meta">
            <div className="meta-label">API Base</div>
            <div className="meta-value" title={apiBase}>
              {apiBase}
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">Import Test Plan</div>
          <div className="topbar-subtitle">Upload WiFi Function TestPlan.xlsx (or CSV) to persist suites/test cases.</div>
        </header>

        <section className="content">
          <div className="grid">
            <div className="card upload-card">
              <div className="card-title">Upload Excel/CSV</div>
              <div className="card-subtitle">Accepted: .xlsx, .csv • Max size: {formatBytes(MAX_BYTES)}</div>

              <label className="file-drop">
                <input type="file" accept=".xlsx,.csv" onChange={onFileChange} disabled={uploading} />
                <div className="file-drop-inner">
                  <div className="file-drop-title">{selectedFile ? selectedFile.name : 'Choose a file to import'}</div>
                  <div className="file-drop-hint">
                    {selectedFile ? `${formatBytes(selectedFile.size)} • Ready to upload` : 'Drag & drop is supported by your browser file picker.'}
                  </div>
                </div>
              </label>

              <div className="actions">
                <button className="btn primary" onClick={doImport} disabled={uploading || !selectedFile}>
                  {uploading ? 'Importing…' : 'Import'}
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setSelectedFile(null);
                    setImportSummary(null);
                    setImportPreview([]);
                  }}
                  disabled={uploading}
                >
                  Clear
                </button>
              </div>

              {importSummary ? (
                <div className="summary">
                  <div className="summary-row">
                    <div className="pill">Suites created: {importSummary.suites_created}</div>
                    <div className="pill">Test cases created: {importSummary.testcases_created}</div>
                    <div className="pill">Duplicates skipped: {importSummary.duplicates_skipped}</div>
                  </div>

                  {importSummary.warnings?.length ? (
                    <div className="warnings">
                      <div className="warnings-title">Warnings</div>
                      <ul>
                        {importSummary.warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {importPreview?.length ? (
                    <div className="preview">
                      <div className="preview-title">Preview (first 10 rows)</div>
                      <div className="table-wrap">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>suite_name</th>
                              <th>case_id</th>
                              <th>title</th>
                              <th>priority</th>
                              <th>category</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.map((r, idx) => (
                              <tr key={idx}>
                                <td>{r.suite_name}</td>
                                <td>{r.case_id || '-'}</td>
                                <td className="truncate" title={r.title}>
                                  {r.title}
                                </td>
                                <td>{r.priority || '-'}</td>
                                <td>{r.category || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="card data-card">
              <div className="card-title">Imported Suites & Test Cases</div>
              <div className="card-subtitle">
                Pick a suite, filter, and browse test cases. (Backend: paginated; frontend: filter inputs)
              </div>

              <div className="controls">
                <div className="control">
                  <label>Suite</label>
                  <select value={suiteId} onChange={(e) => setSuiteId(e.target.value)} disabled={loadingSuites || uploading}>
                    {(suites || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.testcases_count})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="control">
                  <label>Search</label>
                  <input
                    value={filters.search}
                    onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                    placeholder="case_id, title, description…"
                  />
                </div>

                <div className="control">
                  <label>Priority</label>
                  <input value={filters.priority} onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))} placeholder="e.g. P0" />
                </div>

                <div className="control">
                  <label>Category</label>
                  <input value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))} placeholder="e.g. WiFi" />
                </div>

                <div className="control control-actions">
                  <label>&nbsp;</label>
                  <button className="btn secondary" onClick={onApplyFilters} disabled={loadingTestcases || uploading || !suiteId}>
                    Apply
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>suite_id</th>
                      <th>case_id</th>
                      <th>title</th>
                      <th>priority</th>
                      <th>status</th>
                      <th>category</th>
                      <th>subcategory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingTestcases ? (
                      <tr>
                        <td colSpan="7" className="muted">
                          Loading…
                        </td>
                      </tr>
                    ) : (tcPage?.items || []).length ? (
                      tcPage.items.map((tc) => (
                        <tr key={tc.id}>
                          <td>{tc.suite_id}</td>
                          <td>{tc.case_id || '-'}</td>
                          <td className="truncate" title={tc.title}>
                            {tc.title}
                          </td>
                          <td>{tc.priority || '-'}</td>
                          <td>
                            <span className="status-pill">Imported</span>
                          </td>
                          <td>{tc.category || '-'}</td>
                          <td>{tc.subcategory || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="muted">
                          No test cases found for this suite/filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-left">
                  <span className="muted">
                    Total: <strong>{tcPage?.total || 0}</strong>
                  </span>
                </div>
                <div className="pagination-right">
                  <button className="btn ghost small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loadingTestcases}>
                    Prev
                  </button>
                  <span className="page-indicator">
                    Page <strong>{page}</strong> / <strong>{totalPages}</strong>
                  </span>
                  <button className="btn ghost small" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loadingTestcases}>
                    Next
                  </button>
                </div>
              </div>

              <div className="hint">
                Note: backend endpoint provides title/priority/category/subcategory. Description is available in import preview only.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
