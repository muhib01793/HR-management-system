import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem('hr_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  // Refresh the profile on load so role changes made by an admin show up without logging in again.
  useEffect(() => {
    if (!localStorage.getItem('hr_token')) return;
    api
      .get('/auth/me')
      .then(({ data }) => {
        localStorage.setItem('hr_user', JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('hr_token', data.token);
    localStorage.setItem('hr_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  // A new company signs up: creates the company and its first admin, then signs in.
  const registerCompany = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('hr_token', data.token);
    localStorage.setItem('hr_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  // Update the stored profile after a change such as renaming the company.
  const updateUser = (patch) => {
    setUser((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem('hr_user', JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    localStorage.removeItem('hr_token');
    localStorage.removeItem('hr_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, registerCompany, updateUser, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
