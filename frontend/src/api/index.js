const BASE = '/api';

async function req(path, options) {
  const r = await fetch(`${BASE}${path}`, options);
  const data = await r.json().catch(() => ({ ok: false, error: 'Respuesta inválida del servidor' }));
  return data;
}

function post(path, body) {
  return req(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
}

// ─── Viaje ────────────────────────────────────────────────────────────────────

export const getTrip = () => req('/trip');
export const completeTrip = () => post('/trip/complete');

// ─── Directorio y cuentas ─────────────────────────────────────────────────────

/** Entidades conectadas a Telar. No son PISP: el PISP es Telar. */
export const getBanks = () => req('/banks');

/** Cuentas del titular con consentimiento de acceso a datos vigente. */
export const getAccounts = () => req('/accounts');

// ─── Experiencia A · Acceso a datos ───────────────────────────────────────────

/** Crea (o reutiliza) el consentimiento de acceso a datos para una entidad. */
export const initiateLink = (bankId) => post('/consent/link/initiate', { bankId });

/**
 * El banco otorga el acceso tras la SCA.
 *
 * bankId viaja porque es en la activación cuando la entidad emisora revela la
 * cuenta: el proof la ata al consentimiento, y de ahí sale el token que después
 * usa el mandato de pago.
 */
export const activateLink = (consentHandle, scaMethod, bankId) =>
  post('/consent/link/activate', { consentHandle, scaMethod, bankId });

/** El titular revoca el acceso a datos. */
export const revokeConsent = (handle, reason) => post(`/consent/${handle}/revoke`, { reason });

// ─── Experiencia B · Pago ─────────────────────────────────────────────────────

/** Crea el consentimiento de pago de uso único. Exige acceso a datos vigente. */
export const createPaymentConsent = (bankId, amount) =>
  post('/payment/consent', { bankId, amount });

/** SCA del débito: activa el consentimiento de pago y crea el intent. */
export const authorizePayment = (paymentConsentHandle, scaMethod, bankId, amount) =>
  post('/payment/authorize', { paymentConsentHandle, scaMethod, bankId, amount });

export const getPayment = (paymentId) => req(`/payment/${paymentId}`);

// ─── Consentimientos ──────────────────────────────────────────────────────────

export const getConsents = (type = 'data_access') => req(`/consents?type=${type}`);
export const getConsent = (handle) => req(`/consent/${handle}`);
