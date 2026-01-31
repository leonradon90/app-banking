import { ReactNode } from 'react';

type Metric = {
  label: string;
  value: string;
  delta?: string;
  caption?: string;
  icon?: ReactNode;
};

type MetricsPanelProps = {
  metrics: Metric[];
  title?: string;
};

export function MetricsPanel({ metrics, title }: MetricsPanelProps) {
  return (
    <div className="glass-panel shadow-panel rounded-3xl border border-[var(--border)] bg-white/70 p-6">
      {title && <h3 className="text-sm font-semibold text-brand-secondary/80">{title}</h3>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-transparent bg-gradient-to-br from-white via-white to-brand-primary/5 p-4 transition hover:border-brand-primary/30"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-secondary/70">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-brand-secondary">{metric.value}</p>
                {metric.caption && <p className="text-xs text-[var(--muted)]">{metric.caption}</p>}
              </div>
              {metric.icon}
            </div>
            {metric.delta && (
              <p className={`mt-3 text-xs font-medium ${metric.delta.startsWith('-') ? 'text-red-500' : 'text-green-500'}`}>
                {metric.delta}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
