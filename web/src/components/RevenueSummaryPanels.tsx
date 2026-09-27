import React, { useState, useRef } from 'react';

// Same three payment-type colors already used by the page's own "Revenue Breakdown by
// Payment Type" bar chart (AdminReportsPage.tsx) — kept here, not imported, since that
// chart's colors are inline literals in that file, not an exported constant.
const REVENUE_SEGMENT_COLORS = {
  FULL_GCASH: '#0284C7',
  DOWNPAYMENT_GCASH: '#7C3AED',
  REMAINING_CASH: '#16A34A',
} as const;

const PROFIT_POSITIVE_COLOR = '#059669';
const PROFIT_NEGATIVE_COLOR = '#DC2626';

export interface TrendPeriod {
  label: string;
  startDate: string;
  revenue: number;
  maintenanceCost: number;
  netProfit: number;
}

interface RevenueSummaryPanelsProps {
  totalRevenue: number;
  fullGcash: number;
  downpaymentGcash: number;
  remainingCash: number;
  maintenanceCost: number;
  netProfit: number;
  avgBookingValue: number;
  /** null while loading, undefined/empty means "no trend to show" (hidden gracefully). */
  trendPeriods: TrendPeriod[] | null;
}

function formatPeso(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}₱${Math.abs(rounded).toLocaleString()}`;
}

/** Which period-label indices to actually render, so labels never overlap: all of them
 *  when there are few, otherwise just first/middle/last. */
function visibleLabelIndices(count: number): number[] {
  if (count <= 6) return Array.from({ length: count }, (_, i) => i);
  return [0, Math.floor((count - 1) / 2), count - 1];
}

const TrendGraph: React.FC<{ periods: TrendPeriod[] }> = ({ periods }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 400;
  const height = 72;
  const padding = 6; // keeps the latest-point dot and line stroke from clipping at the edges

  const values = periods.map((p) => p.netProfit);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0, ...values);
  const range = maxV - minV || 1;

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const stepX = periods.length > 1 ? innerWidth / (periods.length - 1) : 0;

  const points = values.map((v, i) => ({
    x: padding + i * stepX,
    y: padding + innerHeight - ((v - minV) / range) * innerHeight,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const last = points[points.length - 1];

  const handleMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - relX);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  };

  const labelIndices = visibleLabelIndices(periods.length);

  return (
    <div className="revenue-trend-wrap">
      <div className="revenue-trend-graph">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <path d={areaPath} fill="rgba(5, 150, 105, 0.14)" stroke="none" />
          <path d={linePath} fill="none" stroke={PROFIT_POSITIVE_COLOR} strokeWidth={2} />
          {hoverIndex !== null && (
            <line
              x1={points[hoverIndex].x}
              x2={points[hoverIndex].x}
              y1={padding}
              y2={height - padding}
              stroke="#D1D5DB"
              strokeWidth={1}
            />
          )}
          <circle cx={last.x} cy={last.y} r={3.5} fill={PROFIT_POSITIVE_COLOR} />
        </svg>
        {hoverIndex !== null && (
          <div
            className="revenue-trend-tooltip"
            style={{ left: `${(points[hoverIndex].x / width) * 100}%` }}
          >
            <div className="revenue-trend-tooltip-label">{periods[hoverIndex].label}</div>
            <div className="revenue-trend-tooltip-value">{formatPeso(periods[hoverIndex].netProfit)}</div>
          </div>
        )}
      </div>
      <div className="revenue-trend-labels">
        {periods.map((p, i) => (
          <span key={p.startDate} className="revenue-trend-label" style={{ opacity: labelIndices.includes(i) ? 1 : 0 }}>
            {labelIndices.includes(i) ? p.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

const RevenueSummaryPanels: React.FC<RevenueSummaryPanelsProps> = ({
  totalRevenue,
  fullGcash,
  downpaymentGcash,
  remainingCash,
  maintenanceCost,
  netProfit,
  avgBookingValue,
  trendPeriods,
}) => {
  const segments = [
    { key: 'FULL_GCASH', label: 'Full GCash', value: fullGcash, color: REVENUE_SEGMENT_COLORS.FULL_GCASH },
    { key: 'DOWNPAYMENT_GCASH', label: 'Downpayment', value: downpaymentGcash, color: REVENUE_SEGMENT_COLORS.DOWNPAYMENT_GCASH },
    { key: 'REMAINING_CASH', label: 'Cash at pickup', value: remainingCash, color: REVENUE_SEGMENT_COLORS.REMAINING_CASH },
  ];

  const showTrendGraph = !!trendPeriods && trendPeriods.length >= 2;
  const netProfitColor = netProfit >= 0 ? PROFIT_POSITIVE_COLOR : PROFIT_NEGATIVE_COLOR;

  return (
    <div className="revenue-summary-panels">
      {/* Panel 1: Revenue */}
      <div className="revenue-summary-panel">
        <div className="revenue-panel-label">Revenue</div>
        <div className="revenue-panel-value">{formatPeso(totalRevenue)}</div>

        {/* No division needed for the percentages — flexGrow ratios are proportional to
            the same amounts shown in the legend below. When totalRevenue is 0, every
            segment's value is 0, so the filter below naturally leaves this empty and it
            renders as a plain gray track (this div's own background), never dividing by
            zero. */}
        <div className="revenue-stacked-bar">
          {segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.key}
                className="revenue-stacked-bar-segment"
                style={{ flexGrow: s.value, backgroundColor: s.color }}
                title={`${s.label}: ${formatPeso(s.value)}`}
              />
            ))}
        </div>

        <div className="revenue-legend">
          {segments.map((s) => (
            <div key={s.key} className="revenue-legend-item">
              <div className="revenue-legend-item-row">
                <span className="revenue-legend-swatch" style={{ backgroundColor: s.color }} />
                <span className="revenue-legend-label">{s.label}</span>
              </div>
              <div className="revenue-legend-amount">{formatPeso(s.value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel 2: Net operating profit */}
      <div className="revenue-summary-panel">
        <div className="revenue-panel-label">Net operating profit</div>

        <div className="net-profit-row">
          <div className="net-profit-value" style={{ color: netProfitColor }}>
            {formatPeso(netProfit)}
          </div>
          {showTrendGraph && <TrendGraph periods={trendPeriods!} />}
        </div>

        <div className="revenue-panel-divider" />

        <div className="net-profit-metrics">
          <div className="net-profit-metric">
            <div className="net-profit-metric-label">Maintenance</div>
            <div className="net-profit-metric-value">{formatPeso(maintenanceCost)}</div>
          </div>
          <div className="net-profit-metric">
            <div className="net-profit-metric-label">Avg. booking</div>
            <div className="net-profit-metric-value">{formatPeso(avgBookingValue)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueSummaryPanels;
