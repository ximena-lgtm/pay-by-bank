import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './S2PhoneHome.css';

export default function S2PhoneHome() {
  const navigate = useNavigate();
  const [showNotification, setShowNotification] = useState(true);
  const [bank, setBank] = useState(null);
  const [amount, setAmount] = useState('18.500');

  useEffect(() => {
    // Leer información del banco seleccionado
    const bankStr = sessionStorage.getItem('selectedBank');
    const instrumentStr = sessionStorage.getItem('instrument');

    if (bankStr) {
      const bankData = JSON.parse(bankStr);
      setBank(bankData);
    }

    if (instrumentStr) {
      const instrument = JSON.parse(instrumentStr);
      setAmount(instrument.amount?.toLocaleString('es-CO') || '18.500');
    }
  }, []);

  function handleNotificationClick() {
    setShowNotification(false);
    // Navegar al login del banco (por ahora todos usan nu-login, pero se puede extender)
    navigate('/nu-login');
  }

  if (!bank) {
    return <div>Cargando...</div>;
  }

  return (
    <>
      {/* Status bar */}
      <div className="status-bar">
        <span>9:41</span>
        <div className="status-icons">
          <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor">
            <path d="M14.5 0h-13C.67 0 0 .67 0 1.5v8c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5v-8c0-.83-.67-1.5-1.5-1.5zM14 9H2V2h12v7z"/>
          </svg>
          <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor">
            <path d="M1 5.5C1 3.01 3.01 1 5.5 1S10 3.01 10 5.5 7.99 10 5.5 10 1 7.99 1 5.5zm12.5 3c0-1.38 1.12-2.5 2.5-2.5V4c-2.21 0-4 1.79-4 4h1.5zm-2-3c0-2.76 2.24-5 5-5V0C11.25 0 7.5 3.75 7.5 7.5H11z"/>
          </svg>
          <svg width="25" height="11" viewBox="0 0 25 11" fill="none">
            <rect x="0" y="0" width="18" height="11" rx="2.5" stroke="currentColor" strokeWidth="1" opacity="0.35"/>
            <rect x="1" y="1" width="16" height="9" rx="1.5" fill="currentColor"/>
            <rect x="19" y="3.5" width="2" height="4" rx="1" fill="currentColor" opacity="0.4"/>
          </svg>
        </div>
      </div>

      {/* Phone home screen */}
      <div className="phone-home">
        {/* Date/Time widget */}
        <div className="home-header">
          <div className="date-time">
            <div className="time-large">9:41</div>
            <div className="date-small">Domingo, 8 de junio</div>
          </div>
        </div>

        {/* Notification */}
        {showNotification && (
          <div className="notification-container" onClick={handleNotificationClick}>
            <div className="notification" style={{
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(20px)'
            }}>
              <div className="notification-header">
                <div className="notification-app">
                  <div className="app-icon" style={{
                    backgroundColor: bank.color,
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="14" fontWeight="bold">
                        {bank.name.substring(0, 2)}
                      </text>
                    </svg>
                  </div>
                  <span className="app-name" style={{ color: 'white' }}>{bank.name}</span>
                </div>
                <span className="notification-time" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>ahora</span>
              </div>
              <div className="notification-content">
                <p className="notification-title" style={{ color: 'white' }}>Solicitud de pago · Uber</p>
                <p className="notification-body" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>COP {amount} • Toca para revisar y autorizar</p>
              </div>
            </div>
          </div>
        )}

        {/* Home screen apps */}
        <div className="home-apps">
          <div className="app-grid">
            <div className="home-app">
              <div className="app-icon-home messages-icon">
                <svg width="40" height="40" viewBox="0 0 60 60" fill="none">
                  <circle cx="30" cy="30" r="30" fill="url(#messages-gradient)"/>
                  <path d="M30 15c-8.27 0-15 5.96-15 13.31 0 4.19 2.35 7.93 6 10.35V45l6.46-3.54c1.43.39 2.94.6 4.54.6 8.27 0 15-5.96 15-13.31S38.27 15 30 15z" fill="white"/>
                  <defs>
                    <linearGradient id="messages-gradient" x1="0" y1="0" x2="60" y2="60">
                      <stop offset="0%" stopColor="#00D856"/>
                      <stop offset="100%" stopColor="#00B347"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span>Mensajes</span>
            </div>
            <div className="home-app">
              <div className="app-icon-home mail-icon">
                <svg width="40" height="40" viewBox="0 0 60 60" fill="none">
                  <defs>
                    <linearGradient id="mail-gradient" x1="0" y1="0" x2="60" y2="60">
                      <stop offset="0%" stopColor="#3F8FFF"/>
                      <stop offset="100%" stopColor="#1E6FE0"/>
                    </linearGradient>
                  </defs>
                  <rect width="60" height="60" rx="14" fill="url(#mail-gradient)"/>
                  <path d="M15 20h30v20H15V20zm3 2l12 9 12-9M15 38l11-9m19 9L34 29" stroke="white" strokeWidth="2" fill="none"/>
                </svg>
              </div>
              <span>Mail</span>
            </div>
            <div className="home-app">
              <div className="app-icon-home nu-icon-home">
                <svg width="40" height="40" viewBox="0 0 60 60" fill="none">
                  <rect width="60" height="60" rx="14" fill="#8A05BE"/>
                  <text x="30" y="36" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">Nu</text>
                </svg>
              </div>
              <span>Nubank</span>
            </div>
            <div className="home-app">
              <div className="app-icon-home uber-icon">
                <svg width="40" height="40" viewBox="0 0 60 60" fill="none">
                  <rect width="60" height="60" rx="14" fill="#000000"/>
                  <rect x="18" y="24" width="7" height="18" rx="1" fill="white"/>
                  <path d="M30 24h7c3 0 5 2 5 5v8c0 3-2 5-5 5h-7V24z" fill="white"/>
                </svg>
              </div>
              <span>Uber</span>
            </div>
            <div className="home-app">
              <div className="app-icon-home camera-icon">
                <svg width="40" height="40" viewBox="0 0 60 60" fill="none">
                  <defs>
                    <linearGradient id="camera-gradient" x1="0" y1="0" x2="60" y2="60">
                      <stop offset="0%" stopColor="#7C7C7C"/>
                      <stop offset="100%" stopColor="#5C5C5C"/>
                    </linearGradient>
                  </defs>
                  <rect width="60" height="60" rx="14" fill="url(#camera-gradient)"/>
                  <circle cx="30" cy="32" r="8" stroke="white" strokeWidth="2" fill="none"/>
                  <circle cx="42" cy="21" r="2" fill="white"/>
                  <rect x="18" y="18" width="24" height="20" rx="3" stroke="white" strokeWidth="2" fill="none"/>
                </svg>
              </div>
              <span>Cámara</span>
            </div>
            <div className="home-app">
              <div className="app-icon-home settings-icon">
                <svg width="40" height="40" viewBox="0 0 60 60" fill="none">
                  <defs>
                    <linearGradient id="settings-gradient" x1="0" y1="0" x2="60" y2="60">
                      <stop offset="0%" stopColor="#8E8E93"/>
                      <stop offset="100%" stopColor="#6E6E73"/>
                    </linearGradient>
                  </defs>
                  <rect width="60" height="60" rx="14" fill="url(#settings-gradient)"/>
                  <circle cx="30" cy="30" r="6" fill="white"/>
                  <path d="M30 16l2 4 4 1-2 4 2 4-4 1-2 4-2-4-4-1 2-4-2-4 4-1 2-4z" fill="white"/>
                </svg>
              </div>
              <span>Ajustes</span>
            </div>
          </div>
        </div>

        {/* Dock */}
        <div className="phone-dock">
          <div className="dock-app">
            <svg width="50" height="50" viewBox="0 0 60 60" fill="none">
              <defs>
                <linearGradient id="phone-gradient" x1="0" y1="0" x2="60" y2="60">
                  <stop offset="0%" stopColor="#00D856"/>
                  <stop offset="100%" stopColor="#00B347"/>
                </linearGradient>
              </defs>
              <rect width="60" height="60" rx="14" fill="url(#phone-gradient)"/>
              <path d="M23 17c-2 0-4 2-4 4v18c0 2 2 4 4 4h14c2 0 4-2 4-4V21c0-2-2-4-4-4H23zm0 2h14c1 0 2 1 2 2v18c0 1-1 2-2 2H23c-1 0-2-1-2-2V21c0-1 1-2 2-2z" fill="white"/>
            </svg>
          </div>
          <div className="dock-app">
            <svg width="50" height="50" viewBox="0 0 60 60" fill="none">
              <rect width="60" height="60" rx="14" fill="#007AFF"/>
              <circle cx="20" cy="30" r="3" fill="white"/>
              <circle cx="30" cy="30" r="3" fill="white"/>
              <circle cx="40" cy="30" r="3" fill="white"/>
            </svg>
          </div>
          <div className="dock-app">
            <svg width="50" height="50" viewBox="0 0 60 60" fill="none">
              <defs>
                <linearGradient id="safari-gradient" x1="0" y1="0" x2="60" y2="60">
                  <stop offset="0%" stopColor="#0A84FF"/>
                  <stop offset="100%" stopColor="#0055D4"/>
                </linearGradient>
              </defs>
              <circle cx="30" cy="30" r="30" fill="url(#safari-gradient)"/>
              <path d="M30 15l3 12-12 3-3-12 12-3z" fill="white" opacity="0.9"/>
              <circle cx="30" cy="30" r="2" fill="white"/>
            </svg>
          </div>
          <div className="dock-app">
            <svg width="50" height="50" viewBox="0 0 60 60" fill="none">
              <defs>
                <linearGradient id="music-gradient" x1="0" y1="0" x2="60" y2="60">
                  <stop offset="0%" stopColor="#FF5F7E"/>
                  <stop offset="100%" stopColor="#FA233B"/>
                </linearGradient>
              </defs>
              <rect width="60" height="60" rx="14" fill="url(#music-gradient)"/>
              <path d="M22 20h16v4H22v-4zm16 8v12h-4V28h4zm-12 0v12h-4V28h4z" fill="white"/>
            </svg>
          </div>
        </div>

        {/* Page indicator */}
        <div className="page-indicator">
          <div className="dot active"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      </div>
    </>
  );
}
