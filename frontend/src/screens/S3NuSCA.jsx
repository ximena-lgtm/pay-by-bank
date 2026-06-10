import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authorizePayment } from '../api/index.js';
import './S3NuSCA.css';

export default function S3NuSCA() {
  const navigate = useNavigate();
  const [authMethod, setAuthMethod] = useState('biometric');
  const [loading, setLoading] = useState(false);
  const [bank, setBank] = useState(null);
  const [instrument, setInstrument] = useState(null);

  useEffect(() => {
    // Leer información del banco e instrumento
    const bankStr = sessionStorage.getItem('selectedBank');
    const instrumentStr = sessionStorage.getItem('instrument');

    if (bankStr) {
      setBank(JSON.parse(bankStr));
    }
    if (instrumentStr) {
      setInstrument(JSON.parse(instrumentStr));
    }
  }, []);

  async function handleAuth() {
    setLoading(true);
    const token = sessionStorage.getItem('consentToken') || 'DEMO-TOKEN';

    // Leer el consentHandle del instrument guardado
    let consentHandle = token;
    if (instrument) {
      consentHandle = instrument.consentHandle || token;
    }

    const data = await authorizePayment(
      token,
      authMethod,
      consentHandle,
      bank.id,
      instrument.amount
    );
    sessionStorage.setItem('paymentResult', JSON.stringify(data));
    navigate('/processing');
  }

  if (!bank || !instrument) {
    return <div>Cargando...</div>;
  }

  const amount = instrument.amount?.toLocaleString('es-CO') || '18.500';

  return (
    <>
      {/* Bank branded header */}
      <div className="nu-header" style={{ backgroundColor: bank.color }}>
        <div className="nu-wordmark">{bank.name}</div>
        <div className="nu-subtitle">Autorización de pago</div>
      </div>

      <div className="screen-body">
        <h2 className="sca-title">Autoriza este pago</h2>
        <p className="sca-desc">Verifica la información del pago y selecciona cómo deseas autenticar.</p>

        {/* Payment summary */}
        <div className="payment-summary">
          <div className="ps-accent" style={{ backgroundColor: bank.color }} />
          <div className="ps-content">
            <p className="ps-merchant">Pago a Uber Colombia</p>
            <p className="ps-route">UberX · El Dorado → Zona Rosa</p>
            <p className="ps-amount">COP {amount}</p>
          </div>
        </div>

        <div className="divider" />

        {/* Auth method */}
        <p className="label">Segundo factor de autenticación</p>

        <div
          className={`card auth-option ${authMethod === 'biometric' ? 'selected' : ''}`}
          onClick={() => setAuthMethod('biometric')}
          style={authMethod === 'biometric' ? { borderColor: bank.color } : {}}
        >
          <div className="auth-icon" style={authMethod === 'biometric' ? { color: bank.color } : {}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"/>
              <path d="M8 7h8M8 11h8M12 15v4M8 19h8"/>
            </svg>
          </div>
          <div className="auth-info">
            <p className="auth-name">Huella digital / Face ID</p>
            <p className="auth-sub">Recomendado · Rápido y seguro</p>
          </div>
          {authMethod === 'biometric' ? (
            <div className="radio-check">
              <svg width="22" height="22" viewBox="0 0 24 24" fill={bank.color}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5l-4-4 1.41-1.41L10 13.67l6.59-6.59L18 8.5l-8 8z"/>
              </svg>
            </div>
          ) : <div className="radio-empty" />}
        </div>

        <div
          className={`card auth-option otp-option ${authMethod === 'pin' ? 'selected' : ''}`}
          onClick={() => setAuthMethod('pin')}
          style={authMethod === 'pin' ? { marginTop: 8, borderColor: bank.color } : { marginTop: 8 }}
        >
          <div className="auth-icon muted" style={authMethod === 'pin' ? { color: bank.color } : {}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/>
            </svg>
          </div>
          <div className="auth-info">
            <p className="auth-name">Código OTP por SMS</p>
            <p className="auth-sub">Se enviará a tu número registrado</p>
          </div>
          {authMethod === 'pin' ? (
            <div className="radio-check">
              <svg width="22" height="22" viewBox="0 0 24 24" fill={bank.color}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5l-4-4 1.41-1.41L10 13.67l6.59-6.59L18 8.5l-8 8z"/>
              </svg>
            </div>
          ) : <div className="radio-empty" />}
        </div>

        <div className="cta-area">
          <button className="btn-primary" style={{ backgroundColor: bank.color }} onClick={handleAuth} disabled={loading}>
            {loading ? 'Autenticando...' : 'Autenticar y pagar'}
            {!loading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </button>
          <button className="btn-secondary" onClick={() => navigate('/')}>Cancelar pago</button>
        </div>
      </div>
    </>
  );
}
