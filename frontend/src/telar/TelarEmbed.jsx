import React, { useState } from 'react';
import TelarLogo, { BankMark } from './TelarLogo.jsx';
import { TELAR } from './brand.js';
import './telar.css';

const FEATURED_COUNT = 6;

/**
 * Buscador de entidades embebido.
 *
 * Se muestra por defecto dentro de la pantalla del comercio, sin exigir que el
 * usuario elija antes "pagar con banco": ver el logo de la propia entidad es lo
 * que dispara la elección. Un toque sobre el tile abre la hoja del iniciador,
 * sin paso intermedio de confirmación.
 */
export default function TelarEmbed({
  banks,
  loading,
  onSelectBank,
  onSeeAll,
  busyBankId,
  footNote,
}) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = q
    ? banks.filter(b => b.name.toLowerCase().includes(q))
    : banks.filter(b => b.featured).slice(0, FEATURED_COUNT);

  return (
    <div className="telar-embed">
      <div className="telar-embed-head">
        <TelarLogo size={17} />
        <span className="telar-embed-name">{TELAR.name}</span>
        <span className="telar-embed-role">{TELAR.roleShort}</span>
      </div>

      <div className="telar-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Busca tu banco…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Buscar entidad financiera"
        />
      </div>

      {loading ? (
        <div className="telar-grid">
          {Array.from({ length: FEATURED_COUNT }, (_, i) => (
            <div key={i} className="telar-tile skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="telar-empty">
          Esa entidad aún no está conectada a {TELAR.name}.
          <br />
          Prueba con otro nombre.
        </div>
      ) : (
        <div className="telar-grid">
          {matches.map(bank => (
            <button
              key={bank.id}
              className="telar-tile"
              onClick={() => onSelectBank(bank)}
              disabled={Boolean(busyBankId)}
            >
              <BankMark bank={bank} size={32} />
              <span className="telar-tile-name">
                {busyBankId === bank.id ? 'Abriendo…' : bank.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="telar-embed-foot">
        <span>{footNote || `${banks.length} entidades conectadas`}</span>
        {onSeeAll && (
          <button className="telar-link" onClick={onSeeAll}>Ver todas</button>
        )}
      </div>
    </div>
  );
}
