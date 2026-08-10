import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TelarSheet from '../TelarSheet.jsx';
import { BankMark } from '../TelarLogo.jsx';
import { TELAR } from '../brand.js';
import { getBanks, initiateLink } from '../../api/index.js';
import { telarState, logTelarEvent } from '../useTelar.js';

/**
 * Listado completo de entidades conectadas.
 *
 * Lo que antes era una pantalla del comercio ("Selecciona tu banco") vive ahora
 * dentro de la hoja del iniciador: el comercio no lista entidades.
 */
export default function DirectoryView() {
  const navigate = useNavigate();
  const [banks, setBanks] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getBanks().then(d => { if (d.ok) setBanks(d.banks); });
  }, []);

  const q = query.trim().toLowerCase();
  const results = q ? banks.filter(b => b.name.toLowerCase().includes(q)) : [];
  const rest = q ? [] : banks;

  async function handleSelect(bank) {
    setBusy(bank.id);
    setError(null);
    logTelarEvent('SELECT_INSTITUTION', { detail: bank.id });

    const data = await initiateLink(bank.id);
    if (!data.ok) {
      setBusy(null);
      setError(data.message || 'No se pudo iniciar la vinculación.');
      return;
    }

    // El flujo lo declara quien abre el directorio: 'link' desde Medios de pago,
    // 'link+pay' desde el checkout. Aquí solo se completa la entidad elegida.
    telarState.setBank(bank);
    telarState.setDataConsent({ ...data.consent, scope: data.scope });
    logTelarEvent('TRANSITION_VIEW', { view: 'DATA_CONSENT', detail: bank.id });
    navigate('/telar/consent-data');
  }

  function renderRow(bank) {
    return (
      <button
        key={bank.id}
        className={`telar-account ${busy === bank.id ? 'selected' : ''}`}
        onClick={() => handleSelect(bank)}
        disabled={Boolean(busy)}
      >
        <BankMark bank={bank} size={30} radius={9} />
        <span className="telar-account-body">
          <span className="telar-account-name">{bank.name}</span>
          <span className="telar-account-meta">
            {bank.linked
              ? `Ya vinculada · ${bank.accountType} ${bank.account}`
              : `${bank.type} · ${bank.accountType}`}
          </span>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>{busy === bank.id ? '…' : '›'}</span>
      </button>
    );
  }

  return (
    <TelarSheet
      subtitle={`${banks.length} entidades conectadas`}
      onClose={() => navigate(-1)}
    >
      {error && <div className="telar-error">{error}</div>}

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
          autoFocus
        />
      </div>

      {q && (
        <>
          <p className="label" style={{ marginTop: 18 }}>
            {results.length === 0
              ? 'Sin resultados'
              : `${results.length} resultado${results.length === 1 ? '' : 's'}`}
          </p>
          {results.length === 0 ? (
            <div className="telar-empty">
              Esa entidad aún no está conectada a {TELAR.name}.
              <br />
              Prueba con otro nombre o vuelve más tarde.
            </div>
          ) : (
            results.map(renderRow)
          )}
        </>
      )}

      {!q && (
        <>
          <p className="label" style={{ marginTop: 18 }}>Todas las entidades</p>
          {rest.map(renderRow)}
        </>
      )}

      <div className="cta-area">
        <p className="footer-note">
          {TELAR.name} · {TELAR.role} · {TELAR.supervisor}
        </p>
      </div>
    </TelarSheet>
  );
}
