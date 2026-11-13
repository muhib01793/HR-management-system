import { useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { passwordRules } from '../utils/validation';

export default function Account() {
  const { user, isAdmin, updateUser } = useAuth();
  const [company, setCompany] = useState(user?.company || '');
  const [savingCompany, setSavingCompany] = useState(false);
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting }
  } = useForm();

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
      // Other devices are signed out; this browser continues with a fresh token.
      if (data.token) localStorage.setItem('hr_token', data.token);
      toast.success('Password updated. Other devices were signed out.');
      reset();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update password');
    }
  };

  const saveCompany = async (e) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      const { data } = await api.put('/company', { name: company });
      updateUser({ company: data.name });
      setCompany(data.name);
      toast.success('Company name updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the company name');
    } finally {
      setSavingCompany(false);
    }
  };

  return (
    <div className="card form-card narrow">
      <h3>My account</h3>
      <p className="muted account-line">
        {user?.name} · {user?.email} · {user?.role === 'admin' ? 'Administrator' : 'HR staff'}
        {user?.company ? ' · ' + user.company : ''}
      </p>

      {isAdmin && (
        <form className="company-form" onSubmit={saveCompany}>
          <h4>Company</h4>
          <div className="company-form-row">
            <div className="field">
              <label htmlFor="companyName">Company name</label>
              <input id="companyName" value={company} maxLength={150} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={savingCompany || company.trim().length < 2}>
              {savingCompany ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <h4>Change password</h4>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="field">
          <label htmlFor="currentPassword">Current password</label>
          <input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword', { required: 'Current password is required' })} />
          {errors.currentPassword && <span className="field-error">{errors.currentPassword.message}</span>}
        </div>
        <div className="field">
          <label htmlFor="newPassword">New password</label>
          <input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword', passwordRules)} />
          {errors.newPassword && <span className="field-error">{errors.newPassword.message}</span>}
        </div>
        <div className="field">
          <label htmlFor="confirmPassword">Confirm new password</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword', {
              required: 'Please confirm the new password',
              validate: (v) => v === getValues('newPassword') || 'Passwords do not match'
            })}
          />
          {errors.confirmPassword && <span className="field-error">{errors.confirmPassword.message}</span>}
        </div>
        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
