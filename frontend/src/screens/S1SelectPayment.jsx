import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './S1SelectPayment.css';

export default function S1SelectPayment() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('paybybank');

  return (
    <>
      {/* Status bar */}
      <div className="status-bar">
        <span>9:41</span>
        <span>4G 100%</span>
      </div>

      {/* Nav */}
      <div className="nav-bar">
        <h1>Pedir viaje</h1>
      </div>

      {/* Map placeholder */}
      <div className="map-area">
        <div className="route-line">
          <div className="route-dot origin" />
          <div className="route-connector" />
          <div className="route-dot destination">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        </div>
        <div className="route-labels">
          <span>El Dorado · T1</span>
          <span>Zona Rosa · Calle 85</span>
        </div>
      </div>

      <div className="screen-body">
        {/* Trip card */}
        <div className="card trip-card">
          <div className="trip-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="1" y="8" width="22" height="11" rx="3"/><path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/>
              <circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>
            </svg>
          </div>
          <div className="trip-info">
            <p className="trip-name">UberX</p>
            <p className="trip-meta">4 min · aprox. 32 min · 1–4 pasajeros</p>
          </div>
          <div className="trip-price">$18.500</div>
        </div>

        <div className="divider" />

        {/* Payment methods */}
        <p className="label">Método de pago</p>

        <div
          className={`card payment-option ${selected === 'paybybank' ? 'selected' : ''}`}
          onClick={() => { setSelected('paybybank'); navigate('/banks'); }}
        >
          <div className="payment-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <div className="payment-info">
            <p className="payment-name">Pay by bank</p>
            <p className="payment-sub">Pago desde cuentas vinculadas</p>
          </div>
          {selected === 'paybybank' && (
            <div className="radio-check">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5l-4-4 1.41-1.41L10 13.67l6.59-6.59L18 8.5l-8 8z"/>
              </svg>
            </div>
          )}
          {selected !== 'paybybank' && <div className="radio-empty" />}
          <div className={`side-accent ${selected === 'paybybank' ? 'active' : ''}`} />
        </div>

        <div
          className={`card payment-option ${selected === 'visa' ? 'selected' : ''}`}
          onClick={() => setSelected('visa')}
          style={{ marginTop: 8 }}
        >
          <div className="payment-icon muted">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <div className="payment-info">
            <p className="payment-name">Visa *4821</p>
          </div>
          {selected === 'visa' ? (
            <div className="radio-check">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5l-4-4 1.41-1.41L10 13.67l6.59-6.59L18 8.5l-8 8z"/>
              </svg>
            </div>
          ) : (
            <div className="radio-empty" />
          )}
        </div>

        <div className="divider" />

        {/* Disclaimer */}
        <div className="card disclaimer-card">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <p>Uber verificará fondos disponibles antes de confirmar el viaje.</p>
        </div>

        <div className="cta-area">
          <button className="btn-primary" onClick={() => navigate('/banks')}>
            Confirmar · $18.500 COP
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <p className="footer-note">Pago vía Open Finance Colombia · SFC</p>
        </div>
      </div>
    </>
  );
}
