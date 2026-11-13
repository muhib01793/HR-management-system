import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import { passwordRules, EMAIL_RE } from '../utils/validation';
import { formatDate } from '../utils/format';

export default function Users() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({ defaultValues: { role: 'hr' } });

  const load = () => {
    api
      .get('/users')
      .then((r) => setUsers(r.data))
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const onCreate = async (data) => {
    try {
      await api.post('/users', data);
      toast.success('User created');
      reset({ role: 'hr', name: '', email: '', password: '' });
      load();
    } catch (err) {
      const fields = err.response?.data?.errors;
      toast.error(fields ? Object.values(fields)[0] : err.response?.data?.message || 'Could not create user');
    }
  };

  const changeRole = async (u, role) => {
    try {
      await api.put('/users/' + u.id, { role });
      toast.success('Role updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change role');
    }
    load();
  };

  const remove = async (u) => {
    if (!window.confirm('Delete the account for ' + u.name + '? They will be signed out immediately.')) return;
    try {
      await api.delete('/users/' + u.id);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete user');
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    try {
      await api.put('/users/' + resetting.id, { password: newPassword });
      toast.success('Password reset for ' + resetting.name);
      setResetting(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reset password');
    }
  };

  return (
    <div>
      <form className="card user-form" onSubmit={handleSubmit(onCreate)} noValidate>
        <h3>Add a user</h3>
        <p className="muted">Admins can manage everything. HR staff can view, add and edit employees, but cannot delete them or manage users.</p>
        <div className="user-form-grid">
          <div className="field">
            <label htmlFor="u-name">Full name</label>
            <input id="u-name" {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })} />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </div>
          <div className="field">
            <label htmlFor="u-email">Email</label>
            <input id="u-email" type="email" autoComplete="off" {...register('email', { required: 'Email is required', pattern: { value: EMAIL_RE, message: 'Enter a valid email' } })} />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </div>
          <div className="field">
            <label htmlFor="u-password">Temporary password</label>
            <input id="u-password" type="password" autoComplete="new-password" {...register('password', passwordRules)} />
            {errors.password && <span className="field-error">{errors.password.message}</span>}
          </div>
          <div className="field">
            <label htmlFor="u-role">Role</label>
            <select id="u-role" {...register('role')}>
              <option value="hr">HR staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : '+ Create user'}
        </button>
      </form>

      {loading ? (
        <Loader text="Loading users..." />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : (
        <div className="card table-card users-table">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th className="actions-col">Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong>{u.id === me?.id && <span className="you-tag">you</span>}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="role-select"
                      aria-label={'Role for ' + u.name}
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                    >
                      <option value="hr">HR staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>{formatDate(String(u.createdAt).slice(0, 10))}</td>
                  <td className="actions-col">
                    <button className="btn btn-outline btn-sm" onClick={() => setResetting(u)}>Reset password</button>{' '}
                    {u.id !== me?.id && (
                      <button className="btn btn-icon btn-danger" aria-label={'Delete ' + u.name} title="Delete" onClick={() => remove(u)}>🗑</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetting && (
        <Modal label="Reset password" onClose={() => setResetting(null)}>
          <form onSubmit={submitReset}>
            <h3>Reset password</h3>
            <p className="muted modal-note">Set a new temporary password for {resetting.name}. Share it with them privately and ask them to change it after signing in.</p>
            <div className="field">
              <label htmlFor="reset-pw">New password</label>
              <input id="reset-pw" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
              <span className="muted">At least 8 characters, with letters and numbers.</span>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setResetting(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Reset password</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
