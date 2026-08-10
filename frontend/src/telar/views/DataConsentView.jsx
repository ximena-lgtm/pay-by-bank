import React from 'react';
import { useNavigate } from 'react-router-dom';
import TelarSheet, { TelarEventLog } from '../TelarSheet.jsx';
import { BankMark } from '../TelarLogo.jsx';
import { TELAR, formatCOP } from '../brand.js';
import { telarState, logTelarEvent, useTelarEvents } from '../useTelar.js';

/**
 * Consentimiento de ACCESO A DATOS.
 *
 * Ni un peso en pantalla salvo en el caso encadenado. Solo qué lee Telar, por
 * cuánto tiempo y cómo se revoca.
 */
export default function DataConsentView() {
  const navigate = useNavigate();
  const bank = telarState.getBank();
  const consent = telarState.getDataConsent();
  const flow = telarState.getFlow();
  const payment = telarState.getPayment();
  const { events } = useTelarEvents(2);

  const chained = flow === 'link+pay';

  if (!bank) {
    return (
      <TelarSheet subtitle="Sin entidad seleccionada" onClose={() => navigate('/payment-methods')}>
        <p className="telar-desc">No hay una entidad seleccionada. Vuelve e inténtalo de nuevo.</p>
      </TelarSheet>
    );
  }

  const scope = consent?.scope || [
    { granted: true,  text: 'Confirmar que la cuenta es tuya — nombre y documento' },
    { granted: true,  text: 'Ver el número y tipo de cuenta' },
    { granted: true,  text: 'Consultar si hay fondos antes de cada pago' },
    { granted: false, text: 'No mueve dinero. Cada pago se autoriza aparte.' },
    { granted: false, text: 'No accede a tu historial de movimientos.' },
  ];

  function handleContinue() {
    logTelarEvent('TRANSITION_VIEW', { view: 'BANK_HANDOFF', detail: bank.id });
    navigate('/phone-home');
  }

  function handleClose() {
    logTelarEvent('EXIT', { detail: 'data_consent' });
    telarState.reset();
    navigate(chained ? '/' : '/payment-methods');
  }

  return (
    <TelarSheet subtitle={`${TELAR.role} · ${TELAR.supervisor}`} onClose={handleClose}>
      <span className="consent-tag data">Acceso a datos</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <BankMark bank={bank} size={40} radius={12} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>{bank.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Vincularás tu cuenta de {(bank.accountType || 'ahorros').toLowerCase()}
          </div>
        </div>
      </div>

      <div className="divider" />

      <h2 className="telar-title">
        {TELAR.name} necesita leer tu cuenta para poder usarla después
      </h2>

      <p className="label" style={{ marginTop: 20 }}>Qué autorizas</p>
      <div className="perm-list">
        {scope.map((item, i) => (
          <div key={i} className={`perm-row ${item.granted ? 'granted' : 'denied'}`}>
            <span className="perm-icon">{item.granted ? '✓' : '✕'}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>

      <div className="divider" />

      <div className="kv-list">
        <div className="kv-row">
          <span className="kv-key">Vigencia</span>
          <span className="kv-val">90 días</span>
        </div>
        <div className="kv-row">
          <span className="kv-key">Revocación</span>
          <span className="kv-val">Cuando quieras, desde {bank.name} o {TELAR.name}</span>
        </div>
      </div>

      {chained && payment && (
        <>
          <div className="divider" />
          <span className="consent-tag pay">Y este pago</span>
          <p className="telar-desc" style={{ marginTop: 0 }}>
            Como estás pagando ahora, {bank.name} te pedirá las dos autorizaciones en la misma
            visita. Son consentimientos distintos: el acceso dura 90 días, el pago vale una sola vez.
          </p>
          <div className="kv-list" style={{ marginTop: 12 }}>
            <div className="kv-row big">
              <span className="kv-key">Monto</span>
              <span className="kv-val">COP {formatCOP(payment.amount)}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Hacia</span>
              <span className="kv-val">{payment.to}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Concepto</span>
              <span className="kv-val">{payment.concept}</span>
            </div>
          </div>
        </>
      )}

      <TelarEventLog events={events} />

      <div className="cta-area">
        <button className="btn-primary telar" onClick={handleContinue}>
          Continuar a {bank.name}
        </button>
        <p className="footer-note">{TELAR.legalName} · {TELAR.sfcReg}</p>
      </div>
    </TelarSheet>
  );
}
