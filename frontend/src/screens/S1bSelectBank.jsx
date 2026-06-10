import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBanks, initiatePayment, getConsentsByUser } from '../api/index.js';
import ConsentDetailsModal from './ConsentDetailsModal.jsx';
import './S1bSelectBank.css';

export default function S1bSelectBank() {
  const navigate = useNavigate();
  const [banks, setBanks] = useState([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState('nu');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [selectedConsent, setSelectedConsent] = useState(null);
  const [consents, setConsents] = useState([]);

  useEffect(() => {
    getBanks().then(d => {
      setBanks(d.banks);
      setTotal(d.total);
    });
    getConsentsByUser().then(d => {
      if (d.ok) {
        setConsents(d.consents || []);
      }
    });
  }, []);

  const linkedBanks = banks.filter(b => b.hasActiveConsent || b.linked);
  const unlinkedBanks = banks.filter(b => !b.hasActiveConsent && !b.linked && b.name.toLowerCase().includes(query.toLowerCase()));

  const selectedBank = banks.find(b => b.id === selected);

  function handleShowConsentDetails(bankId, e) {
    e.stopPropagation(); // Evitar que se seleccione el banco
    const consent = consents.find(c => c.bank_id === bankId);
    if (consent) {
      setSelectedConsent(consent);
      setShowConsentModal(true);
    }
  }

  async function handlePay() {
    setLoading(true);
    const data = await initiatePayment(selected);

    // Store instrument and bank info in sessionStorage
    sessionStorage.setItem('instrument', JSON.stringify(data.instrument));
    sessionStorage.setItem('consentToken', data.instrument.consentToken);

    const bank = banks.find(b => b.id === selected);
    sessionStorage.setItem('selectedBank', JSON.stringify({
      id: bank.id,
      name: bank.name,
      color: bank.color,
      account: bank.account || '*****',
    }));

    // If bank has active consent, go to phone home with notification
    // Otherwise, go to consent flow (Hub) to create new consent
    if (bank?.hasActiveConsent || bank?.linked) {
      navigate('/phone-home');
    } else {
      navigate('/consent');
    }
  }

  return (
    <>
      <div className="status-bar">
        <span>9:41</span>
        <span>4G 100%</span>
      </div>

      <div className="nav-bar centered">
        <button className="nav-back" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1>Selecciona tu banco</h1>
      </div>

      <div className="screen-body">
        <h2 className="banks-title">¿Desde qué cuenta<br />quieres pagar?</h2>
        <p className="banks-subtitle">Solo bancos habilitados en el directorio SFC para Open Finance · PISP.</p>

        {/* Cuentas vinculadas section */}
        <p className="section-label">Cuentas vinculadas</p>
        <div className="bank-list">
          {linkedBanks.map(bank => (
            <div
              key={bank.id}
              className={`card bank-row ${selected === bank.id ? 'selected' : ''}`}
              onClick={() => setSelected(bank.id)}
            >
              <span className="bank-dot" style={{ background: bank.color }} />
              <div className="bank-info">
                <p className="bank-name">{bank.name}</p>
                <p className="bank-sub">
                  {bank.type} · {bank.account}
                </p>
              </div>
              <button
                className="bank-info-btn"
                onClick={(e) => handleShowConsentDetails(bank.id, e)}
                title="Ver detalles del consentimiento"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </button>
              {selected === bank.id ? (
                <div className="radio-check">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--text-primary)">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5l-4-4 1.41-1.41L10 13.67l6.59-6.59L18 8.5l-8 8z"/>
                  </svg>
                </div>
              ) : (
                <div className="radio-empty" />
              )}
            </div>
          ))}
        </div>

        <div className="divider" />

        {/* Vincular otra cuenta section */}
        <p className="section-label">Vincular otra cuenta</p>

        {/* Search */}
        <div className="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar banco..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* SFC directory badge */}
        <div className="directory-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>Directorio SFC · {total} entidades habilitadas para PISP</span>
        </div>

        {/* Unlinked Bank list */}
        <div className="bank-list">
          {unlinkedBanks.map(bank => (
            <div
              key={bank.id}
              className={`card bank-row ${selected === bank.id ? 'selected' : ''}`}
              onClick={() => setSelected(bank.id)}
            >
              <span className="bank-dot" style={{ background: bank.color }} />
              <div className="bank-info">
                <p className="bank-name">{bank.name}</p>
                <p className="bank-sub">
                  {bank.type} · PISP habilitado
                </p>
              </div>
              {selected === bank.id ? (
                <div className="radio-check">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--text-primary)">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5l-4-4 1.41-1.41L10 13.67l6.59-6.59L18 8.5l-8 8z"/>
                  </svg>
                </div>
              ) : (
                <div className="radio-empty" />
              )}
            </div>
          ))}
        </div>

        <div className="cta-area">
          <button className="btn-primary" onClick={handlePay} disabled={loading}>
            {loading ? 'Iniciando...' : `Pagar con ${selectedBank?.name || '...'} ${selectedBank?.account ? selectedBank.account : ''}`}
            {!loading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Consent Details Modal */}
      {showConsentModal && (
        <ConsentDetailsModal
          consent={selectedConsent}
          onClose={() => setShowConsentModal(false)}
        />
      )}
    </>
  );
}
