import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeTrip } from '../api/index.js';
import './S4TripInProgress.css';

export default function S4TripInProgress() {
  const navigate = useNavigate();
  const [eta, setEta] = useState(4);
  const [carPos, setCarPos] = useState(0);

  // Animate car across the map area
  useEffect(() => {
    const interval = setInterval(() => {
      setCarPos(p => (p + 1) % 100);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  async function handleComplete() {
    await completeTrip();
    navigate('/complete');
  }

  return (
    <>
      <div className="status-bar">
        <span>9:41</span>
        <span>4G 100%</span>
      </div>
      <div className="nav-bar">
        <h1>Tu conductor está en camino</h1>
      </div>

      {/* Animated map */}
      <div className="trip-map">
        <div className="car-icon" style={{ left: `${15 + (carPos % 60)}%`, top: '40%' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
            <rect x="1" y="8" width="22" height="11" rx="3"/>
            <path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/>
            <circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>
          </svg>
        </div>
        <div className="dest-pin">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--nu-purple)" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3" fill="var(--nu-purple)"/>
          </svg>
        </div>
      </div>

      <div className="screen-body">
        {/* Driver card */}
        <div className="card driver-card">
          <div className="driver-avatar">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="driver-info">
            <p className="driver-name">Carlos M.</p>
            <p className="driver-vehicle">Toyota Prius · ABC-123</p>
            <div className="driver-stars">
              {[1,2,3,4,5].map(i => (
                <svg key={i} width="13" height="13" viewBox="0 0 24 24"
                  fill={i <= 4 ? 'var(--star)' : 'none'}
                  stroke="var(--star)" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ))}
              <span className="rating">4.92</span>
            </div>
          </div>
        </div>

        {/* ETA card */}
        <div className="card eta-card">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <div>
            <span className="eta-main">Llega en {eta} min</span>
            <span className="eta-sep"> · </span>
            <span className="eta-sub">aprox. 32 min de viaje</span>
          </div>
        </div>

        {/* Payment status */}
        <div className="card paid-card">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div>
            <p className="paid-title">Pago ejecutado</p>
            <p className="paid-sub">COP 18.500 debitado de Nu *8834 · Bre-B liquidado</p>
          </div>
        </div>

        {/* No extra charge */}
        <div className="card nocharge-card">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <p>Al llegar a tu destino puedes bajarte. Sin pago adicional.</p>
        </div>

        <div className="cta-area">
          <button className="btn-secondary dim" onClick={handleComplete}>Cancelar viaje</button>
        </div>
      </div>
    </>
  );
}
