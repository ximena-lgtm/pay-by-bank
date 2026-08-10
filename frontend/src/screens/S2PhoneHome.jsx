import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TELAR, formatCOP } from '../telar/brand.js';
import { telarState, logTelarEvent } from '../telar/useTelar.js';
import './S2PhoneHome.css';

/**
 * Pantalla de bloqueo con la solicitud del banco.
 *
 * Es el salto app-to-app: el iniciador cede el control y la entidad financiera
 * avisa al titular en su propia aplicación. Aparece en las dos experiencias —
 * en la de vinculación anuncia la solicitud de acceso, en la de pago el débito —
 * porque en ambas el consentimiento se otorga dentro del banco, no fuera.
 */
export default function S2PhoneHome() {
  const navigate = useNavigate();
  const [showNotification, setShowNotification] = useState(true);

  const bank = telarState.getBank();
  const payment = telarState.getPayment();
  const flow = telarState.getFlow();
  const isPayment = flow === 'pay' || flow === 'link+pay';

  if (!bank) {
    return (
      <div className="phone-home">
        <div className="home-header">
          <div className="date-time">
            <div className="time-large">9:41</div>
            <div className="date-small">Sin solicitud en curso</div>
          </div>
        </div>
      </div>
    );
  }

  const title = isPayment
    ? `Solicitud de pago · ${TELAR.name}`
    : `Solicitud de acceso · ${TELAR.name}`;

  const body = isPayment
    ? `COP ${formatCOP(payment?.amount)} a Uber · Toca para revisar y autorizar`
    : `Vincular tu cuenta ${bank.account || ''} · Toca para autorizar`;

  function handleNotificationClick() {
    setShowNotification(false);
    logTelarEvent('BANK_APP_OPENED', { detail: bank.id });
    navigate(telarState.isLoggedIn() ? '/nu-auth' : '/nu-login');
  }

  return (
    <>
      <div className="status-bar lock">
        <span>9:41</span>
        <span>4G 100%</span>
      </div>

      <div className="phone-home">
        <div className="home-header">
          <div className="date-time">
            <div className="time-large">9:41</div>
            <div className="date-small">Domingo, 9 de agosto</div>
          </div>
        </div>

        {showNotification && (
          <div className="notification-container">
            <button className="notification" onClick={handleNotificationClick}>
              <div className="notification-header">
                <div className="notification-app">
                  <span className="app-icon" style={{ backgroundColor: bank.color }}>
                    {bank.monogram || bank.name.slice(0, 2)}
                  </span>
                  <span className="app-name">{bank.name}</span>
                </div>
                <span className="notification-time">ahora</span>
              </div>
              <div className="notification-content">
                <p className="notification-title">{title}</p>
                <p className="notification-body">{body}</p>
              </div>
            </button>
          </div>
        )}

        <div className="home-apps">
          <div className="app-grid">
            <HomeApp label="Mensajes" bg="linear-gradient(135deg,#00D856,#00B347)" glyph="✉" />
            <HomeApp label="Mail" bg="linear-gradient(135deg,#3F8FFF,#1E6FE0)" glyph="@" />
            <HomeApp label={bank.name} bg={bank.color} glyph={bank.monogram || bank.name.slice(0, 2)} />
            <HomeApp label="Uber" bg="#111112" glyph="U" />
            <HomeApp label="Cámara" bg="linear-gradient(135deg,#7C7C7C,#5C5C5C)" glyph="◉" />
            <HomeApp label="Ajustes" bg="linear-gradient(135deg,#8E8E93,#6E6E73)" glyph="⚙" />
          </div>
        </div>

        <div className="phone-dock">
          <span className="dock-app" style={{ background: 'linear-gradient(135deg,#00D856,#00B347)' }}>☎</span>
          <span className="dock-app" style={{ background: '#007AFF' }}>•••</span>
          <span className="dock-app" style={{ background: 'linear-gradient(135deg,#0A84FF,#0055D4)' }}>◈</span>
          <span className="dock-app" style={{ background: 'linear-gradient(135deg,#FF5F7E,#FA233B)' }}>♪</span>
        </div>

        <div className="page-indicator">
          <span className="dot active" /><span className="dot" /><span className="dot" />
        </div>
      </div>
    </>
  );
}

function HomeApp({ label, bg, glyph }) {
  return (
    <div className="home-app">
      <span className="app-icon-home" style={{ background: bg }}>{glyph}</span>
      <span>{label}</span>
    </div>
  );
}
