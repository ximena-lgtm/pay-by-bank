import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TELAR } from '../telar/brand.js';
import { telarState } from '../telar/useTelar.js';
import '../telar/telar.css';   // telar-desc
import './S3aNuLogin.css';

/**
 * Autenticación en la entidad financiera.
 *
 * Aquí manda el banco: el cromado del iniciador desaparece por completo y solo
 * queda una línea diciendo de quién viene la solicitud.
 */
export default function S3aNuLogin() {
  const navigate = useNavigate();
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const bank = telarState.getBank();
  const flow = telarState.getFlow();
  const isPayment = flow === 'pay' || flow === 'link+pay';

  if (!bank) {
    return (
      <div className="screen-body" style={{ paddingTop: 40 }}>
        <p className="telar-desc">No hay una solicitud en curso.</p>
      </div>
    );
  }

  function handleLogin(e) {
    e.preventDefault();
    if (!cedula || !password) return;
    setLoading(true);
    setTimeout(() => {
      telarState.setLoggedIn(true);
      navigate('/nu-auth');
    }, 700);
  }

  return (
    <>
      <div className="bank-header" style={{ background: bank.color }}>
        <div className="bank-header-top">
          <button className="bank-back" onClick={() => navigate(-1)} aria-label="Volver">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
        <div className="bank-wordmark">{bank.name}</div>
        <div className="bank-subtitle">
          {isPayment ? 'Autorización de pago' : 'Solicitud de acceso a datos'}
        </div>
      </div>

      <div className="screen-body">
        <div className="card requester-note">
          <span className="requester-dot" aria-hidden="true" />
          <p>Solicitud recibida de {TELAR.name}, {TELAR.role.toLowerCase()}</p>
        </div>

        <h2 className="login-title">Inicia sesión en {bank.name}</h2>
        <p className="login-desc">Ingresa tus credenciales para continuar.</p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="cedula">Cédula de ciudadanía</label>
            <div className="input-wrapper">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="cedula"
                type="text"
                inputMode="numeric"
                placeholder="Ej: 1234567890"
                value={cedula}
                onChange={e => setCedula(e.target.value.replace(/\D/g, ''))}
                maxLength="10"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <div className="input-wrapper">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          <div className="card security-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={bank.color} strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p>
              Conexión segura. {TELAR.name} nunca ve tu contraseña: la autenticación ocurre
              dentro de {bank.name}.
            </p>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ background: bank.color }}
            disabled={!cedula || !password || loading}
          >
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>

          <div className="help-links">
            <a href="#" onClick={e => e.preventDefault()} style={{ color: bank.color }}>
              ¿Olvidaste tu contraseña?
            </a>
            <span className="separator">·</span>
            <a href="#" onClick={e => e.preventDefault()} style={{ color: bank.color }}>Ayuda</a>
          </div>
        </form>
      </div>
    </>
  );
}
