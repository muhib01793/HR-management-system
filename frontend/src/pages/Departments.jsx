import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Loader from '../components/Loader';
import Modal from '../components/Modal';

export default function Departments() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    api
      .get('/departments')
      .then((r) => setDepartments(r.data))
      .catch(() => setError('Failed to load departments.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Department name is required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/departments', { name, description });
      toast.success('Department added');
      setName('');
      setDescription('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add department');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (editing.name.trim().length < 2) {
      toast.error('Department name is required');
      return;
    }
    setEditSaving(true);
    try {
      await api.put('/departments/' + editing.id, { name: editing.name, description: editing.description });
      toast.success('Department updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update department');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (d) => {
    if (!window.confirm('Delete the department "' + d.name + '"? This cannot be undone.')) return;
    try {
      await api.delete('/departments/' + d.id);
      toast.success('Department deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete department');
    }
  };

  return (
    <div>
      <form className="card add-dept-form" onSubmit={handleAdd}>
        <input
          aria-label="New department name"
          placeholder="New department name"
          value={name}
          maxLength={150}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          aria-label="Department description"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Adding...' : '+ Add Department'}
        </button>
      </form>

      {loading ? (
        <Loader text="Loading departments..." />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <div className="dept-grid">
          {departments.map((d) => (
            <div className="card dept-card" key={d.id}>
              <div className="dept-icon" aria-hidden="true">🏢</div>
              <h3>{d.name}</h3>
              <p>{d.description || 'No description'}</p>
              <div className="dept-footer">
                <span className="badge badge-blue">{d.employees} employee{d.employees === 1 ? '' : 's'}</span>
                <span className="dept-actions">
                  <button className="btn btn-icon" aria-label={'Edit ' + d.name} title="Edit" onClick={() => setEditing({ ...d })}>✏️</button>
                  {isAdmin && (
                    <button className="btn btn-icon btn-danger" aria-label={'Delete ' + d.name} title="Delete" onClick={() => handleDelete(d)}>🗑</button>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal label="Edit department" onClose={() => setEditing(null)}>
          <form onSubmit={handleEdit}>
            <h3>Edit department</h3>
            <div className="field">
              <label htmlFor="edit-dept-name">Name</label>
              <input id="edit-dept-name" value={editing.name} maxLength={150} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="edit-dept-desc">Description</label>
              <input id="edit-dept-desc" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save changes'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
