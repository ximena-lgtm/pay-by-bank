import React from 'react';
import { useNavigate } from 'react-router-dom';
import TelarSheet, { TelarEventLog } from '../TelarSheet.jsx';
import { TELAR, formatCOP } from '../brand.js';
import { telarState, logTelarEvent, useTelarEvents, useExpiry } from '../useTelar.js';

/**
 * Consentimiento de PAGO.
 *
 * Uso único, monto exacto, beneficiario nombrado y cuenta regresiva visible.
 * Esa es la diferencia entera con el consentimiento de acceso a datos.
 */
export default function PaymentConsentView() {
  const navigate = useNavigate();
  const bank = telarState.getBank();
  const consent = telarState.getPaymentConsent();
  const mandate = telarState.getMandate();
  const payment = telarState.getPayment();
  const { events } = useTelarEvents(2);
  const { label, expired } = useExpiry(consent?.expiresAt);

  if (!bank || !payment) {
    return (
      <TelarSheet subtitle="Sin pago en curso" onClose={() => navigate('/')}>
        <p className="telar-desc">No hay un pago en curso. Vuelve al viaje e inténtalo de nuevo.</p>
      </TelarSheet>
    );
  }

  function handleAuthorize() {
    logTelarEvent('TRANSITION_VIEW', { view: 'BANK_HANDOFF', detail: bank.id });
    navigate('/phone-home');
  }

  function handleClose() {
    logTelarEvent('EXIT', { detail: 'payment_consent' });
    telarState.reset();
    navigate('/');
  }

  return (
    <TelarSheet subtitle={expired ? 'Autorización vencida' : `Expira en ${label}`} onClose={handleClose}>
      <span className="consent-tag pay">Autorización de pago</span>

      {expired && (
        <div className="telar-error">
          La autorización venció. Vuelve al viaje y confirma de nuevo para generar una nueva.
        </div>
      )}

      <div className="telar-amount">
        <div className="telar-amount-value">${formatCOP(payment.amount)}</div>
        <div className="telar-amount-note">{payment.currency || 'COP'} · débito único</div>
      </div>

      <div className="kv-list">
        <div className="kv-row">
          <span className="kv-key">Desde</span>
          <span className="kv-val">{bank.name} · {bank.accountType} {bank.account}</span>
        </div>
        <div className="kv-row">
          <span className="kv-key">Hacia</span>
          <span className="kv-val">{payment.to}</span>
        </div>
        <div className="kv-row">
          <span className="kv-key">Concepto</span>
          <span className="kv-val">{payment.concept}</span>
        </div>
        <div className="kv-row">
          <span className="kv-key">Liquidación</span>
          <span className="kv-val">Bre-B · inmediata</span>
        </div>
      </div>

      <div className="divider" />

      <p className="label">Sobre esta autorización</p>
      <div className="perm-list">
        <div className="perm-row granted">
          <span className="perm-icon">✓</span>
          <span>
            {mandate?.consentType === 'SINGLE'
              ? 'Vale para este pago y ninguno más'
              : 'Mandato recurrente con topes declarados'}
          </span>
        </div>
        <div className="perm-row denied">
          <span className="perm-icon">✕</span>
          <span>No es un cupo abierto: el tope por orden es exacto</span>
        </div>
        <div className="perm-row denied">
          <span className="perm-icon">✕</span>
          <span>El débito ocurre antes de iniciar el viaje y no es reversible sin gestión con {bank.name}</span>
        </div>
      </div>

      {mandate && (
        <>
          <div className="divider" />
          <p className="label">Límites del mandato</p>
          <div className="kv-list">
            <div className="kv-row">
              <span className="kv-key">Tope por orden</span>
              <span className="kv-val">
                {mandate.maxAmountPerTransaction.currency} {formatCOP(mandate.maxAmountPerTransaction.amount)}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Tope acumulado</span>
              <span className="kv-val">
                {mandate.maxAmountTotal.currency} {formatCOP(mandate.maxAmountTotal.amount)}
              </span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Órdenes permitidas</span>
              <span className="kv-val">{mandate.maxTransactionCount}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Finalidad</span>
              <span className="kv-val">{mandate.purposeLabel || mandate.purposeCode}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Autenticación</span>
              <span className="kv-val">
                {mandate.scaPolicy === 'PER_TRANSACTION' ? 'En cada orden' : 'Una vez, al firmar'}
              </span>
            </div>
          </div>

          <p className="label" style={{ marginTop: 20 }}>Partes</p>
          <div className="kv-list">
            <div className="kv-row">
              <span className="kv-key">Iniciador</span>
              <span className="kv-val">{mandate.parties.initiator.name}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Tu entidad</span>
              <span className="kv-val">{bank.name} · {mandate.parties.debtorAgent.account}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Beneficiario</span>
              <span className="kv-val">{mandate.parties.creditor.name}</span>
            </div>
            <div className="kv-row">
              <span className="kv-key">Confirmación vía</span>
              <span className="kv-val">{mandate.settlementRail}</span>
            </div>
          </div>
        </>
      )}

      <TelarEventLog events={events} />

      <div className="cta-area">
        <button className="btn-primary telar" onClick={handleAuthorize} disabled={expired}>
          Autorizar en {bank.name}
        </button>
        <p className="footer-note">
          Usa tu acceso vigente · no vuelve a pedir vinculación
        </p>
      </div>
    </TelarSheet>
  );
}
