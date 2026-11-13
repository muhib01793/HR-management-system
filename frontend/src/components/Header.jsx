import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function titleFor(pathname) {
  if (pathname.startsWith('/employees')) {
    return pathname.includes('new') || pathname.includes('edit') ? 'Employee Form' : 'Employees';
  }
  if (pathname.startsWith('/departments')) return 'Departments';
  if (pathname.startsWith('/users')) return 'Users';
  if (pathname.startsWith('/activity')) return 'Activity log';
  if (pathname.startsWith('/account')) return 'My account';
  return 'Dashboard';
}

export default function Header({ onMenu }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <header className="header">
      <button className="menu-btn" onClick={onMenu} aria-label="Toggle menu">
        ☰
      </button>
      <h1>{titleFor(pathname)}</h1>
      <div className="header-right">
        <div className="user-chip">
          <span className="user-avatar" aria-hidden="true">{user?.name?.charAt(0).toUpperCase()}</span>
          <span className="user-name">{user?.name}</span>
          <span className={'badge badge-role-' + user?.role}>{user?.role === 'admin' ? 'Admin' : 'HR'}</span>
        </div>
        <button className="btn btn-outline" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}
