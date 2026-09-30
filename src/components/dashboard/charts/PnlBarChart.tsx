import React, { useState } from 'react';
import type { Holding } from '@/domain/types';
import { ASSET_METADATA, fmtUSD } from '@/components/common/Formatters';

interface PnlBarChartProps {
  holdings: Holding[];
}

function getBarPath(
  x: number,
  y: number,
  w: number,
  h: number,
  roundTop: boolean,
  roundBottom: boolean,
  r = 3.5,
): string {
  if (h <= 0 || w <= 0) return '';
  const rEff = Math.min(r, h / 2, w / 2);
  const rtl = roundTop ? rEff : 0;
  const rtr = roundTop ? rEff : 0;
  const rbr = roundBottom ? rEff : 0;
  const rbl = roundBottom ? rEff : 0;

  return (
    `M ${x + rtl} ${y} ` +
    `H ${x + w - rtr} ` +
    (rtr > 0 ? `A ${rtr} ${rtr} 0 0 1 ${x + w} ${y + rtr} ` : '') +
    `V ${y + h - rbr} ` +
    (rbr > 0 ? `A ${rbr} ${rbr} 0 0 1 ${x + w - rbr} ${y + h} ` : '') +
    `H ${x + rbl} ` +
    (rbl > 0 ? `A ${rbl} ${rbl} 0 0 1 ${x} ${y + h - rbl} ` : '') +
    `V ${y + rtl} ` +
    (rtl > 0 ? `A ${rtl} ${rtl} 0 0 1 ${x + rtl} ${y} ` : '') +
    'Z'
  );
}

