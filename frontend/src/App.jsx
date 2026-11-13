import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import Loader from './components/Loader';

// Each page is downloaded only when it is opened.
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Employees = lazy(() => import('./pages/Employees'));
const EmployeeForm = lazy(() => import('./pages/EmployeeForm'));
const Departments = lazy(() => import('./pages/Departments'));
const Users = lazy(() => import('./pages/Users'));
const Account = lazy(() => import('./pages/Account'));
const Activity = lazy(() => import('./pages/Activity'));

export default function App() {
  return (
    <Suspense fallback={<Loader full />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="employees" element={<Employees />} />
            <Route path="employees/new" element={<EmployeeForm />} />
            <Route path="employees/:id/edit" element={<EmployeeForm />} />
            <Route path="departments" element={<Departments />} />
            <Route path="account" element={<Account />} />
            <Route element={<AdminRoute />}>
              <Route path="users" element={<Users />} />
              <Route path="activity" element={<Activity />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
