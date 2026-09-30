export const ASSET_METADATA: Record<string, { name: string; color: string; bg: string }> = {
  BTC: { name: 'Bitcoin', color: '#f7931a', bg: 'rgba(247, 147, 26, 0.15)' },
  ETH: { name: 'Ethereum', color: '#8c8cf7', bg: 'rgba(140, 140, 247, 0.15)' },
  SOL: { name: 'Solana', color: '#14f195', bg: 'rgba(20, 241, 149, 0.15)' },
  CKB: { name: 'Nervos Network', color: '#00e1a5', bg: 'rgba(0, 225, 165, 0.15)' },
  DOGE: { name: 'Dogecoin', color: '#c2a633', bg: 'rgba(194, 166, 51, 0.15)' },
};

export function fmtUSD(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtPrice(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(n)) return '—';
  if (Math.abs(n) < 1 && Math.abs(n) > 0) {
    return '$' + n.toPrecision(6);
  }
  return fmtUSD(value);
}

export function fmtQty(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(n)) return '—';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '') || '0';
}

export function fmtPnl(value?: string | number | null, costBasis?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return { text: '—', pct: '', isProfit: false, isLoss: false, ariaLabel: 'unavailable' };
  }
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(n)) {
    return { text: '—', pct: '', isProfit: false, isLoss: false, ariaLabel: 'unavailable' };
  }

  const formatted = fmtUSD(Math.abs(n));
  const cb = costBasis ? (typeof costBasis === 'number' ? costBasis : parseFloat(costBasis)) : 0;
  const pctStr = cb > 0 ? ` (${((n / cb) * 100).toFixed(1)}%)` : '';

  if (n > 0) {
    return { text: `+${formatted}`, pct: pctStr, isProfit: true, isLoss: false, ariaLabel: `profit ${formatted}` };
  }
  if (n < 0) {
    return { text: `−${formatted}`, pct: pctStr, isProfit: false, isLoss: true, ariaLabel: `loss ${formatted}` };
  }
  return { text: formatted, pct: '', isProfit: false, isLoss: false, ariaLabel: 'break even' };
}

export function formatDate(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toISOString().replace('T', ' ').slice(0, 16);
  } catch {
    return isoStr;
  }
}