export function PnlBarChart({ holdings }: PnlBarChartProps) {
  const [hoveredData, setHoveredData] = useState<{
    symbol: string;
    rVal: number;
    uVal: number;
    totalVal: number;
    rRoiStr: string;
    uRoiStr: string;
    totRoiStr: string;
    colCenterX: number;
  } | null>(null);

  if (!holdings || holdings.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '2rem' }}>
        No data available
      </div>
    );
  }

  // Calculate positive and negative extents for stacked scaling
  let maxPos = 0;
  let minNeg = 0;

  holdings.forEach((h) => {
    const r = parseFloat(h.realized_pnl || '0');
    const u = parseFloat(h.unrealized_pnl || '0');
    const pos = (r > 0 ? r : 0) + (u > 0 ? u : 0);
    const neg = (r < 0 ? r : 0) + (u < 0 ? u : 0);
    if (pos > maxPos) maxPos = pos;
    if (neg < minNeg) minNeg = neg;
  });

  // Handle all-zero or minimal dataset
  const peak = Math.max(maxPos, Math.abs(minNeg), 10);

  // Dynamic nice step generation (d3-style adaptive scale)
  const rawInterval = (maxPos - minNeg || peak) / 5;
  const power = Math.floor(Math.log10(rawInterval));
  const magnitude = Math.pow(10, power);
  const fraction = rawInterval / magnitude;

  let step = magnitude;
  if (fraction > 5) {
    step = 10 * magnitude;
  } else if (fraction > 2) {
    step = 5 * magnitude;
  } else if (fraction > 1) {
    step = 2 * magnitude;
  } else {
    step = magnitude;
  }

  if (!isFinite(step) || step <= 0) step = 100;

  // Round upper and lower with 8% headroom
  const upper = Math.ceil((maxPos * 1.08) / step) * step;
  const lower = Math.floor((minNeg * 1.08) / step) * step;
  const range = upper - lower || 1;

  // Generate tick array
  const ticks: number[] = [];
  for (let t = lower; t <= upper + step * 0.05; t += step) {
    ticks.push(Math.round(t * 1000) / 1000);
  }
  if (!ticks.some((t) => Math.abs(t) < 0.001)) {
    ticks.push(0);
    ticks.sort((a, b) => a - b);
  }

  const formatYTick = (val: number) => {
    if (Math.abs(val) < 0.001) return '$0';
    const abs = Math.abs(val);
    const sign = val > 0 ? '+' : '−';
    if (abs >= 1_000_000) {
      return `${sign}$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (abs >= 1_000) {
      return `${sign}$${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    }
    if (abs >= 1) {
      return `${sign}$${Math.round(abs)}`;
    }
    return `${sign}$${abs.toFixed(2)}`;
  };

  const svgWidth = 520;
  const svgHeight = 240;
  const padLeft = 65;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 35;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const getY = (val: number) => padTop + ((upper - val) / range) * chartH;
  const zeroY = getY(0);

  const colW = chartW / holdings.length;
  const barW = Math.min(32, Math.max(18, colW * 0.48));

  return (
    <div style={{ width: '100%', position: 'relative', userSelect: 'none' }}>
      {/* ─── Dedicated Header Slot (72px fixed): Tooltip sits above SVG, NEVER covers bars, ZERO card resize ─── */}
      <div
        style={{
          height: '72px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.25rem',
        }}
      >
        {hoveredData && (
          <div
            style={{
              position: 'absolute',
              top: '0px',
              left: `clamp(135px, ${(hoveredData.colCenterX / svgWidth) * 100}%, calc(100% - 135px))`,
              transform: 'translateX(-50%)',
              zIndex: 30,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 8,
              background: 'rgba(11, 16, 30, 0.96)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(16px)',
              fontSize: '0.74rem',
              minWidth: '225px',
              animation: 'fadeIn 0.12s ease-out',
            }}
          >
            {/* Row 1: Symbol Badge & Net Total */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.65rem',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: '0.25rem',
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  color: ASSET_METADATA[hoveredData.symbol]?.color,
                  fontSize: '0.82rem',
                  padding: '0.05rem 0.35rem',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${ASSET_METADATA[hoveredData.symbol]?.color}40`,
                }}
              >
                {hoveredData.symbol}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Net Total:</span>
                <strong
                  style={{
                    color: hoveredData.totalVal >= 0 ? 'var(--profit)' : 'var(--loss)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {fmtUSD(hoveredData.totalVal)} ({hoveredData.totRoiStr})
                </strong>
              </div>
            </div>

            {/* Row 2: Realized P&L */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--profit)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>Realized P&L:</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <strong
                  style={{
                    color: hoveredData.rVal >= 0 ? 'var(--profit)' : 'var(--loss)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {fmtUSD(hoveredData.rVal)}
                </strong>
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.05rem 0.25rem',
                    borderRadius: 3,
                    background: hoveredData.rVal >= 0 ? 'var(--profit-bg)' : 'var(--loss-bg)',
                    color: hoveredData.rVal >= 0 ? 'var(--profit)' : 'var(--loss)',
                    fontWeight: 700,
                  }}
                >
                  {hoveredData.rRoiStr}
                </span>
              </div>
            </div>

            {/* Row 3: Unrealized P&L */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--cyan)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>Unrealized P&L:</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <strong
                  style={{
                    color: hoveredData.uVal >= 0 ? 'var(--profit)' : 'var(--loss)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {fmtUSD(hoveredData.uVal)}
                </strong>
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.05rem 0.25rem',
                    borderRadius: 3,
                    background: hoveredData.uVal >= 0 ? 'rgba(56, 189, 248, 0.12)' : 'var(--loss-bg)',
                    color: hoveredData.uVal >= 0 ? 'var(--cyan)' : 'var(--loss)',
                    fontWeight: 700,
                  }}
                >
                  {hoveredData.uRoiStr}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: '100%', height: 'auto', maxHeight: 250, overflow: 'visible' }}
      >
        {/* Horizontal gridlines & Y labels */}
        {ticks.map((t, idx) => {
          const y = getY(t);
          const isZero = Math.abs(t) < 0.001;

          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={svgWidth - padRight}
                y2={y}
                stroke={isZero ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.06)'}
                strokeWidth={isZero ? 1.5 : 1}
                strokeDasharray={isZero ? undefined : '3,3'}
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                fill={isZero ? '#fff' : 'var(--text-muted)'}
                fontSize="10"
                fontFamily="var(--font-mono)"
                fontWeight={isZero ? '700' : '500'}
              >
                {formatYTick(t)}
              </text>
            </g>
          );
        })}

        {/* Asset Stacked Bars */}
        {holdings.map((h, i) => {
          const rVal = parseFloat(h.realized_pnl || '0');
          const uVal = parseFloat(h.unrealized_pnl || '0');
          const totalVal = rVal + uVal;
          const cb = parseFloat(h.cost_basis || '0');

          const rRoi = cb > 0 ? (rVal / cb) * 100 : 0;
          const uRoi = cb > 0 ? (uVal / cb) * 100 : 0;
          const totRoi = cb > 0 ? (totalVal / cb) * 100 : 0;

          const rRoiStr = cb > 0 ? `${rVal >= 0 ? '+' : ''}${rRoi.toFixed(1)}%` : '—';
          const uRoiStr = cb > 0 ? `${uVal >= 0 ? '+' : ''}${uRoi.toFixed(1)}%` : '—';
          const totRoiStr = cb > 0 ? `${totalVal >= 0 ? '+' : ''}${totRoi.toFixed(1)}%` : '—';

          const colCenterX = padLeft + (i + 0.5) * colW;
          const barX = colCenterX - barW / 2;

          const isHovered = hoveredData?.symbol === h.symbol;
          const meta = ASSET_METADATA[h.symbol] || { color: '#fbbf24' };

          // Stack segment geometries
          let rBarY = zeroY;
          let rBarH = 0;
          let uBarY = zeroY;
          let uBarH = 0;

          const hasR = Math.abs(rVal) > 0.01;
          const hasU = Math.abs(uVal) > 0.01;

          let rRoundTop = false;
          let rRoundBottom = false;
          let uRoundTop = false;
          let uRoundBottom = false;

          if (rVal >= 0 && uVal >= 0) {
            // Both positive: Realized on zero line, Unrealized stacked on top
            rBarY = getY(rVal);
            rBarH = zeroY - rBarY;
            uBarY = getY(rVal + uVal);
            uBarH = rBarY - uBarY;

            if (hasR && hasU) {
              rRoundTop = false;
              rRoundBottom = false;
              uRoundTop = true;
              uRoundBottom = false;
            } else if (hasR) {
              rRoundTop = true;
              rRoundBottom = false;
            } else if (hasU) {
              uRoundTop = true;
              uRoundBottom = false;
            }
          } else if (rVal <= 0 && uVal <= 0) {
            // Both negative: Realized hangs from zero line, Unrealized stacked below
            rBarY = zeroY;
            rBarH = getY(rVal) - zeroY;
            uBarY = getY(rVal);
            uBarH = getY(rVal + uVal) - uBarY;

            if (hasR && hasU) {
              rRoundTop = false;
              rRoundBottom = false;
              uRoundTop = false;
              uRoundBottom = true;
            } else if (hasR) {
              rRoundTop = false;
              rRoundBottom = true;
            } else if (hasU) {
              uRoundTop = false;
              uRoundBottom = true;
            }
          } else if (rVal < 0 && uVal >= 0) {
            // Realized negative, Unrealized positive
            rBarY = zeroY;
            rBarH = getY(rVal) - zeroY;
            uBarY = getY(uVal);
            uBarH = zeroY - uBarY;

            rRoundTop = false;
            rRoundBottom = true;
            uRoundTop = true;
            uRoundBottom = false;
          } else {
            // Realized positive, Unrealized negative
            rBarY = getY(rVal);
            rBarH = zeroY - rBarY;
            uBarY = zeroY;
            uBarH = getY(uVal) - zeroY;

            rRoundTop = true;
            rRoundBottom = false;
            uRoundTop = false;
            uRoundBottom = true;
          }

          const handleColumnHover = () => {
            setHoveredData({
              symbol: h.symbol,
              rVal,
              uVal,
              totalVal,
              rRoiStr,
              uRoiStr,
              totRoiStr,
              colCenterX,
            });
          };

          const rPath = getBarPath(barX, rBarY, barW, Math.max(rBarH, 2), rRoundTop, rRoundBottom, 4);
          const uPath = getBarPath(barX, uBarY, barW, Math.max(uBarH, 2), uRoundTop, uRoundBottom, 4);

          return (
            <g
              key={h.symbol}
              onMouseEnter={handleColumnHover}
              onMouseMove={handleColumnHover}
              onTouchStart={handleColumnHover}
              onMouseLeave={() => setHoveredData(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Full-height column hitbox */}
              <rect
                x={colCenterX - colW / 2 + 1}
                y={padTop}
                width={colW - 2}
                height={chartH + padBottom}
                fill={isHovered ? 'rgba(255, 255, 255, 0.03)' : 'transparent'}
                rx={6}
                style={{ transition: 'fill 0.15s ease' }}
              />

              {/* Realized Bar */}
              {hasR && (
                <path
                  d={rPath}
                  fill="var(--profit)"
                  stroke={isHovered ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)'}
                  strokeWidth={isHovered ? 1 : 0.5}
                  style={{
                    transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
                  }}
                />
              )}

              {/* Unrealized Bar */}
              {hasU && (
                <path
                  d={uPath}
                  fill="var(--cyan)"
                  stroke={isHovered ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)'}
                  strokeWidth={isHovered ? 1 : 0.5}
                  style={{
                    transition: 'stroke 0.15s ease, stroke-width 0.15s ease',
                  }}
                />
              )}

              {/* X-axis label */}
              <text
                x={colCenterX}
                y={svgHeight - 12}
                textAnchor="middle"
                fill={isHovered ? '#fff' : meta.color}
                fontSize="11"
                fontWeight="800"
                style={{ letterSpacing: '0.04em' }}
              >
                {h.symbol}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
