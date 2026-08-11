import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TelarEmbed from '../telar/TelarEmbed.jsx';
import { BankMark } from '../telar/TelarLogo.jsx';
import { TELAR, formatCOP } from '../telar/brand.js';
import { telarState, logTelarEvent, clearTelarEvents } from '../telar/useTelar.js';
import { getAccounts, getBanks, getTrip, initiateLink, createPaymentConsent } from '../api/index.js';
import './S1SelectPayment.css';

/**
 * Checkout del viaje.
 *
 * Con cuenta vinculada muestra las cuentas del titular, no el directorio: ya
 * eligió banco una vez y no se le vuelve a preguntar. Sin cuenta vinculada
 * aparece el buscador embebido y las dos experiencias se encadenan en una sola
 * visita al banco.
 */
export default function S1SelectPayment() {
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [busyBankId, setBusyBankId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Prefetch al montar, no al navegar: el módulo debe estar listo cuando se ve
    Promise.all([getTrip(), getAccounts(), getBanks()]).then(([t, acc, bk]) => {
      if (t.ok) setTrip(t.trip);
      if (acc.ok) {
        setAccounts(acc.accounts);
        if (acc.accounts.length > 0) setSelected(acc.accounts[0].bankId);
      }
      if (bk.ok) setBanks(bk.banks);

      // Un API caído se veía como un directorio vacío, indistinguible de "no hay
      // entidades". Mejor decirlo: el módulo no puede hacer su trabajo.
      if (!bk.ok || !acc.ok) {
        setError(bk.message || acc.message || 'No se pudo contactar al iniciador de pagos. Reintenta en un momento.');
      }
      setLoading(false);
    });
  }, []);

  const hasAccounts = accounts.length > 0;
  const amount = trip?.amount || 18500;
  const paymentSummary = {
    amount,
    currency: trip?.currency || 'COP',
    concept: trip?.concept || 'Viaje UberX',
    to: trip?.merchant || 'Uber Colombia SAS',
  };

  /** Sin cuenta vinculada: encadena vinculación y pago en una sola visita al banco. */
  async function handleSelectBank(bank) {
    setBusyBankId(bank.id);
    setError(null);
    clearTelarEvents();
    logTelarEvent('SELECT_INSTITUTION', { detail: bank.id });

    const data = await initiateLink(bank.id);
    if (!data.ok) {
      setBusyBankId(null);
      setError(data.message || 'No se pudo iniciar la vinculación.');
      return;
    }

    telarState.beginLinkAndPay(paymentSummary);
    telarState.setBank(bank);
    telarState.setDataConsent({ ...data.consent, scope: data.scope });
    logTelarEvent('TRANSITION_VIEW', { view: 'DATA_CONSENT', detail: bank.id });
    navigate('/telar/consent-data');
  }

  /** Con cuenta vinculada: solo hace falta el consentimiento de pago. */
  async function handleConfirm() {
    const account = accounts.find(a => a.bankId === selected);
    if (!account) return;

    setSubmitting(true);
    setError(null);
    clearTelarEvents();
    logTelarEvent('SELECT_ACCOUNT', { detail: `${account.bankId} ${account.account}` });

    const data = await createPaymentConsent(account.bankId, amount);
    if (!data.ok) {
      setSubmitting(false);
      setError(data.message || 'No se pudo crear la autorización de pago.');
      return;
    }

    telarState.beginPayment({ ...paymentSummary, ...data.payment });
    telarState.setBank({
      id: account.bankId,
      name: account.bankName,
      color: account.color,
      monogram: account.monogram,
      account: account.account,
      accountType: account.accountType,
    });
    telarState.setDataConsent({ handle: account.consentHandle, expiresAt: account.expiresAt });
    telarState.setPaymentConsent(data.consent);
    telarState.setMandate(data.mandate);
    logTelarEvent('TRANSITION_VIEW', { view: 'PAYMENT_CONSENT', detail: account.bankId });
    navigate('/telar/consent-payment');
  }

  return (
    <>
      <div className="status-bar">
        <span>9:41</span>
        <span>4G 100%</span>
      </div>

      <div className="nav-bar">
        <h1>Pedir viaje</h1>
      </div>

      <div className="map-area">
        <div className="route-line">
          <div className="route-dot origin" />
          <div className="route-connector" />
          <div className="route-dot destination">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
        </div>
        <div className="route-labels">
          <span>El Dorado · T1</span>
          <span>Zona Rosa · Calle 85</span>
        </div>
      </div>

      <div className="screen-body">
        <div className="card trip-card">
          <div className="trip-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="1" y="8" width="22" height="11" rx="3" />
              <path d="M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
              <circle cx="7" cy="19" r="2" /><circle cx="17" cy="19" r="2" />
            </svg>
          </div>
          <div className="trip-info">
            <p className="trip-name">{trip?.type || 'UberX'}</p>
            <p className="trip-meta">4 min · aprox. 32 min · 1–4 pasajeros</p>
          </div>
          <div className="trip-price">${formatCOP(amount)}</div>
        </div>

        <div className="divider" />

        {error && <div className="telar-error">{error}</div>}

        {hasAccounts ? (
          <>
            {/* Única entrada a Medios de pago cuando ya hay una cuenta vinculada:
                desde ahí se revoca el acceso o se vincula otra cuenta. */}
            <div className="label-row">
              <p className="label">Pagar con</p>
              <button className="label-action" onClick={() => navigate('/payment-methods')}>
                Gestionar
              </button>
            </div>

            {accounts.map(acc => (
              <button
                key={acc.consentHandle}
                className={`telar-account ${selected === acc.bankId ? 'selected' : ''}`}
                onClick={() => setSelected(acc.bankId)}
              >
                <BankMark bank={acc} size={30} radius={9} />
                <span className="telar-account-body">
                  <span className="telar-account-name">
                    {acc.bankName} · {acc.accountType} {acc.account}
                  </span>
                  <span className="telar-account-meta">Débito inmediato vía {TELAR.name}</span>
                </span>
                {selected === acc.bankId ? (
                  <span className="pay-radio on" aria-label="Seleccionada" />
                ) : (
                  <span className="radio-empty" />
                )}
              </button>
            ))}

            <div className="card pay-card-row" onClick={() => setSelected('visa')}>
              <span className="pay-card-chip" aria-hidden="true" />
              <div className="pay-card-body">
                <p className="pay-card-name">Visa *4821</p>
              </div>
              {selected === 'visa' ? <span className="pay-radio on" /> : <span className="radio-empty" />}
            </div>

            <div className="divider" />

            <div className="card verified-card">
              <span className="verified-dot" aria-hidden="true" />
              <p>{TELAR.name} verificó fondos disponibles en tu cuenta.</p>
            </div>

            <div className="cta-area">
              <button
                className="btn-primary"
                onClick={handleConfirm}
                disabled={submitting || selected === 'visa' || !selected}
              >
                {submitting ? 'Preparando autorización…' : `Confirmar · $${formatCOP(amount)} COP`}
              </button>
              <p className="footer-note">
                {selected === 'visa'
                  ? 'El pago con tarjeta no forma parte de este demo. Elige una cuenta bancaria.'
                  : `Autorizarás el débito en tu banco · pago iniciado por ${TELAR.name}`}
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="label">Paga desde tu cuenta bancaria</p>
            <TelarEmbed
              banks={banks}
              loading={loading}
              onSelectBank={handleSelectBank}
              onSeeAll={() => {
                // Desde el checkout el directorio sigue siendo parte de un pago
                telarState.beginLinkAndPay(paymentSummary);
                navigate('/telar/directory');
              }}
              busyBankId={busyBankId}
            />

            <div className="divider" />

            <div className="card pay-card-row" onClick={() => navigate('/payment-methods')}>
              <span className="pay-card-chip" aria-hidden="true" />
              <div className="pay-card-body">
                <p className="pay-card-alt">O paga con Visa *4821</p>
              </div>
              <span className="pm-chevron">›</span>
            </div>

            <div className="cta-area">
              <p className="footer-note">
                {TELAR.name} · {TELAR.role} · {TELAR.supervisor}
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
