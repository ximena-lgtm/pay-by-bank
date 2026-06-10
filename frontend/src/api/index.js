const BASE = '/api';

export async function getTrip() {
  const r = await fetch(`${BASE}/trip`);
  return r.json();
}

export async function getBanks() {
  const r = await fetch(`${BASE}/banks`);
  return r.json();
}

export async function initiatePayment(bankId) {
  const r = await fetch(`${BASE}/payment/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bankId }),
  });
  return r.json();
}

export async function authorizePayment(consentToken, method, consentHandle, bankId, amount) {
  const r = await fetch(`${BASE}/payment/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consentToken,
      method,
      consentHandle: consentHandle || consentToken,
      bankId,
      amount
    }),
  });
  return r.json();
}

export async function getConsent(consentHandle) {
  const r = await fetch(`${BASE}/consent/${consentHandle}`);
  return r.json();
}

export async function completeTrip() {
  const r = await fetch(`${BASE}/trip/complete`, { method: 'POST' });
  return r.json();
}

export async function getConsentsByUser(customerId = 'customer_001') {
  const r = await fetch(`${BASE}/consents?customerId=${customerId}`);
  return r.json();
}
