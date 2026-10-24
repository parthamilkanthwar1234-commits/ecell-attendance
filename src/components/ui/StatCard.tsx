interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'red' | 'amber' | 'purple';
  subtitle?: string;
  className?: string;
}

const colorStyles: Record<
  StatCardProps['color'],
  { bg: string; text: string; ring: string }
> = {
  blue: {
    bg: 'bg-accent-primary/15',
    text: 'text-accent-light',
    ring: 'ring-accent-primary/20',
  },
  green: {
    bg: 'bg-status-success/15',
    text: 'text-status-success',
    ring: 'ring-status-success/20',
  },
  red: {
    bg: 'bg-status-absent/15',
    text: 'text-status-absent',
    ring: 'ring-status-absent/20',
  },
  amber: {
    bg: 'bg-status-late/15',
    text: 'text-status-late',
    ring: 'ring-status-late/20',
  },
  purple: {
    bg: 'bg-status-excused/15',
    text: 'text-status-excused',
    ring: 'ring-status-excused/20',
  },
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  className = '',
}: StatCardProps) {
  const styles = colorStyles[color];

  return (
    <div
      className={`
        group bg-dark-card border border-dark-border rounded-2xl p-5
        hover:border-dark-hover hover:shadow-lg hover:shadow-black/20
        transition-all duration-200 ease-out
        ${className}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white tracking-tight">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        <div
          className={`
            flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center
            ring-1 ${styles.bg} ${styles.ring}
            group-hover:scale-110 transition-transform duration-200
          `}
        >
          <Icon className={`h-5 w-5 ${styles.text}`} />
        </div>
      </div>
    </div>
  );
}
