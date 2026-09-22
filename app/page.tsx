'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SafeLink, LinkLog } from '@/lib/bypass';

// ============================================================
// Toast System
// ============================================================

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}

let toastIdCounter = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((msg: string, type: ToastType = 'info') => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return { toasts, addToast };
}

// ============================================================
// Add Link Modal
// ============================================================

function AddLinkModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (url: string, label: string) => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    await onAdd(url.trim(), label.trim());
    setLoading(false);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">➕ Tambah Link Safelink</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="link-url">URL Safelink *</label>
            <input
              id="link-url"
              className="form-input"
              type="url"
              placeholder="https://safelink.id/xxxxx"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="link-label">Label / Nama (opsional)</label>
            <input
              id="link-label"
              className="form-input"
              type="text"
              placeholder="Contoh: Film XYZ Episode 1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Batal
            </button>
            <button
              id="btn-submit-add-link"
              type="submit"
              className="btn btn-primary"
              disabled={loading || !url.trim()}
            >
              {loading ? <span className="spinner" /> : '✨'}
              {loading ? 'Menyimpan...' : 'Tambah Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Link Card
// ============================================================

function LinkCard({
  link,
  onDelete,
  onToggle,
  onRun,
  runningId,
}: {
  link: SafeLink;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onRun: (id: string) => Promise<void>;
  runningId: string | null;
}) {
  const isRunning = runningId === link.id;

  function formatDate(iso?: string) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className={`link-card${link.active ? '' : ' inactive'}`}>
      <div className="link-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="link-label">{link.label}</div>
          <div className="link-url" title={link.url}>{link.url}</div>
        </div>
        <label className="toggle" title={link.active ? 'Nonaktifkan' : 'Aktifkan'}>
          <input
            type="checkbox"
            checked={link.active}
            onChange={(e) => onToggle(link.id, e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {/* Status badges */}
      <div className="link-meta">
        <span className={`badge ${link.active ? 'badge-active' : 'badge-neutral'}`}>
          {link.active ? '● Aktif' : '○ Nonaktif'}
        </span>
        {link.lastResult === 'success' && (
          <span className="badge badge-success">✓ Berhasil</span>
        )}
        {link.lastResult === 'failed' && (
          <span className="badge badge-danger">✗ Gagal</span>
        )}
        {!link.lastResult && (
          <span className="badge badge-neutral">Belum dijalankan</span>
        )}
      </div>

      {/* Last result destination */}
      {link.lastDestUrl && (
        <div className="link-dest" title={link.lastDestUrl}>
          <span>→</span>
          <a href={link.lastDestUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {link.lastDestUrl}
          </a>
        </div>
      )}

      {link.lastRun && (
        <div className="last-run">🕐 Terakhir: {formatDate(link.lastRun)}</div>
      )}

      {/* Actions */}
      <div className="link-actions">
        <button
          id={`btn-run-${link.id}`}
          className="btn btn-success btn-sm"
          onClick={() => onRun(link.id)}
          disabled={isRunning || !link.active}
          title="Jalankan sekarang"
        >
          {isRunning ? <span className="spinner" /> : '▶'}
          {isRunning ? 'Memproses...' : 'Jalankan'}
        </button>
        <button
          id={`btn-delete-${link.id}`}
          className="btn btn-danger btn-sm"
          onClick={() => onDelete(link.id)}
          disabled={isRunning}
          title="Hapus link ini"
        >
          🗑 Hapus
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Log Table
// ============================================================

function LogTable({ logs }: { logs: LinkLog[] }) {
  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  if (logs.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '40px' }}>
        <div className="empty-icon">📋</div>
        <div className="empty-title">Belum ada log</div>
        <div className="empty-desc">Log akan muncul setelah link dijalankan</div>
      </div>
    );
  }

  return (
    <div className="log-wrapper" style={{ overflowX: 'auto' }}>
      <table className="log-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Label</th>
            <th>Original URL</th>
            <th>Dest URL</th>
            <th>Waktu</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>
                <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                  {log.status === 'success' ? '✓ OK' : '✗ Fail'}
                </span>
              </td>
              <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{log.linkLabel}</td>
              <td>
                <div className="log-url" title={log.originalUrl}>{log.originalUrl}</div>
              </td>
              <td>
                {log.destUrl ? (
                  <a
                    href={log.destUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="log-dest"
                    title={log.destUrl}
                  >
                    {log.destUrl}
                  </a>
                ) : (
                  <div className="log-error" title={log.error}>{log.error || '—'}</div>
                )}
              </td>
              <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                {formatDate(log.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Main Dashboard Page
// ============================================================

export default function Dashboard() {
  const [links, setLinks] = useState<SafeLink[]>([]);
  const [logs, setLogs] = useState<LinkLog[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [runningAll, setRunningAll] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const { toasts, addToast } = useToasts();

  // Fetch links
  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/links');
      const data = await res.json();
      setLinks(data.links || []);
    } catch {
      addToast('Gagal memuat link', 'error');
    } finally {
      setLoadingLinks(false);
    }
  }, [addToast]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      addToast('Gagal memuat log', 'error');
    } finally {
      setLoadingLogs(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchLinks();
    fetchLogs();
  }, [fetchLinks, fetchLogs]);

  // Add link
  async function handleAddLink(url: string, label: string) {
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, label }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchLinks();
      addToast('Link berhasil ditambahkan! 🎉', 'success');
    } catch (e) {
      addToast(`Gagal menambah link: ${e}`, 'error');
    }
  }

  // Delete link
  async function handleDelete(id: string) {
    if (!confirm('Hapus link ini?')) return;
    try {
      await fetch(`/api/links/${id}`, { method: 'DELETE' });
      setLinks((prev) => prev.filter((l) => l.id !== id));
      addToast('Link dihapus', 'info');
    } catch {
      addToast('Gagal menghapus link', 'error');
    }
  }

  // Toggle active
  async function handleToggle(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      const data = await res.json();
      setLinks((prev) => prev.map((l) => (l.id === id ? data.link : l)));
      addToast(active ? 'Link diaktifkan ✓' : 'Link dinonaktifkan', 'info');
    } catch {
      addToast('Gagal mengubah status', 'error');
    }
  }

  // Run single link
  async function handleRunSingle(id: string) {
    setRunningId(id);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId: id }),
      });
      const data = await res.json();
      if (data.results?.[0]?.status === 'success') {
        addToast(`✓ Bypass berhasil! → ${data.results[0].destUrl}`, 'success');
      } else {
        addToast(`✗ Bypass gagal: ${data.results?.[0]?.error || 'unknown'}`, 'error');
      }
      await Promise.all([fetchLinks(), fetchLogs()]);
    } catch (e) {
      addToast(`Error: ${e}`, 'error');
    } finally {
      setRunningId(null);
    }
  }

  // Run all links
  async function handleRunAll() {
    setRunningAll(true);
    addToast('Menjalankan semua link...', 'info');
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const ok = data.results?.filter((r: LinkLog) => r.status === 'success').length ?? 0;
      const fail = data.results?.filter((r: LinkLog) => r.status === 'failed').length ?? 0;
      addToast(`Selesai! ${ok} berhasil, ${fail} gagal`, ok > 0 ? 'success' : 'error');
      await Promise.all([fetchLinks(), fetchLogs()]);
    } catch (e) {
      addToast(`Error: ${e}`, 'error');
    } finally {
      setRunningAll(false);
    }
  }

  // Stats
  const totalLinks = links.length;
  const activeLinks = links.filter((l) => l.active).length;
  const successLogs = logs.filter((l) => l.status === 'success').length;
  const failedLogs = logs.filter((l) => l.status === 'failed').length;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="logo glow-pulse">🔗</div>
          <div>
            <div className="brand-name">SafeBot</div>
            <div className="brand-tagline">Auto Safelink Opener · Berjalan 1x/hari otomatis</div>
          </div>
        </div>
        <div className="header-actions">
          <button
            id="btn-run-all"
            className="btn btn-secondary"
            onClick={handleRunAll}
            disabled={runningAll || activeLinks === 0}
          >
            {runningAll ? <span className="spinner" /> : '▶▶'}
            {runningAll ? 'Memproses...' : 'Jalankan Semua'}
          </button>
          <button
            id="btn-add-link"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            ➕ Tambah Link
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card accent">
          <div className="stat-icon">🔗</div>
          <div className="stat-value">{totalLinks}</div>
          <div className="stat-label">Total Link</div>
        </div>
        <div className="stat-card info">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{activeLinks}</div>
          <div className="stat-label">Link Aktif</div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">⚡</div>
          <div className="stat-value">{successLogs}</div>
          <div className="stat-label">Bypass Berhasil</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon">❌</div>
          <div className="stat-value">{failedLogs}</div>
          <div className="stat-label">Bypass Gagal</div>
        </div>
      </div>

      {/* Links Section */}
      <section className="section">
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="section-title">Daftar Link Safelink</h2>
            <span className="section-badge">{totalLinks} link</span>
          </div>
        </div>

        {loadingLinks ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <span className="spinner" style={{ margin: '0 auto', display: 'block', width: 32, height: 32 }} />
            <p style={{ marginTop: 16 }}>Memuat link...</p>
          </div>
        ) : links.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌐</div>
            <div className="empty-title">Belum ada link safelink</div>
            <div className="empty-desc">
              Klik tombol <strong>&quot;Tambah Link&quot;</strong> untuk menambah link safelink pertama Anda
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => setShowAddModal(true)}
            >
              ➕ Tambah Link Sekarang
            </button>
          </div>
        ) : (
          <div className="links-grid">
            {links.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                onDelete={handleDelete}
                onToggle={handleToggle}
                onRun={handleRunSingle}
                runningId={runningId}
              />
            ))}
          </div>
        )}
      </section>

      <div className="divider" />

      {/* Logs Section */}
      <section className="section">
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="section-title">📋 Riwayat Log</h2>
            <span className="section-badge">{logs.length} entri</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchLogs}>
            🔄 Refresh
          </button>
        </div>

        {loadingLogs ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
            <span className="spinner" style={{ margin: '0 auto', display: 'block', width: 24, height: 24 }} />
          </div>
        ) : (
          <LogTable logs={logs} />
        )}
      </section>

      {/* Schedule Info Banner */}
      <div style={{
        background: 'rgba(99,102,241,0.08)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: '0.875rem',
        color: 'var(--text-secondary)',
      }}>
        <span style={{ fontSize: '1.2rem' }}>⏰</span>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Jadwal Otomatis: Setiap hari pukul 00:00 UTC</strong>
          <br />
          Vercel Cron akan otomatis menjalankan bypass untuk semua link aktif setiap hari.
          Anda juga bisa klik <strong>&quot;Jalankan Semua&quot;</strong> untuk trigger manual kapan saja.
        </div>
      </div>

      {/* Add Link Modal */}
      {showAddModal && (
        <AddLinkModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddLink}
        />
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : 'ℹ'}</span>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
