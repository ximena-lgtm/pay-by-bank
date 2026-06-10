import React from 'react';
import './ConsentDetailsModal.css';

export default function ConsentDetailsModal({ consent, onClose }) {
  if (!consent) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Detalles del Consentimiento</h3>
          <button className="modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="consent-field">
            <label>Anchor ID (Ledger)</label>
            <div className="consent-value code">{consent.handle || consent.consent_id}</div>
          </div>

          <div className="consent-field">
            <label>Wallet (Titular)</label>
            <div className="consent-value code">{consent.wallet}</div>
          </div>

          <div className="consent-field">
            <label>TPP</label>
            <div className="consent-value">
              <span className="consent-badge">{consent.tpp_id}</span>
              <span className="consent-text">{consent.tpp_legal_name || 'Uber Colombia SAS'}</span>
            </div>
          </div>

          <div className="consent-field">
            <label>Banco (Data Provider)</label>
            <div className="consent-value">
              <span className="consent-badge">{consent.bank_id}</span>
              <span className="consent-text">{consent.data_provider_id}</span>
            </div>
          </div>

          <div className="consent-field">
            <label>Estado</label>
            <div className="consent-value">
              <span className={`status-badge ${consent.status}`}>{consent.status}</span>
            </div>
          </div>

          {consent.granted_at && (
            <div className="consent-field">
              <label>Otorgado</label>
              <div className="consent-value">{new Date(consent.granted_at).toLocaleString('es-CO')}</div>
            </div>
          )}

          {consent.expires_at && (
            <div className="consent-field">
              <label>Expira</label>
              <div className="consent-value">{new Date(consent.expires_at).toLocaleString('es-CO')}</div>
            </div>
          )}

          {consent.sca_method && (
            <div className="consent-field">
              <label>Método SCA</label>
              <div className="consent-value">
                <span className="consent-badge">{consent.sca_method}</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
