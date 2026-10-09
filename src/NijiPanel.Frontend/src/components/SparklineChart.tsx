import React from 'react';

interface SparklineChartProps {
  data: number[];
  secondaryData?: number[];
  color: string;
  secondaryColor?: string;
  fillColor?: string;
  height?: number;
  label?: string;
  unit?: string;
  minVal?: number;
  maxVal?: number;
}

export const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  secondaryData,
  color,
  secondaryColor = '#06b6d4',
  fillColor,
  height = 40,
  label,
  unit = '%',
  minVal = 0,
  maxVal
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="w-full bg-carbon-850/50 rounded flex items-center justify-center text-[10px] text-carbon-500 font-mono">
        Waiting for metrics...
      </div>
    );
  }

  const width = 240;
  const paddingY = 4;
  const paddingX = 2;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  // Determine scale
  const allValues = secondaryData ? [...data, ...secondaryData] : data;
  const computedMax = maxVal !== undefined ? maxVal : Math.max(...allValues, minVal + 1);
  const effectiveMax = Math.max(computedMax, 1);
  const effectiveMin = minVal;
  const range = effectiveMax - effectiveMin || 1;

  const getPoints = (values: number[]) => {
    return values.map((val, idx) => {
      const x = paddingX + (idx / Math.max(values.length - 1, 1)) * innerWidth;
      const normalized = Math.min(1, Math.max(0, (val - effectiveMin) / range));
      const y = paddingY + innerHeight - normalized * innerHeight;
      return { x, y };
    });
  };

  const points = getPoints(data);

  // Generate smooth SVG curve path using cubic bezier
  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const linePath = createSmoothPath(points);
  const areaPath = points.length >= 2
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(height - paddingY).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height - paddingY).toFixed(1)} Z`
    : '';

  const secondaryPoints = secondaryData ? getPoints(secondaryData) : null;
  const secondaryLinePath = secondaryPoints ? createSmoothPath(secondaryPoints) : null;

  const currentVal = data[data.length - 1];
  const lastPoint = points[points.length - 1];

  const gradId = `spark-grad-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className="w-full relative group">
      <div className="relative w-full overflow-hidden rounded bg-carbon-900/60 border border-carbon-800/80">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full block"
          style={{ height }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor || color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={fillColor || color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background grid line at 50% */}
          <line
            x1={paddingX}
            y1={height / 2}
            x2={width - paddingX}
            y2={height / 2}
            stroke="#262930"
            strokeDasharray="2 3"
            strokeWidth="0.8"
          />

          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill={`url(#${gradId})`} />
          )}

          {/* Main line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Secondary line (if RX/TX) */}
          {secondaryLinePath && (
            <path
              d={secondaryLinePath}
              fill="none"
              stroke={secondaryColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="3 1.5"
            />
          )}

          {/* End ping dot */}
          {lastPoint && (
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="2.5"
              fill={color}
              className="drop-shadow-[0_0_4px_rgba(255,209,0,0.8)]"
            />
          )}
        </svg>

        {/* Floating current value on right */}
        <div className="absolute right-1.5 top-1 px-1 py-0.2 rounded bg-carbon-950/80 border border-carbon-800 text-[10px] font-mono leading-none text-carbon-200">
          <span style={{ color }}>{typeof currentVal === 'number' ? currentVal.toFixed(1) : currentVal}</span>
          <span className="text-carbon-400 text-[9px] ml-0.5">{unit}</span>
        </div>
      </div>
    </div>
  );
};
