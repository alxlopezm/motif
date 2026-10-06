interface Stat {
  label: string;
  value: number;
  sub: string;
}

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="stat-cards">
      {stats.map((s) => (
        <div className="stat-card" key={s.label}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-row">
            <span className="stat-number">{s.value}</span>
            <span className="stat-sub">{s.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
