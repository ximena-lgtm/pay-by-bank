import { useCallback, useEffect, useState } from 'react';

/**
 * Estado del iniciador entre pantallas.
 *
 * El flujo cruza superficies que en producción serían aplicaciones distintas
 * (comercio → iniciador → banco), así que el estado vive en sessionStorage y no
 * en memoria de React: sobrevive a la navegación y al refresco, como sobreviviría
 * a un salto app-to-app.
 */

const KEYS = {
  flow:           'telar.flow',            // 'link' | 'pay' | 'link+pay'
  bank:           'telar.bank',
  dataConsent:    'telar.dataConsent',
  paymentConsent: 'telar.paymentConsent',
  mandate:        'telar.mandate',
  payment:        'telar.payment',
  result:         'telar.result',
  events:         'telar.events',
  loggedIn:       'telar.bankLoggedIn',
};

function read(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  if (value === null || value === undefined) sessionStorage.removeItem(key);
  else sessionStorage.setItem(key, JSON.stringify(value));
}

export const telarState = {
  // Por defecto 'link': ante un estado incompleto, la experiencia que NO mueve
  // dinero. Un flujo de pago siempre se declara explícitamente con beginPayment.
  getFlow:  () => read(KEYS.flow, 'link'),
  setFlow:  (v) => write(KEYS.flow, v),

  /**
   * Arranques de experiencia.
   *
   * Cada entrada declara qué se va a pedir y limpia lo que sobra del intento
   * anterior. Fijar el flujo por separado es justo lo que produce una hoja de
   * pago sin monto, así que aquí no se puede olvidar.
   */

  /** Vincular una cuenta. No hay pago: se descarta cualquier resto de uno previo. */
  beginLink() {
    write(KEYS.flow, 'link');
    write(KEYS.paymentConsent, null);
    write(KEYS.mandate, null);
    write(KEYS.payment, null);
    write(KEYS.result, null);
  },

  /** Vincular y pagar en la misma visita al banco. */
  beginLinkAndPay(payment) {
    write(KEYS.flow, 'link+pay');
    write(KEYS.payment, payment);
    write(KEYS.paymentConsent, null);
    write(KEYS.mandate, null);
    write(KEYS.result, null);
  },

  /** Pagar con una cuenta ya vinculada. */
  beginPayment(payment) {
    write(KEYS.flow, 'pay');
    write(KEYS.payment, payment);
    write(KEYS.result, null);
  },

  getBank:  () => read(KEYS.bank),
  setBank:  (v) => write(KEYS.bank, v),

  getDataConsent: () => read(KEYS.dataConsent),
  setDataConsent: (v) => write(KEYS.dataConsent, v),

  getPaymentConsent: () => read(KEYS.paymentConsent),
  setPaymentConsent: (v) => write(KEYS.paymentConsent, v),

  /** Parámetros del mandato: topes, finalidad, política de SCA, partes. */
  getMandate: () => read(KEYS.mandate),
  setMandate: (v) => write(KEYS.mandate, v),

  getPayment: () => read(KEYS.payment),
  setPayment: (v) => write(KEYS.payment, v),

  getResult: () => read(KEYS.result),
  setResult: (v) => write(KEYS.result, v),

  isLoggedIn:  () => read(KEYS.loggedIn, false),
  setLoggedIn: (v) => write(KEYS.loggedIn, v),

  /** Cierra la sesión del iniciador sin borrar la del banco. */
  reset() {
    write(KEYS.flow, null);
    write(KEYS.bank, null);
    write(KEYS.dataConsent, null);
    write(KEYS.paymentConsent, null);
    write(KEYS.mandate, null);
    write(KEYS.payment, null);
    write(KEYS.result, null);
  },
};

/**
 * Registro de eventos del iniciador.
 *
 * Replica los eventos que un SDK de iniciación emite hacia el comercio
 * (SELECT_INSTITUTION, TRANSITION_VIEW, SUCCESS, EXIT). Se muestra en pantalla
 * porque es lo que hace demostrable que hay dos consentimientos distintos y no
 * uno solo repintado.
 */
export function logTelarEvent(name, payload = {}) {
  const events = read(KEYS.events, []);
  events.push({
    name,
    payload,
    at: new Date().toISOString(),
  });
  write(KEYS.events, events.slice(-40));
  // Visible también en la consola del navegador, como haría un SDK real
  console.log(`[telar] ${name}`, payload);
}

export function getTelarEvents() {
  return read(KEYS.events, []);
}

export function clearTelarEvents() {
  write(KEYS.events, []);
}

/** Últimos eventos, para pintarlos en pantalla. */
export function useTelarEvents(limit = 2) {
  const [events, setEvents] = useState(() => getTelarEvents().slice(-limit));

  const refresh = useCallback(() => {
    setEvents(getTelarEvents().slice(-limit));
  }, [limit]);

  useEffect(() => { refresh(); }, [refresh]);

  return { events, refresh };
}

/** Cuenta regresiva de un consentimiento de pago. Devuelve mm:ss y si expiró. */
export function useExpiry(expiresAt) {
  const [remaining, setRemaining] = useState(() => msLeft(expiresAt));

  useEffect(() => {
    if (!expiresAt) return undefined;
    const id = setInterval(() => setRemaining(msLeft(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
  const mm = String(Math.floor(totalSeconds / 60)).padStart(1, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');

  return { label: `${mm}:${ss}`, expired: expiresAt ? remaining <= 0 : false, totalSeconds };
}

function msLeft(expiresAt) {
  if (!expiresAt) return 0;
  return new Date(expiresAt).getTime() - Date.now();
}
