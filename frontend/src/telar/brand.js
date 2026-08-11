/**
 * Identidad del iniciador de pagos.
 *
 * Telar es una marca inventada para este demo: asume el papel de PISP (iniciador
 * de pagos) frente al comercio y a las entidades financieras. Cambiar de proveedor
 * debería ser cambiar solo este archivo y los tokens --telar-* de index.css.
 */
export const TELAR = {
  name:       'Telar',
  role:       'Iniciador de pagos',
  roleShort:  'Iniciador',
  legalName:  'Telar Pagos SAS',
  sfcReg:     'Reg. SFC #PISP-2026-042',
  supervisor: 'Vigilado por la SFC',
  domain:     'telar.co',
};

/** Los dos tipos de consentimiento que Telar solicita, y cómo se presentan. */
export const CONSENT_KIND = {
  data: {
    id:      'data',
    tag:     'Acceso a datos',
    tone:    'data',
    verb:    'Vincular cuenta',
    scope:   ['category_2_accounts_read', 'category_3_balances_read'],
  },
  payment: {
    id:      'payment',
    tag:     'Autorización de pago',
    tone:    'pay',
    verb:    'Autorizar pago',
    scope:   ['category_1_payment_initiation'],
  },
};

export function formatCOP(amount) {
  return (amount || 0).toLocaleString('es-CO');
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}
