import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';

const links = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/employees', label: 'Employees', icon: '👥' },
  { to: '/departments', label: 'Departments', icon: '🏢' },
  { to: '/users', label: 'Users', icon: '🔐', adminOnly: true },
  { to: '/activity', label: 'Activity log', icon: '📜', adminOnly: true },
  { to: '/account', label: 'My account', icon: '⚙️' }
];

export default function Sidebar({ open, onClose }) {
  const { isAdmin, user } = useAuth();
  const company = user?.company || 'HR Management';
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={'sidebar' + (open ? ' sidebar-open' : '')}>
        <div className="sidebar-brand">
          <span className="brand-logo" aria-hidden="true">{initials(company)}</span>
          <div>
            <strong className="brand-name">{company}</strong>
            <small>HR Management</small>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Main">
          {links
            .filter((l) => !l.adminOnly || isAdmin)
            .map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
                onClick={onClose}
              >
                <span className="nav-icon" aria-hidden="true">{l.icon}</span> {l.label}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-footer">v2.2.0 · HR System</div>
      </aside>
    </>
  );
}
