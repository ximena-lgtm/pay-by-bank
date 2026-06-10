import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './S2HubConsent.css';

export default function S2HubConsent() {
  const navigate = useNavigate();
  const [instrument, setInstrument] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('instrument');
    if (raw) setInstrument(JSON.parse(raw));
  }, []);

  function handleProceed() {
    // Store consent token for S3
    if (instrument?.consentToken) {
      sessionStorage.setItem('consentToken', instrument.consentToken);
    }
    navigate('/auth');
  }

  const rows = instrument
    ? [
        { label: 'Desde',    value: instrument.from },
        { label: 'Hacia',    value: instrument.to },
        { label: 'Monto',    value: `COP ${(18500).toLocaleString('es-CO')}` },
        { label: 'Concepto', value: instrument.concept },
        { label: 'Expira',   value: instrument.expiresIn },
      ]
    : [];

  return (
    <>
      {/* Hub branded header — no status bar, this is a webview */}
      <div className="hub-header">
        <div className="hub-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>
          </svg>
          <div>
            <p className="hub-name">Open Finance Hub</p>
            <p className="hub-domain">openfinance.co · <span style={{ color: 'var(--green)' }}>Verificado SFC</span></p>
          </div>
        </div>
      </div>

      <div className="screen-body">
        <h2 className="consent-title">Uber solicita cobrar<br />tu viaje antes de iniciarlo</h2>
        <p className="consent-desc">El pago se ejecuta ahora. El conductor arranca solo cuando se confirme el débito.</p>

        <div className="divider" />

        {/* Instrument card */}
        <div className="card instrument-card">
          <div className="instrument-accent" />
          <div className="instrument-label">Instrumento de pago · Hub</div>
          <div className="instrument-rows">
            {rows.map(r => (
              <div key={r.label} className="instrument-row">
                <span className="inst-label">{r.label}</span>
                <span className="inst-value">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warning */}
        <div className="card warn-card">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>El débito ocurre antes de iniciar el viaje. No es reversible sin gestión con Nu.</p>
        </div>

        {/* SFC reg */}
        <div className="card sfc-card">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <p>{instrument?.sfcRef || 'Uber · Reg. SFC #PISP-2024-042 · Consentimiento de uso único'}</p>
        </div>

        {/* What happens */}
        <p className="what-title">Qué ocurre si autorizas</p>
        <div className="what-list">
          {[
            { icon: 'bolt',  text: 'Se debita COP 18.500 de tu Nu *8834' },
            { icon: 'car',   text: 'El conductor recibe señal de inicio' },
            { icon: 'receipt', text: 'Recibo disponible al terminar el viaje' },
          ].map(item => (
            <div key={item.text} className="what-row">
              <WhatIcon type={item.icon} />
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        <div className="cta-area">
          <div className="btn-row">
            <button className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
            <button className="btn-primary" style={{ width: 'auto', flex: 1 }} onClick={handleProceed}>
              Ir a Nu · Pagar
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
          <p className="footer-note">Serás redirigido a Nu para autenticación</p>
        </div>
      </div>
    </>
  );
}

function WhatIcon({ type }) {
  const icons = {
    bolt: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    car: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="1" y="8" width="22" height="11" rx="3"/><path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/>
        <circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>
      </svg>
    ),
    receipt: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="2"/>
        <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
  };
  return <span className="what-icon">{icons[type]}</span>;
}
