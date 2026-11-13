export default function StatCard({ title, value, icon, tone = 'blue' }) {
  return (
    <div className={'stat-card stat-' + tone}>
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-title">{title}</div>
      </div>
    </div>
  );
}
