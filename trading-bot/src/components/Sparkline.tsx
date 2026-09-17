import React from 'react';
import Svg, { Polyline, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

/** Lightweight SVG sparkline for price history. */
export function Sparkline({
  data,
  width = 74,
  height = 28,
  positive,
}: {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}) {
  if (data.length < 2) {
    return <Svg width={width} height={height} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - 3 - ((v - min) / range) * (height - 6)).toFixed(1)}`)
    .join(' ');
  const up = positive ?? data[data.length - 1] >= data[0];
  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pts}
        fill="none"
        stroke={up ? colors.green : colors.red}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Semicircular AI confidence gauge (0-100). */
export function ConfidenceGauge({ value, label }: { value: number; label: string }) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.max(0, Math.min(100, value));
  // Semicircle from 180° to 0°.
  const angle = Math.PI * (1 - clamped / 100);
  const arcLen = Math.PI * r;
  const dash = (clamped / 100) * arcLen;
  const nx = cx + r * Math.cos(angle);
  const ny = cy - r * Math.sin(angle);
  const color = clamped >= 60 ? colors.green : clamped >= 30 ? colors.gold : colors.textDim;
  return (
    <Svg width={size} height={size * 0.66}>
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke={colors.border}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${nx} ${ny}`}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${arcLen}`}
      />
      <SvgText x={cx} y={cy - 4} textAnchor="middle" fill={colors.text} fontSize="20" fontWeight="800">
        {Math.round(clamped)}%
      </SvgText>
      <SvgText x={cx} y={cy + 12} textAnchor="middle" fill={colors.textDim} fontSize="9">
        {label}
      </SvgText>
    </Svg>
  );
}
