import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TelarEmbed from '../telar/TelarEmbed.jsx';
import TelarLogo, { BankMark } from '../telar/TelarLogo.jsx';
import { TELAR, formatDate } from '../telar/brand.js';
import { telarState, logTelarEvent } from '../telar/useTelar.js';
import { getAccounts, getBanks, initiateLink, revokeConsent } from '../api/index.js';
import './S0PaymentMethods.css';

/**
 * Medios de pago · entrada de la experiencia de vinculación.
 *
 * Vive fuera de cualquier checkout: nadie está pagando nada aquí. El resultado
 * es una cuenta lista para usar y un consentimiento de acceso a datos vigente.
 */
export default function S0PaymentMethods() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyBankId, setBusyBankId] = useState(null);
  const [revoking, setRevoking] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [acc, bk] = await Promise.all([getAccounts(), getBanks()]);
    if (acc.ok) setAccounts(acc.accounts);
    if (bk.ok) setBanks(bk.banks);
    if (!acc.ok || !bk.ok) {
      setError(acc.message || bk.message || 'No se pudo contactar al iniciador de pagos.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Aquí nadie está pagando nada: todo lo que salga de esta pantalla es
  // vinculación, incluida la ruta hacia el directorio completo.
  useEffect(() => { telarState.beginLink(); }, []);

  async function handleSelectBank(bank) {
    setBusyBankId(bank.id);
    setError(null);
    logTelarEvent('SELECT_INSTITUTION', { detail: bank.id });

    const data = await initiateLink(bank.id);
    if (!data.ok) {
      setBusyBankId(null);
      setError(data.message || 'No se pudo iniciar la vinculación.');
      return;
    }

    telarState.beginLink();
    telarState.setBank(bank);
    telarState.setDataConsent({ ...data.consent, scope: data.scope });
    logTelarEvent('TRANSITION_VIEW', { view: 'DATA_CONSENT', detail: bank.id });
    navigate('/telar/consent-data');
  }

  async function handleRevoke(account) {
    setRevoking(account.consentHandle);
    setError(null);
    const data = await revokeConsent(account.consentHandle);
    setRevoking(null);
    if (!data.ok) {
      setError(data.message || 'No se pudo revocar el acceso.');
      return;
    }
    logTelarEvent('CONSENT_REVOKED', { detail: account.bankId });
    load();
  }

  const hasAccounts = accounts.length > 0;

  return (
    <>
      <div className="status-bar">
        <span>9:41</span>
        <span>4G 100%</span>
      </div>

      <div className="nav-bar">
        <button className="nav-back" onClick={() => navigate('/')} aria-label="Volver">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1>Medios de pago</h1>
      </div>

      <div className="screen-body">
        {error && <div className="telar-error">{error}</div>}

        <p className="label">Tus métodos</p>

        {hasAccounts && accounts.map(acc => (
          <div key={acc.consentHandle} className="pm-account">
            <BankMark bank={acc} size={32} radius={9} />
            <div className="pm-account-body">
              <p className="pm-account-name">{acc.bankName} · {acc.accountType} {acc.account}</p>
              <p className="pm-account-meta">
                Vinculada vía {TELAR.name} · vence {formatDate(acc.expiresAt)}
              </p>
            </div>
            <span className="pm-check" aria-label="Activa">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          </div>
        ))}

        <div className="card pm-card">
          <span className="pm-card-chip" aria-hidden="true" />
          <div className="pm-account-body">
            <p className="pm-account-name">Visa *4821</p>
            <p className="pm-account-meta">Vence 08/28</p>
          </div>
          <span className="pm-chevron">›</span>
        </div>

        <div className="divider" />

        {hasAccounts ? (
          <button
            className="pm-add-row"
            onClick={() => { telarState.beginLink(); navigate('/telar/directory'); }}
          >
            <TelarLogo size={16} />
            <span>Vincular otra cuenta con {TELAR.name}</span>
            <span className="pm-chevron">›</span>
          </button>
        ) : (
          <>
            <p className="label">Agregar cuenta bancaria</p>
            <TelarEmbed
              banks={banks}
              loading={loading}
              onSelectBank={handleSelectBank}
              onSeeAll={() => navigate('/telar/directory')}
              busyBankId={busyBankId}
            />
          </>
        )}

        {hasAccounts && (
          <>
            <div className="divider" />
            <p className="label">Consentimientos activos</p>
            {accounts.map(acc => (
              <div key={`c-${acc.consentHandle}`} className="card pm-consent">
                <span className="pm-consent-dot" aria-hidden="true" />
                <div className="pm-account-body">
                  <p className="pm-consent-title">Acceso a datos · {acc.bankName}</p>
                  <p className="pm-account-meta">
                    Titularidad y saldo · hasta {formatDate(acc.expiresAt)}
                  </p>
                  <button
                    className="pm-revoke"
                    onClick={() => handleRevoke(acc)}
                    disabled={revoking === acc.consentHandle}
                  >
                    {revoking === acc.consentHandle ? 'Revocando…' : 'Revocar acceso'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="cta-area">
          <p className="footer-note">
            Puedes revocar en cualquier momento, aquí o desde tu banco
          </p>
        </div>
      </div>
    </>
  );
}
