import React from 'react';
import { useNavigate } from 'react-router-dom';
import TelarSheet, { TelarEventLog } from '../TelarSheet.jsx';
import { TELAR, formatDate } from '../brand.js';
import { telarState, useTelarEvents, logTelarEvent } from '../useTelar.js';

/**
 * Cierre de la experiencia de vinculación.
 *
 * Termina sin haber movido dinero: ese es el punto de separar los consentimientos.
 */
export default function LinkSuccessView() {
  const navigate = useNavigate();
  const bank = telarState.getBank();
  const consent = telarState.getDataConsent();
  const { events } = useTelarEvents(2);

  function handleReturn() {
    logTelarEvent('SUCCESS', { detail: 'account_linked' });
    telarState.reset();
    navigate('/payment-methods');
  }

  return (
    <TelarSheet subtitle="Vinculación completa">
      <div className="telar-success-ring">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 className="telar-title" style={{ textAlign: 'center', marginTop: 18 }}>
        Tu cuenta {bank?.name} quedó vinculada
      </h2>
      <p className="telar-desc" style={{ textAlign: 'center' }}>
        Ya puedes pagar tus viajes desde ella. Te pediremos autorización en cada pago.
      </p>

      <div className="divider" />

      <div className="kv-list">
        <div className="kv-row">
          <span className="kv-key">Cuenta</span>
          <span className="kv-val">{bank?.name} · {bank?.accountType} {bank?.account}</span>
        </div>
        <div className="kv-row">
          <span className="kv-key">Acceso vigente hasta</span>
          <span className="kv-val">{formatDate(consent?.expiresAt)}</span>
        </div>
        <div className="kv-row">
          <span className="kv-key">Consentimiento</span>
          <span className="kv-val" style={{ color: 'var(--telar-mint-ink)' }}>Activo · datos</span>
        </div>
      </div>

      <TelarEventLog events={events} />

      <div className="cta-area">
        <button className="btn-primary telar" onClick={handleReturn}>
          Volver a Uber
        </button>
        <p className="footer-note">{TELAR.legalName} · {TELAR.sfcReg}</p>
      </div>
    </TelarSheet>
  );
}
