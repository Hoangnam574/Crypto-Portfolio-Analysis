import React from 'react';

export interface FormulaTipState {
  title: string;
  formula: string;
  calc?: string;
  desc?: string;
  x: number;
  y: number;
  placement: 'top' | 'bottom';
}

export function FormulaTooltipPortal({ tip }: { tip: FormulaTipState | null }) {
  if (!tip) return null;

  const left =
    typeof window !== 'undefined'
      ? Math.max(175, Math.min(tip.x, window.innerWidth - 175))
      : tip.x;

  const top =
    tip.placement === 'top'
      ? Math.max(12, tip.y - 10)
      : tip.y + 10;

  return (
    <div
      className={`formula-tooltip-portal placement-${tip.placement}`}
      style={{ left, top }}
    >
      <div className="formula-tooltip-content">
        <div className="formula-tooltip-header">
          <span className="formula-badge">FORMULA</span>
          <span className="formula-title">{tip.title}</span>
        </div>
        <div className="formula-code">
          <code>{tip.formula}</code>
        </div>
        {tip.calc && (
          <div className="formula-calc">
            <code>{tip.calc}</code>
          </div>
        )}
        {tip.desc && <div className="formula-desc">{tip.desc}</div>}
      </div>
    </div>
  );
}

export function createFormulaProps(
  setFormulaTip: (tip: FormulaTipState | null) => void,
) {
  return (
    title: string,
    formula: string,
    calc?: string,
    desc?: string,
    placement: 'top' | 'bottom' = 'top',
  ) => ({
    'data-formula': 'true',
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const targetY = placement === 'top' ? rect.top : rect.bottom;
      setFormulaTip({
        title,
        formula,
        calc,
        desc,
        x: centerX,
        y: targetY,
        placement,
      });
    },
    onMouseLeave: () => {
      setFormulaTip(null);
    },
  });
}
