import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import Login from '../pages/Login';

function renderLogin() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Login />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

beforeEach(() => localStorage.clear());

test('shows validation errors when form is empty', async () => {
  renderLogin();
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
});

test('shows error for invalid email format', async () => {
  renderLogin();
  fireEvent.input(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } });
  fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
});

test('never shows demo credentials on the login page', () => {
  renderLogin();
  expect(screen.queryByText(/demo credentials/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/admin123/i)).not.toBeInTheDocument();
});
