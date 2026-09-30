import React from 'react';
import { IconAlertTriangle } from '@/components/common/Icons';

interface ResetModalProps {
  isOpen: boolean;
  resetting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResetModal({ isOpen, resetting, onClose, onConfirm }: ResetModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 440, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'rgba(244, 63, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--loss)',
            }}
          >
            <IconAlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>Reset Database?</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Restore original 200 synthetic trades
            </p>
          </div>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
          This action will purge current records and reseed the database using the 200 sample transactions and price snapshots from{' '}
          <code style={{ color: 'var(--cyan)' }}>/data</code>.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
          <button onClick={onClose} className="btn btn-secondary" disabled={resetting}>
            Cancel
          </button>
          <button onClick={onConfirm} className="btn btn-danger" disabled={resetting}>
            {resetting ? 'Resetting...' : 'Confirm Reset'}
          </button>
        </div>
      </div>
    </div>
  );
}
