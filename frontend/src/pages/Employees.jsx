import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';
import { formatDate, formatMoney } from '../utils/format';

const columns = [
  { field: 'name', label: 'Name' },
  { field: 'designation', label: 'Designation' },
  { field: 'department', label: 'Department' },
  { field: 'joinDate', label: 'Joined' },
  { field: 'salary', label: 'Salary' }
];

export default function Employees() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('name');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [reload, setReload] = useState(0);
  const [viewing, setViewing] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Wait until typing stops (400ms) before asking the server.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  const filterParams = () => {
    const params = { sort, order };
    if (debounced) params.search = debounced;
    if (department) params.department = department;
    if (status) params.status = status;
    return params;
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .get('/employees', { params: { ...filterParams(), page, limit: 8 } })
      .then((r) => {
        if (!alive) return;
        setEmployees(r.data.data);
        setPages(r.data.pages);
        setTotal(r.data.total);
        // If the last item on the last page was deleted, step back one page.
        if (r.data.data.length === 0 && page > 1) setPage(r.data.pages);
      })
      .catch(() => alive && setError('Failed to load employees. Please try again.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, department, status, sort, order, page, reload]);

  const toggleSort = (field) => {
    if (sort === field) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setOrder('asc');
    }
    setPage(1);
  };

  const handleDelete = async (emp) => {
    if (!window.confirm('Delete ' + emp.name + '? This cannot be undone.')) return;
    try {
      await api.delete('/employees/' + emp.id);
      toast.success('Employee deleted');
      setReload((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete employee');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/employees/export', { params: filterParams(), responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employees-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const ariaSort = (field) => (sort === field ? (order === 'asc' ? 'ascending' : 'descending') : 'none');

  return (
    <div>
      <div className="toolbar">
        <input
          className="search-input"
          type="search"
          aria-label="Search employees"
          placeholder="Search by name, email or designation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Filter by department" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </select>
        <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="btn btn-outline" onClick={handleExport} disabled={exporting || total === 0}>
          {exporting ? 'Exporting...' : '⬇ Export CSV'}
        </button>
        <Link to="/employees/new" className="btn btn-primary">+ Add Employee</Link>
      </div>

      {loading ? (
        <Loader text="Loading employees..." />
      ) : error ? (
        <div className="alert alert-error">
          {error} <button className="btn btn-outline btn-sm" onClick={() => setReload((r) => r + 1)}>Retry</button>
        </div>
      ) : employees.length === 0 ? (
        <EmptyState title="No employees found" message="Try changing the search or filters, or add a new employee.">
          <Link to="/employees/new" className="btn btn-primary">+ Add Employee</Link>
        </EmptyState>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.field} aria-sort={ariaSort(c.field)} className="sortable">
                    <button className="th-btn" onClick={() => toggleSort(c.field)}>
                      {c.label} {sort === c.field ? (order === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                ))}
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="cell-user">
                      <Avatar name={e.name} />
                      <div>
                        <strong>{e.name}</strong>
                        <span className="cell-sub">{e.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>{e.designation}</td>
                  <td><span className="badge badge-dept">{e.department}</span></td>
                  <td>{formatDate(e.joinDate)}</td>
                  <td>{formatMoney(e.salary)}</td>
                  <td>
                    <span className={'badge badge-' + e.status}>{e.status}</span>
                  </td>
                  <td className="actions-col">
                    <button className="btn btn-icon" title="View" aria-label={'View ' + e.name} onClick={() => setViewing(e)}>👁</button>
                    <Link className="btn btn-icon" title="Edit" aria-label={'Edit ' + e.name} to={'/employees/' + e.id + '/edit'}>✏️</Link>
                    {isAdmin && (
                      <button className="btn btn-icon btn-danger" title="Delete" aria-label={'Delete ' + e.name} onClick={() => handleDelete(e)}>🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <span>{total} employees · page {page} of {pages}</span>
            <div>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <Modal label={'Employee details: ' + viewing.name} onClose={() => setViewing(null)}>
          <div className="modal-header">
            <Avatar name={viewing.name} size="lg" />
            <div>
              <h3>{viewing.name}</h3>
              <p>{viewing.designation} · {viewing.department}</p>
            </div>
            <button className="btn btn-icon" aria-label="Close" onClick={() => setViewing(null)}>✕</button>
          </div>
          <div className="modal-body">
            <p><strong>Email:</strong> {viewing.email}</p>
            <p><strong>Phone:</strong> {viewing.phone || '—'}</p>
            <p><strong>Salary:</strong> PKR {formatMoney(viewing.salary)}</p>
            <p><strong>Joined:</strong> {formatDate(viewing.joinDate)}</p>
            <p><strong>Status:</strong> <span className={'badge badge-' + viewing.status}>{viewing.status}</span></p>
          </div>
          <div className="modal-footer">
            <Link className="btn btn-primary" to={'/employees/' + viewing.id + '/edit'} onClick={() => setViewing(null)}>Edit</Link>
            <button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
