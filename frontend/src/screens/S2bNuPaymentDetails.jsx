import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './S2bNuPaymentDetails.css';

export default function S2bNuPaymentDetails() {
  const navigate = useNavigate();
  const [instrument, setInstrument] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('instrument');
    if (raw) setInstrument(JSON.parse(raw));
  }, []);

  function handleContinue() {
    // Store consent token for authentication
    if (instrument?.consentToken) {
      sessionStorage.setItem('consentToken', instrument.consentToken);
    }
    navigate('/auth');
  }

  return (
    <>
      {/* Nu branded header */}
      <div className="nu-header">
        <div className="nu-wordmark">Nu</div>
        <div className="nu-subtitle">Solicitud de pago</div>
      </div>

      <div className="screen-body">
        {/* Redirect notice */}
        <div className="card redirect-notice">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>Solicitud vía Open Finance Hub · Uber</span>
        </div>

        <h2 className="details-title">Uber solicita<br />autorización de pago</h2>
        <p className="details-desc">Revisa los detalles antes de autorizar este débito.</p>

        <div className="divider" />

        {/* Payment summary card */}
        <div className="card payment-details-card">
          <div className="pd-accent" />
          <div className="pd-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--nu-purple)" strokeWidth="2">
              <rect x="1" y="8" width="22" height="11" rx="3"/>
              <path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/>
              <circle cx="7" cy="19" r="2"/>
              <circle cx="17" cy="19" r="2"/>
            </svg>
            <span>Viaje Uber</span>
          </div>

          <div className="pd-rows">
            <div className="pd-row">
              <span className="pd-label">Comercio</span>
              <span className="pd-value">Uber Colombia SAS</span>
            </div>
            <div className="pd-row">
              <span className="pd-label">Concepto</span>
              <span className="pd-value">Viaje UberX · El Dorado → Zona Rosa</span>
            </div>
            <div className="pd-row highlight">
              <span className="pd-label">Monto</span>
              <span className="pd-value amount">COP 18.500</span>
            </div>
            <div className="pd-row">
              <span className="pd-label">Desde</span>
              <span className="pd-value">Nu *8834</span>
            </div>
            <div className="pd-row">
              <span className="pd-label">Tipo</span>
              <span className="pd-value">Débito directo · PISP</span>
            </div>
            <div className="pd-row">
              <span className="pd-label">Expira en</span>
              <span className="pd-value">5 minutos</span>
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="card info-card">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--nu-purple)" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <p>El pago se ejecuta inmediatamente después de autorizar.</p>
        </div>

        <div className="card info-card">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <p>Se requiere autenticación fuerte (2 factores) según Decreto 368/2026.</p>
        </div>

        <p className="sfc-note">Registro SFC #PISP-2024-042 · Consentimiento de uso único</p>

        <div className="cta-area">
          <button className="btn-primary nu" onClick={handleContinue}>
            Continuar a autenticación
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button className="btn-secondary" onClick={() => navigate('/')}>Cancelar solicitud</button>
        </div>
      </div>
    </>
  );
}
