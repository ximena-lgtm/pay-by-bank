import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TelarSheet, { TelarEventLog } from '../telar/TelarSheet.jsx';
import { TELAR, formatCOP } from '../telar/brand.js';
import { telarState, useTelarEvents } from '../telar/useTelar.js';
import './S3cPaymentProcessing.css';

/**
 * Liquidación.
 *
 * Vuelve a ser superficie del iniciador: Telar cierra el ciclo y devuelve el
 * control al comercio. El banco ya hizo lo suyo.
 */
export default function S3cPaymentProcessing() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const bank = telarState.getBank();
  const payment = telarState.getPayment();
  const result = telarState.getResult();
  const { events } = useTelarEvents(2);

  const reference = result?.intent?.reference || result?.paymentId || 'MOL-48213307';

  useEffect(() => {
    const timings = [900, 1600, 1600, 1200];
    const timers = timings.map((_, i) =>
      setTimeout(() => setStep(i + 1), timings.slice(0, i + 1).reduce((a, b) => a + b, 0))
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const steps = [
    { title: 'Autorización recibida', desc: 'SCA · autenticación reforzada' },
    { title: `Débito en ${bank?.name || 'tu banco'}`, desc: `COP ${formatCOP(payment?.amount)} · ${bank?.accountType || ''} ${bank?.account || ''}` },
    { title: 'Liquidando en Bre-B', desc: 'Red de pagos inmediatos' },
    { title: 'Abono a Uber', desc: 'Bancolombia · cuenta comercio' },
  ];

  const done = step >= steps.length;

  return (
    <TelarSheet subtitle={done ? 'Pago liquidado' : 'Liquidando el pago'}>
      <h2 className="telar-title">
        {done ? 'Tu pago quedó liquidado' : 'Estamos confirmando tu pago'}
      </h2>
      <p className="telar-desc">
        {done
          ? 'El conductor ya recibió la señal de inicio.'
          : 'No cierres la aplicación. Tarda unos segundos.'}
      </p>

      <div className="proc-steps">
        {steps.map((s, i) => (
          <div key={s.title} className={`proc-step ${i < step ? 'done' : i === step ? 'live' : ''}`}>
            <span className="proc-dot">
              {i < step && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span className="proc-body">
              <span className="proc-title">{s.title}</span>
              <span className="proc-desc">{s.desc}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="divider" />

      <div className="kv-list">
        <div className="kv-row">
          <span className="kv-key">Referencia</span>
          <span className="kv-val">{reference}</span>
        </div>
        <div className="kv-row">
          <span className="kv-key">Autorización</span>
          <span className="kv-val">Uso único</span>
        </div>
      </div>

      <TelarEventLog events={events} />

      <div className="cta-area">
        {done ? (
          <button className="btn-primary telar" onClick={() => navigate('/trip')}>
            Volver a Uber
          </button>
        ) : (
          <p className="footer-note">Al terminar volverás a Uber automáticamente</p>
        )}
        <p className="footer-note">{TELAR.legalName} · {TELAR.sfcReg}</p>
      </div>
    </TelarSheet>
  );
}
