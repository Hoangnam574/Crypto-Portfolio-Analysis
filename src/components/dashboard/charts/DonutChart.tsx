import React from 'react';
import type { Holding } from '@/domain/types';
import { ASSET_METADATA } from '@/components/common/Formatters';

interface DonutChartProps {
  holdings: Holding[];
  totalValue: string;
}

export function DonutChart({ holdings, totalValue }: DonutChartProps) {
  const activeHoldings = holdings.filter((h) => parseFloat(h.current_value || '0') > 0);
  const total = parseFloat(totalValue) || 1;

  let cumulativeAngle = 0;
  const segments = activeHoldings.map((h) => {
    const val = parseFloat(h.current_value || '0');
    const angle = (val / total) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return {
      symbol: h.symbol,
      value: val,
      color: ASSET_METADATA[h.symbol]?.color || '#888',
      startAngle,
      angle,
    };
  });

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
      {segments.map((seg, idx) => {
        const strokeDasharray = `${(seg.angle / 360) * 283} 283`;
        const strokeDashoffset = -((seg.startAngle / 360) * 283);
        return (
          <circle
            key={idx}
            cx="50"
            cy="50"
            r="45"
            fill="transparent"
            stroke={seg.color}
            strokeWidth="10"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-width 0.2s ease', cursor: 'pointer' }}
          />
        );
      })}
    </svg>
  );
}
