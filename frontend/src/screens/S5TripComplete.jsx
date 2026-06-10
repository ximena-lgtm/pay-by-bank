import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './S5TripComplete.css';

export default function S5TripComplete() {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);

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
        {/* Success icon */}
        <div className="success-area">
          <div className="success-circle">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="arrived-title">Has llegado a tu destino</h2>
          <p className="arrived-sub">No se realizó ningún cobro adicional.<br />El pago fue ejecutado al inicio del viaje.</p>
        </div>

        <div className="divider" />

        {/* Trip summary */}
        <p className="label">Resumen del viaje</p>
        <div className="card summary-card">
          {[
            { label: 'Origen',   value: 'El Dorado · Terminal T1' },
            { label: 'Destino',  value: 'Zona Rosa · Calle 85' },
            { label: 'Duración', value: '31 min · 18.4 km' },
            { label: 'Pago',     value: 'COP 18.500 · Nu *8834' },
            { label: 'Estado',   value: 'Liquidado vía Bre-B', highlight: true },
          ].map(row => (
            <div key={row.label} className="summary-row">
              <span className="sum-label">{row.label}</span>
              <span className={`sum-value ${row.highlight ? 'green' : ''}`}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Bre-B banner */}
        <div className="card breb-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <p>Sin cobro adicional · Pago debitado al inicio · Bre-B liquidó en tiempo real</p>
        </div>

        <div className="divider" />

        {/* Rating */}
        <p className="label">¿Cómo estuvo tu viaje?</p>
        <div className="card rating-card">
          {[1,2,3,4,5].map(i => (
            <button key={i} className="star-btn" onClick={() => setRating(i)}>
              <svg width="32" height="32" viewBox="0 0 24 24"
                fill={i <= rating ? 'var(--star)' : 'none'}
                stroke="var(--star)" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          ))}
        </div>

        {/* Receipt */}
        <div className="card receipt-row">
          <div className="receipt-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="2"/>
              <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
          </div>
          <div>
            <p className="receipt-title">Ver recibo</p>
            <p className="receipt-sub">Disponible en Nu y en Uber</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        <div className="cta-area">
          <button className="btn-primary" onClick={() => navigate('/')}>
            Pedir otro Uber
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
