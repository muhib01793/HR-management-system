import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { passwordRules, EMAIL_RE } from '../utils/validation';

export default function Register() {
  const { user, registerCompany } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(true);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting }
  } = useForm();

  useEffect(() => {
    let alive = true;
    api
      .get('/auth/config')
      .then((r) => alive && setAllowed(Boolean(r.data.allowRegistration)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (user && localStorage.getItem('hr_token')) return <Navigate to="/" replace />;

  const onSubmit = async (data) => {
    try {
      await registerCompany({
        companyName: data.companyName.trim(),
        name: data.name.trim(),
        email: data.email.trim(),
        password: data.password
      });
      toast.success('Your company is ready. Welcome!');
      navigate('/');
    } catch (err) {
      const fields = err.response?.data?.errors;
      toast.error(fields ? Object.values(fields)[0] : err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="login-brand">
          <span className="brand-logo" aria-hidden="true">HR</span>
          <div>
            <h2>Register your company</h2>
            <p>Create your own HR workspace</p>
          </div>
        </div>

        {!allowed && <div className="alert alert-error">Registration is turned off on this server.</div>}

        <div className="field">
          <label htmlFor="companyName">Company name</label>
          <input
            id="companyName"
            autoComplete="organization"
            placeholder="Your company"
            {...register('companyName', {
              required: 'Company name is required',
              minLength: { value: 2, message: 'At least 2 characters' },
              maxLength: { value: 150, message: 'Too long' }
            })}
          />
          {errors.companyName && <span className="field-error">{errors.companyName.message}</span>}
        </div>

        <div className="field">
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            autoComplete="name"
            placeholder="Full name"
            {...register('name', { required: 'Your name is required', minLength: { value: 2, message: 'At least 2 characters' } })}
          />
          {errors.name && <span className="field-error">{errors.name.message}</span>}
        </div>

        <div className="field">
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            {...register('email', { required: 'Email is required', pattern: { value: EMAIL_RE, message: 'Enter a valid email' } })}
          />
          <span className="field-hint">You will sign in with this email. You become the company admin.</span>
          {errors.email && <span className="field-error">{errors.email.message}</span>}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" {...register('password', passwordRules)} />
          <span className="field-hint">At least 8 characters, with letters and numbers.</span>
          {errors.password && <span className="field-error">{errors.password.message}</span>}
        </div>

        <div className="field">
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            {...register('confirm', {
              required: 'Please confirm your password',
              validate: (v) => v === getValues('password') || 'Passwords do not match'
            })}
          />
          {errors.confirm && <span className="field-error">{errors.confirm.message}</span>}
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={isSubmitting || !allowed}>
          {isSubmitting ? 'Creating...' : 'Create my company'}
        </button>

        <p className="login-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
