import { EmptyState } from './EmptyState';
import { chartColors } from './chart-colors';

export interface ChartDatum {
  label: string;
  value: number;
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

function formatValue(value: number, valueSuffix: string): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${valueSuffix}`;
}

/** Vertical bar chart. Bars are drawn to scale against the largest value in the dataset. */
export function BarChart({
  data,
  height = 200,
  color = chartColors.pine,
  valueSuffix = '',
  emptyLabel = 'No data yet',
}: {
  data: ChartDatum[];
  height?: number;
  color?: string;
  valueSuffix?: string;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <EmptyState title={emptyLabel} />;
  }

  const width = 600;
  const paddingBottom = 34;
  const paddingTop = 22;
  const plotHeight = height - paddingBottom - paddingTop;
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const barSlot = width / data.length;
  const barWidth = Math.min(56, barSlot * 0.6);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Bar chart">
      {data.map((d, i) => {
        const barHeight = maxValue === 0 ? 0 : (d.value / maxValue) * plotHeight;
        const x = i * barSlot + (barSlot - barWidth) / 2;
        const y = paddingTop + (plotHeight - barHeight);
        return (
          <g key={d.label}>
            <text
              x={x + barWidth / 2}
              y={y - 6}
              textAnchor="middle"
              className="fill-ink-700 font-body"
              style={{ fontSize: 11, fontWeight: 600 }}
            >
              {formatValue(d.value, valueSuffix)}
            </text>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} rx={4} fill={color} />
            <text
              x={x + barWidth / 2}
              y={height - paddingBottom + 18}
              textAnchor="middle"
              className="fill-slate-500 font-body"
              style={{ fontSize: 11 }}
            >
              {d.label.length > 12 ? `${d.label.slice(0, 11)}…` : d.label}
            </text>
          </g>
        );
      })}
      <line x1={0} y1={paddingTop + plotHeight} x2={width} y2={paddingTop + plotHeight} stroke="var(--color-slate-200)" />
    </svg>
  );
}

/** Line chart with a light area fill under the line — for trends over time. */
export function LineChart({
  data,
  height = 200,
  color = chartColors.pine,
  valueSuffix = '',
  emptyLabel = 'No data yet',
}: {
  data: ChartDatum[];
  height?: number;
  color?: string;
  valueSuffix?: string;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <EmptyState title={emptyLabel} />;
  }

  const width = 600;
  const paddingBottom = 28;
  const paddingTop = 22;
  const paddingX = 12;
  const plotHeight = height - paddingBottom - paddingTop;
  const plotWidth = width - paddingX * 2;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const points = data.map((d, i) => {
    const x = data.length === 1 ? paddingX + plotWidth / 2 : paddingX + (i / (data.length - 1)) * plotWidth;
    const y = paddingTop + plotHeight - (maxValue === 0 ? 0 : (d.value / maxValue) * plotHeight);
    return { x, y, d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Line chart">
      <line x1={paddingX} y1={paddingTop + plotHeight} x2={width - paddingX} y2={paddingTop + plotHeight} stroke="var(--color-slate-200)" />
      <path d={areaPath} fill={color} opacity={0.12} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map(({ x, y, d }, i) => (
        <g key={`${d.label}-${i}`}>
          <circle cx={x} cy={y} r={3.5} fill={color} />
          {(i === 0 || i === points.length - 1 || points.length <= 8) && (
            <text x={x} y={y - 10} textAnchor="middle" className="fill-ink-700 font-body" style={{ fontSize: 11, fontWeight: 600 }}>
              {formatValue(d.value, valueSuffix)}
            </text>
          )}
          <text x={x} y={height - paddingBottom + 16} textAnchor="middle" className="fill-slate-500 font-body" style={{ fontSize: 10.5 }}>
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Donut chart with a legend — for status breakdowns (present/absent/late/excused, etc). */
export function DonutChart({
  data,
  size = 160,
  emptyLabel = 'No data yet',
}: {
  data: DonutDatum[];
  size?: number;
  emptyLabel?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return <EmptyState title={emptyLabel} />;
  }

  const radius = 60;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;

  // Pre-compute each segment's dash length and starting offset in a pure
  // pass, rather than mutating a running total while mapping over JSX.
  const segments: { label: string; color: string; dashLength: number; offset: number }[] = [];
  let runningOffset = 0;
  for (const d of data) {
    if (d.value <= 0) continue;
    const dashLength = (d.value / total) * circumference;
    segments.push({ label: d.label, color: d.color, dashLength, offset: runningOffset });
    runningOffset += dashLength;
  }

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label="Donut chart">
        <g transform="rotate(-90 80 80)">
          <circle cx={80} cy={80} r={radius} fill="none" stroke="var(--color-paper-100)" strokeWidth={strokeWidth} />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={80}
              cy={80}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${s.dashLength} ${circumference - s.dashLength}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </g>
        <text x={80} y={76} textAnchor="middle" className="fill-ink-900 font-display" style={{ fontSize: 22, fontWeight: 600 }}>
          {total}
        </text>
        <text x={80} y={94} textAnchor="middle" className="fill-slate-500 font-body" style={{ fontSize: 10.5 }}>
          total
        </text>
      </svg>

      <ul className="flex flex-col gap-2">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-[0.8125rem]">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-ink-700">{d.label}</span>
            <span className="font-semibold text-ink-900">{d.value}</span>
            <span className="text-slate-500">({total === 0 ? 0 : Math.round((d.value / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

