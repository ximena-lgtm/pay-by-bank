import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TELAR, formatCOP, formatDate } from '../telar/brand.js';
import { telarState } from '../telar/useTelar.js';
import './S5TripComplete.css';

/**
 * Recibo.
 *
 * Deja constancia de quién inició el pago y con qué autorización: el iniciador
 * es Telar, el comercio es Uber, y el consentimiento de pago era de uso único.
 */
export default function S5TripComplete() {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);

  const bank = telarState.getBank();
  const payment = telarState.getPayment();
  const result = telarState.getResult();
  const dataConsent = telarState.getDataConsent();

  const reference = result?.intent?.reference || result?.paymentId || 'MOL-48213307';

  const rows = [
    { label: 'Origen',        value: 'El Dorado · Terminal T1' },
    { label: 'Destino',       value: 'Zona Rosa · Calle 85' },
    { label: 'Duración',      value: '31 min · 18.4 km' },
    { label: 'Pago',          value: `COP ${formatCOP(payment?.amount)} · ${bank?.name || ''} ${bank?.account || ''}` },
    { label: 'Iniciado por',  value: `${TELAR.name} · PISP`, tone: 'blue' },
    { label: 'Autorización',  value: `Uso único · ${reference}` },
    { label: 'Estado',        value: 'Liquidado vía Bre-B', tone: 'green' },
  ];

  function handleNewTrip() {
    // Se conserva el acceso a datos: solo se limpia el pago en curso
    telarState.setPaymentConsent(null);
    telarState.setResult(null);
    telarState.setPayment(null);
    navigate('/');
  }

  return (
    <>
      <div className="status-bar">
        <span>9:41</span>
        <span>4G 100%</span>
      </div>
      <div className="nav-bar">
        <h1>Viaje completado</h1>
      </div>

      <div className="screen-body">
        <div className="success-area">
          <div className="success-circle">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="arrived-title">Has llegado a tu destino</h2>
          <p className="arrived-sub">
            No se realizó ningún cobro adicional.<br />
            El pago fue ejecutado al inicio del viaje.
          </p>
        </div>

        <div className="divider" />

        <p className="label">Resumen del viaje</p>
        <div className="card summary-card">
          {rows.map(row => (
            <div key={row.label} className="summary-row">
              <span className="sum-label">{row.label}</span>
              <span className={`sum-value ${row.tone || ''}`}>{row.value}</span>
            </div>
          ))}
        </div>

        <div className="card breb-banner">
          <span className="breb-dot" aria-hidden="true" />
          <p>Sin cobro adicional · Pago debitado al inicio · Bre-B liquidó en tiempo real</p>
        </div>

        {dataConsent?.expiresAt && (
          <div className="card consent-note">
            <p>
              Tu acceso a datos con {bank?.name} sigue vigente hasta {formatDate(dataConsent.expiresAt)}.
              Puedes revocarlo desde Medios de pago.
            </p>
            <button className="consent-note-link" onClick={() => navigate('/payment-methods')}>
              Ver consentimientos
            </button>
          </div>
        )}

        <div className="divider" />

        <p className="label">¿Cómo estuvo tu viaje?</p>
        <div className="card rating-card">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              className="star-btn"
              onClick={() => setRating(i)}
              aria-label={`${i} estrellas`}
            >
              <svg width="30" height="30" viewBox="0 0 24 24"
                fill={i <= rating ? 'var(--star)' : 'none'}
                stroke="var(--star)" strokeWidth="1.8">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>

        <div className="card receipt-row">
          <div className="receipt-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="2" />
              <line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p className="receipt-title">Ver recibo</p>
            <p className="receipt-sub">Disponible en {bank?.name || 'tu banco'} y en Uber</p>
          </div>
          <span className="pm-chevron">›</span>
        </div>

        <div className="cta-area">
          <button className="btn-primary" onClick={handleNewTrip}>
            Pedir otro Uber
          </button>
        </div>
      </div>
    </>
  );
}
