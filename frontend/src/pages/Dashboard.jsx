import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import Loader from '../components/Loader';
import Avatar from '../components/Avatar';
import { formatDate } from '../utils/format';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api
      .get('/dashboard')
      .then((r) => alive && setStats(r.data))
      .catch(() => alive && setError('Failed to load dashboard data.'));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return <Loader text="Loading dashboard..." />;

  const max = Math.max(1, ...stats.byDepartment.map((d) => d.count));

  return (
    <div>
      <div className="stats-grid">
        <StatCard title="Total Employees" value={stats.totalEmployees} icon="👥" tone="blue" />
        <StatCard title="Active Employees" value={stats.activeEmployees} icon="✅" tone="green" />
        <StatCard title="Departments" value={stats.departments} icon="🏢" tone="purple" />
        <StatCard title="New Joiners (30d)" value={stats.newJoiners} icon="🆕" tone="orange" />
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h3>Recent Joiners</h3>
            <Link className="btn btn-outline btn-sm" to="/employees">View all</Link>
          </div>
          {stats.recent.length === 0 ? (
            <p className="muted">No employees yet. Add the first one from the Employees page.</p>
          ) : (
            <div className="recent-list">
              {stats.recent.map((e) => (
                <div className="recent-item" key={e.id}>
                  <Avatar name={e.name} />
                  <div className="recent-info">
                    <strong>{e.name}</strong>
                    <span>{e.designation} · {e.department}</span>
                  </div>
                  <span className="recent-date">{formatDate(e.joinDate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Headcount by department</h3>
          </div>
          <ul className="bar-list">
            {stats.byDepartment.map((d) => (
              <li key={d.name}>
                <div className="bar-label"><span>{d.name}</span><strong>{d.count}</strong></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: (d.count / max) * 100 + '%' }} /></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
