import React, { useState } from 'react';
import type { ImportError } from '@/domain/types';
import { IconList, IconPriceTag, IconUpload, IconX } from '@/components/common/Icons';

interface ImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const [importType, setImportType] = useState<'trades' | 'prices'>('trades');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorResult, setErrorResult] = useState<{
    message: string;
    errors: ImportError[];
    summary: Record<string, number>;
  } | null>(null);

  const handleFileChange = (newFile: File | null) => {
    setFile(newFile);
    setErrorResult(null);
    if (newFile) {
      const name = newFile.name.toLowerCase();
      if (name.includes('price') && importType !== 'prices') {
        setImportType('prices');
      } else if (name.includes('trade') && importType !== 'trades') {
        setImportType('trades');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setUploading(true);
      setErrorResult(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', importType);

      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok && data.ok) {
        onSuccess();
      } else {
        setErrorResult({
          message: data.message || 'Validation failed. No data was changed.',
          errors: data.errors || [],
          summary: data.summary || {},
        });
      }
    } catch (err: any) {
      setErrorResult({
        message: err.message || 'Network error uploading CSV.',
        errors: [],
        summary: {},
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
              {importType === 'trades' ? 'Import Trade History' : 'Import Market Prices'}
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              {importType === 'trades'
                ? 'Atomic replacement of portfolio transactions (trades.csv)'
                : 'Update closing market prices snapshot (prices.csv)'}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-icon" title="Close">
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Trades vs Prices */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-surface)',
            padding: '0.25rem',
            borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            marginBottom: '1.25rem',
            gap: '0.35rem',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setImportType('trades');
              setFile(null);
              setErrorResult(null);
            }}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              border: 'none',
              background: importType === 'trades' ? 'var(--primary)' : 'transparent',
              color: importType === 'trades' ? '#070a12' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s ease',
            }}
          >
            <IconList className="w-4 h-4" />
            <span>Trades CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportType('prices');
              setFile(null);
              setErrorResult(null);
            }}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              border: 'none',
              background: importType === 'prices' ? 'var(--primary)' : 'transparent',
              color: importType === 'prices' ? '#070a12' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s ease',
            }}
          >
            <IconPriceTag className="w-4 h-4" />
            <span>Prices CSV</span>
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
          }}
          style={{
            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border-default)'}`,
            borderRadius: 12,
            padding: '2rem 1.25rem',
            textAlign: 'center',
            background: dragOver ? 'rgba(245, 158, 11, 0.05)' : 'rgba(7, 10, 18, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => {
            const el = document.getElementById('csv-file-input');
            if (el) el.click();
          }}
        >
          <input
            id="csv-file-input"
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
            }}
          />
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--bg-surface-elevated)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
              marginBottom: '0.75rem',
            }}
          >
            <IconUpload className="w-4 h-4" />
          </div>
          <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
            {file
              ? file.name
              : importType === 'trades'
              ? 'Click or drag & drop trades.csv'
              : 'Click or drag & drop prices.csv'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {file
              ? `${(file.size / 1024).toFixed(1)} KB (${(file.size / (1024 * 1024)).toFixed(2)} MB)`
              : 'Maximum file size: 50 MB (UTF-8 formatted)'}
          </p>
          <div
            style={{
              marginTop: '0.65rem',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {importType === 'trades'
              ? 'Columns: trade_id, timestamp, exchange, symbol, side, quantity, price_usd, fee_usd'
              : 'Columns: symbol, price_usd, as_of'}
          </div>
        </div>

        {/* Error Details */}
        {errorResult && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: 8,
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid var(--loss-border)',
                color: '#fda4af',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {errorResult.message}
            </div>

            {errorResult.errors.length > 0 && (
              <div
                style={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                }}
              >
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th className="text-left">Row</th>
                      <th className="text-left">Col</th>
                      <th className="text-right">Value</th>
                      <th className="text-left">Reason</th>
                      <th className="text-left">Remediation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorResult.errors.slice(0, 50).map((err, idx) => (
                      <tr key={idx}>
                        <td className="text-left font-numeric">{err.row ?? '—'}</td>
                        <td className="text-left" style={{ color: 'var(--cyan)' }}>
                          {err.column ?? '—'}
                        </td>
                        <td className="text-right font-numeric" style={{ color: 'var(--loss)' }}>
                          {err.value ?? '—'}
                        </td>
                        <td className="text-left">{err.message}</td>
                        <td className="text-left" style={{ color: 'var(--text-secondary)' }}>
                          {err.hint}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleUpload} className="btn btn-primary" disabled={!file || uploading}>
            {uploading ? 'Validating...' : 'Validate & Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
