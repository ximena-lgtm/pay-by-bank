import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TELAR, formatCOP } from '../telar/brand.js';
import { telarState, logTelarEvent } from '../telar/useTelar.js';
import { activateLink, createPaymentConsent, authorizePayment } from '../api/index.js';
import '../telar/telar.css';   // consent-tag, kv-list y telar-error
import './S3NuSCA.css';

const SCA_METHODS = [
  { id: 'biometric_face_id', name: 'Face ID',        desc: 'Biometría del dispositivo' },
  { id: 'otp_sms',           name: 'Clave dinámica', desc: '6 dígitos por SMS' },
];

/**
 * Autenticación reforzada y otorgamiento del consentimiento.
 *
 * Tiene tres modos porque el consentimiento que se otorga cambia según de dónde
 * venga el usuario. En el modo encadenado el banco pide una sola autenticación
 * y Telar ancla dos consentimientos distintos: uno de acceso a 90 días y uno de
 * pago de uso único.
 */
export default function S3NuSCA() {
  const navigate = useNavigate();
  const [method, setMethod] = useState('biometric_face_id');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const bank = telarState.getBank();
  const payment = telarState.getPayment();
  const dataConsent = telarState.getDataConsent();
  const flow = telarState.getFlow();

  const grantsAccess = flow === 'link' || flow === 'link+pay';
  const grantsPayment = flow === 'pay' || flow === 'link+pay';

  if (!bank) {
    return (
      <div className="screen-body" style={{ paddingTop: 40 }}>
        <p className="telar-desc">No hay una solicitud en curso.</p>
      </div>
    );
  }

  // Un pago sin monto es un estado roto, no una autorización por cero pesos.
  // Antes que mostrarla, se corta: nadie debería firmar un débito vacío.
  if (grantsPayment && !payment?.amount) {
    return (
      <>
        <div className="bank-header" style={{ background: bank.color }}>
          <div className="bank-header-top" />
          <div className="bank-wordmark">{bank.name}</div>
          <div className="bank-subtitle">Solicitud incompleta</div>
        </div>
        <div className="screen-body">
          <div className="telar-error" style={{ marginTop: 18 }}>
            La solicitud llegó sin un monto que autorizar. No se firmó nada.
            Vuelve al viaje e inténtalo de nuevo.
          </div>
          <div className="cta-area">
            <button
              className="btn-primary"
              onClick={() => { telarState.reset(); navigate('/'); }}
            >
              Volver al viaje
            </button>
          </div>
        </div>
      </>
    );
  }

  async function handleAuthorize() {
    setLoading(true);
    setError(null);

    try {
      // 1. Otorgar el acceso a datos, si esta visita lo incluye
      if (grantsAccess) {
        const res = await activateLink(dataConsent?.handle, method, bank.id);
        if (!res.ok) throw new Error(res.message || 'No se pudo otorgar el acceso.');
        telarState.setDataConsent({ ...dataConsent, ...res.consent });
        logTelarEvent('DATA_CONSENT_GRANTED', { detail: `scope=accounts,balances · 90d` });
      }

      // Solo vinculación: termina aquí, sin mover dinero
      if (!grantsPayment) {
        setLoading(false);
        navigate('/telar/linked');
        return;
      }

      // 2. El consentimiento de pago cuelga del de acceso, así que se ancla ahora
      let paymentConsent = telarState.getPaymentConsent();
      if (!paymentConsent) {
        const created = await createPaymentConsent(bank.id, payment?.amount);
        if (!created.ok) throw new Error(created.message || 'No se pudo crear la autorización de pago.');
        paymentConsent = created.consent;
        telarState.setPaymentConsent(paymentConsent);
        telarState.setMandate(created.mandate);
        telarState.setPayment({ ...payment, ...created.payment });
        logTelarEvent('PAYMENT_CONSENT_CREATED', { detail: 'single_use · 5 min' });
      }

      // 3. Autorizar el débito
      const res = await authorizePayment(paymentConsent.handle, method, bank.id, payment?.amount);
      if (!res.ok) throw new Error(res.message || 'No se pudo autorizar el pago.');

      telarState.setResult(res);
      logTelarEvent('PAYMENT_CONSENT_GRANTED', { detail: 'single_use' });
      logTelarEvent('INTENT_COMMITTED', { detail: res.intent?.handle });

      setLoading(false);
      navigate('/processing');
    } catch (e) {
      setLoading(false);
      setError(e.message);
    }
  }

  function handleReject() {
    logTelarEvent('EXIT', { detail: 'rejected_at_bank' });
    telarState.reset();
    navigate('/');
  }

  const title = grantsPayment && grantsAccess
    ? 'Autoriza el acceso y el pago'
    : grantsPayment
      ? 'Autoriza el débito'
      : 'Autoriza el acceso a tu cuenta';

  return (
    <>
      <div className="bank-header" style={{ background: bank.color }}>
        <div className="bank-header-top" />
        <div className="bank-wordmark">{bank.name}</div>
        <div className="bank-subtitle">
          {grantsPayment ? 'Autorización de pago' : 'Solicitud de acceso a datos'}
        </div>
      </div>

      <div className="screen-body">
        <div className="card requester-note">
          <span className="requester-dot" aria-hidden="true" />
          <p>
            {grantsPayment
              ? `Pago iniciado por ${TELAR.name} · comercio: ${payment?.to || 'Uber Colombia SAS'}`
              : `Solicitud recibida de ${TELAR.name}, ${TELAR.role.toLowerCase()}`}
          </p>
        </div>

        <h2 className="sca-title">{title}</h2>

        {error && <div className="telar-error" style={{ marginTop: 14 }}>{error}</div>}

        {grantsAccess && (
          <div className="sca-block">
            <span className="consent-tag data">Acceso a datos</span>
            <div className="kv-list">
              <div className="kv-row">
                <span className="kv-key">Cuenta</span>
                <span className="kv-val">{bank.accountType} {bank.account}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Permite</span>
                <span className="kv-val">Titularidad y saldo</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Vigencia</span>
                <span className="kv-val">90 días · revocable</span>
              </div>
            </div>
          </div>
        )}

        {grantsPayment && (
          <div className="sca-block">
            <span className="consent-tag pay">Autorización de pago</span>
            <div className="kv-list">
              <div className="kv-row big">
                <span className="kv-key">Monto</span>
                <span className="kv-val">COP {formatCOP(payment?.amount)}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Desde</span>
                <span className="kv-val">{bank.accountType} {bank.account}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Hacia</span>
                <span className="kv-val">{payment?.to || 'Uber Colombia SAS'}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Vigencia</span>
                <span className="kv-val">Uso único</span>
              </div>
            </div>
          </div>
        )}

        <div className="divider" />

        <p className="label">Autenticación reforzada · Decreto 368/2026</p>

        {SCA_METHODS.map(m => (
          <button
            key={m.id}
            className={`sca-method ${method === m.id ? 'selected' : ''}`}
            onClick={() => setMethod(m.id)}
            style={method === m.id ? { borderColor: bank.color, background: `${bank.color}0F` } : undefined}
          >
            <span
              className="sca-radio"
              style={method === m.id ? { borderColor: bank.color, background: bank.color } : undefined}
            />
            <span className="sca-method-body">
              <span className="sca-method-name">{m.name}</span>
              <span className="sca-method-desc">{m.desc}</span>
            </span>
          </button>
        ))}

        <div className="cta-area">
          <button
            className="btn-primary"
            style={{ background: bank.color }}
            onClick={handleAuthorize}
            disabled={loading}
          >
            {loading
              ? 'Autorizando…'
              : grantsPayment
                ? `Autorizar $${formatCOP(payment?.amount)}`
                : 'Autorizar acceso'}
          </button>
          <button className="btn-secondary" onClick={handleReject} disabled={loading}>
            Rechazar
          </button>
        </div>
      </div>
    </>
  );
}
