import React from 'react';
import TelarLogo from './TelarLogo.jsx';
import { TELAR } from './brand.js';
import './telar.css';

/**
 * Hoja del iniciador.
 *
 * Entra flotando sobre el anfitrión atenuado. Ese gesto, más que el color, es lo
 * que comunica que la superficie ya no es del comercio: quien pide el
 * consentimiento es Telar, y el comercio queda detrás, inactivo.
 */
export default function TelarSheet({ subtitle, onClose, children }) {
  return (
    <div className="telar-sheet-screen">
      <div className="telar-host-dim" aria-hidden="true" />

      <div className="telar-sheet">
        <div className="telar-grab" aria-hidden="true" />

        <div className="telar-sheet-head">
          <div className="telar-sheet-brand">
            <TelarLogo size={20} />
            <div>
              <div className="telar-sheet-name">{TELAR.name}</div>
              <div className="telar-sheet-sub">{subtitle || `${TELAR.role} · ${TELAR.supervisor}`}</div>
            </div>
          </div>
          {onClose && (
            <button className="telar-sheet-close" onClick={onClose} aria-label="Cerrar">✕</button>
          )}
        </div>

        <div className="telar-sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** Últimos eventos emitidos, visibles para que el demo sea explicable. */
export function TelarEventLog({ events }) {
  if (!events || events.length === 0) return null;
  return (
    <div className="telar-events">
      {events.map((e, i) => (
        <div key={i}>
          {e.name}
          {e.payload?.detail ? ` · ${e.payload.detail}` : ''}
        </div>
      ))}
    </div>
  );
}
