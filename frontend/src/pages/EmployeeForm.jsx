import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import Loader from '../components/Loader';
import { todayISO } from '../utils/format';
import { EMAIL_RE } from '../utils/validation';


export default function EmployeeForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [fetching, setFetching] = useState(isEdit);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting }
  } = useForm({ defaultValues: { status: 'active', joinDate: todayISO() } });

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get('/employees/' + id)
      .then((r) => reset(r.data))
      .catch(() => {
        toast.error('Employee not found');
        navigate('/employees');
      })
      .finally(() => setFetching(false));
  }, [id, isEdit, navigate, reset, toast]);

  const onSubmit = async (data) => {
    try {
      if (isEdit) {
        await api.put('/employees/' + id, data);
        toast.success('Employee updated successfully');
      } else {
        await api.post('/employees', data);
        toast.success('Employee added successfully');
      }
      navigate('/employees');
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        // Show each server message next to the field it belongs to.
        Object.entries(serverErrors).forEach(([field, message]) => setError(field, { message }));
        toast.error('Please fix the highlighted fields');
      } else if (err.response?.status === 409) {
        setError('email', { message: err.response.data.message });
      } else {
        toast.error(err.response?.data?.message || 'Something went wrong');
      }
    }
  };

  if (fetching) return <Loader text="Loading employee..." />;

  return (
    <div className="card form-card">
      <h3>{isEdit ? 'Edit Employee' : 'Add New Employee'}</h3>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">Full Name *</label>
            <input id="name" maxLength={150} {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })} />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </div>

          <div className="field">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              type="email"
              {...register('email', {
                required: 'Email is required',
                pattern: { value: EMAIL_RE, message: 'Enter a valid email' }
              })}
            />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </div>

          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" maxLength={50} placeholder="+92 3XX XXXXXXX" {...register('phone')} />
            {errors.phone && <span className="field-error">{errors.phone.message}</span>}
          </div>

          <div className="field">
            <label htmlFor="designation">Designation *</label>
            <input id="designation" maxLength={150} {...register('designation', { required: 'Designation is required' })} />
            {errors.designation && <span className="field-error">{errors.designation.message}</span>}
          </div>

          <div className="field">
            <label htmlFor="department">Department *</label>
            <select id="department" {...register('department', { required: 'Department is required' })}>
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
            {errors.department && <span className="field-error">{errors.department.message}</span>}
          </div>

          <div className="field">
            <label htmlFor="salary">Salary (PKR) *</label>
            <input
              id="salary"
              type="number"
              min="0"
              {...register('salary', {
                required: 'Salary is required',
                min: { value: 0, message: 'Salary cannot be negative' },
                valueAsNumber: true
              })}
            />
            {errors.salary && <span className="field-error">{errors.salary.message}</span>}
          </div>

          <div className="field">
            <label htmlFor="joinDate">Join Date *</label>
            <input id="joinDate" type="date" {...register('joinDate', { required: 'Join date is required' })} />
            {errors.joinDate && <span className="field-error">{errors.joinDate.message}</span>}
          </div>

          <div className="field">
            <label htmlFor="status">Status *</label>
            <select id="status" {...register('status', { required: 'Status is required' })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {errors.status && <span className="field-error">{errors.status.message}</span>}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Employee' : 'Add Employee'}
          </button>
          <Link to="/employees" className="btn btn-outline">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
