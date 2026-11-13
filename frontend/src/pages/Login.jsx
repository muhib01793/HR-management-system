import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm();

  const [allowRegistration, setAllowRegistration] = useState(false);

  // Show the "Register your company" link only when the server allows it.
  useEffect(() => {
    let alive = true;
    api
      .get('/auth/config')
      .then((r) => alive && setAllowRegistration(Boolean(r.data.allowRegistration)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Already signed in? Skip the login screen.
  if (user && localStorage.getItem('hr_token')) return <Navigate to="/" replace />;

  const onSubmit = async (data) => {
    try {
      await login(data.email.trim(), data.password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="login-brand">
          <span className="brand-logo" aria-hidden="true">HR</span>
          <div>
            <h2>HR Management System</h2>
            <p>Sign in to your company account</p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' }
            })}
          />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            {...register('password', { required: 'Password is required' })}
          />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="login-help">Forgot your password? Ask your HR administrator to reset it.</p>
        {allowRegistration && (
          <p className="login-switch">
            New company? <Link to="/register">Register your company</Link>
          </p>
        )}
      </form>
    </div>
  );
}
