import { useEffect, useState } from 'react';
import api from '../api/axios';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import { formatDate } from '../utils/format';

const FILTERS = [
  { value: '', label: 'Everything' },
  { value: 'employee', label: 'Employees' },
  { value: 'department', label: 'Departments' },
  { value: 'user', label: 'Users' },
  { value: 'auth', label: 'Sign-ins' }
];

const ACTION_LABELS = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  export: 'Exported',
  login: 'Signed in',
  login_failed: 'Failed sign-in',
  role_change: 'Role changed',
  password_reset: 'Password reset',
  password_change: 'Password changed'
};

const TONES = { delete: 'badge-inactive', login_failed: 'badge-inactive', create: 'badge-active', login: 'badge-blue' };

function formatTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${formatDate(iso)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Activity() {
  const [rows, setRows] = useState([]);
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .get('/audit', { params: { page, limit: 20, ...(entity ? { entity } : {}) } })
      .then((r) => {
        if (!alive) return;
        setRows(r.data.data);
        setPages(r.data.pages);
        setTotal(r.data.total);
      })
      .catch(() => alive && setError('Failed to load the activity log.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page, entity]);

  return (
    <div>
      <div className="toolbar toolbar-center">
        <select
          aria-label="Filter activity"
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <span className="muted">{total} record{total === 1 ? '' : 's'}</span>
      </div>

      {loading ? (
        <Loader text="Loading activity..." />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No activity yet" message="Actions such as adding employees or signing in will appear here." />
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{formatTime(r.createdAt)}</td>
                  <td>{r.userName || <span className="muted">Unknown</span>}</td>
                  <td><span className={'badge ' + (TONES[r.action] || 'badge-dept')}>{ACTION_LABELS[r.action] || r.action}</span></td>
                  <td>{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="pagination">
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
