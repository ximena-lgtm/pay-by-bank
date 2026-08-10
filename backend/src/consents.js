import { createHash, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Los dos objetos de consentimiento del demo.
 *
 * Cada uno tiene su esquema propio, registrado en el ledger y versionado en este
 * repo. El mismo archivo se usa dos veces: aquí para rechazar en local con errores
 * concretos antes de gastar una llamada de red, y en el ledger como validación
 * autoritativa del record. Un solo archivo, una sola forma.
 *
 * La separación es estructural, no de convención: el esquema de datos no admite
 * `category_1_payment_initiation` en su `data_scope`, así que es imposible que un
 * consentimiento de acceso autorice un débito. Cada pago exige su propio mandato.
 */
const SCHEMAS = {
  data: { handle: 'data-consent', file: 'schemas/data-consent.json' },
  payment: { handle: 'payment-consent', file: 'schemas/payment-consent.json' },
};

// strict:false porque los esquemas llevan `description` en sitios que ajv, en modo
// estricto, considera palabras clave desconocidas.
const ajv = new Ajv({ allErrors: true, strict: false });

const validators = Object.fromEntries(
  Object.entries(SCHEMAS).map(([kind, { file }]) => [
    kind,
    ajv.compile(JSON.parse(readFileSync(join(HERE, file), 'utf8'))),
  ])
);

export const SCHEMA_HANDLES = Object.fromEntries(
  Object.entries(SCHEMAS).map(([kind, { handle }]) => [kind, handle])
);

/** Valida un anchor completo contra su esquema. Lanza con los errores concretos. */
export function validateConsentAnchor(kind, anchor) {
  const validate = validators[kind];
  if (!validate) throw new PaymentConsentError('unknown_consent_kind', `Clase de consentimiento desconocida: ${kind}`);
  if (validate(anchor)) return true;

  const errors = (validate.errors || []).map(e => {
    const where = e.instancePath || '(raíz)';
    const allowed = e.params?.allowedValues ? ` (${e.params.allowedValues.join(', ')})` : '';
    return `${where} ${e.message}${allowed}`;
  });

  throw new PaymentConsentError(
    'consent_schema_invalid',
    `El consentimiento no cumple ${SCHEMAS[kind].handle}: ${errors.join(' · ')}`,
    { errors }
  );
}

// ─── Catálogo de finalidades ──────────────────────────────────────────────────
// Catálogo cerrado local. El campo purpose_code_scheme existe para que la llegada
// del catálogo de la SFC o de ISO 20022 sea un mapeo y no una reescritura.
// Los nombres ISO (ExternalPurpose1Code) NO se han contrastado: no se usan aún.
export const PURPOSE_SCHEME = 'TELAR_LOCAL_V1';

export const PURPOSE_CODES = {
  TRANSPORT_FARE:  { context: 'TransportFare',        label: 'Transporte' },
  BILL_PAYMENT:    { context: 'BillPayment',          label: 'Pago de factura' },
  GOODS_PURCHASE:  { context: 'EcommerceGoods',       label: 'Compra de bienes' },
  SERVICE_PAYMENT: { context: 'EcommerceServices',    label: 'Pago de servicios' },
  P2P_TRANSFER:    { context: 'TransferToThirdParty', label: 'Transferencia a un tercero' },
};

/** Factores de SCA. Se exigen dos de familias distintas. */
export const SCA_FACTORS = {
  biometric_face_id: ['KNOWLEDGE_PASSWORD', 'INHERENCE_BIOMETRIC'],
  otp_sms:           ['KNOWLEDGE_PASSWORD', 'POSSESSION_OTP_SMS'],
};

export function accountToken(bankId, accountNumber) {
  return `tok_${createHash('sha256').update(`${bankId}:${accountNumber}`).digest('hex').slice(0, 32)}`;
}

export function debtorRef(customerId) {
  return `hmac_sha256_${createHash('sha256').update(customerId).digest('hex')}`;
}

export function artifactHash(payload) {
  return `sha256_${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

// ─── Construcción ─────────────────────────────────────────────────────────────

/**
 * Arma el `custom` de un mandato de pago único.
 *
 * Para un SINGLE los topes se fijan al monto exacto de la orden: es la cota más
 * estrecha posible y hace que el gate de límites sea trivialmente verificable.
 */
export function buildSinglePaymentConsent(params) {
  const {
    initiator,          // { tppId, legalName, domicile }
    easpbvId,
    debtor,             // { customerId, bankId, accountNumber, accountType, masked }
    creditor,           // { id, name, agentId, accountNumber, accountType }
    amount,
    currency,
    purposeCode,
    purposeText,
    remittance = null,
    linkingConsentRef = null,
    validityMinutes = 5,
    settlementType = 'IMMEDIATE',
    scaPolicy = 'PER_TRANSACTION',
  } = params;

  const purpose = PURPOSE_CODES[purposeCode];
  if (!purpose) {
    throw new PaymentConsentError('invalid_purpose', `purpose_code fuera del catálogo: ${purposeCode}`);
  }

  const now = new Date();
  const validUntil = new Date(now.getTime() + validityMinutes * 60_000);
  const money = { amount, currency };

  return {
    consent_id: randomUUID(),
    consent_version: '1.0',

    // Bloque A · partes y ruta
    initiator_id: initiator.tppId,
    initiator_legal_name: initiator.legalName,
    initiator_domicile: initiator.domicile,
    easpbv_id: easpbvId,
    debtor_ref: debtorRef(debtor.customerId),
    debtor_agent_id: `bridge_${debtor.bankId}`,
    debtor_account: {
      token: accountToken(debtor.bankId, debtor.accountNumber),
      masked: debtor.masked,
      type: debtor.accountType,
    },
    creditor_id: creditor.id,
    creditor_name: creditor.name,
    creditor_agent_id: creditor.agentId,
    creditor_account: {
      token: accountToken(creditor.agentId, creditor.accountNumber),
      masked: `*${String(creditor.accountNumber).slice(-4)}`,
      type: creditor.accountType,
    },
    linking_consent_ref: linkingConsentRef,

    // Bloque B · parámetros del mandato
    data_scope: ['category_1_payment_initiation'],
    consent_type: 'SINGLE',
    max_amount_per_transaction: money,
    max_amount_total: money,
    max_transaction_count: 1,
    periodic_limits: [],
    frequency: 'ADHO',
    valid_from: now.toISOString(),
    valid_until: validUntil.toISOString(),
    settlement_type: settlementType,

    // Bloque C · finalidad y contexto
    purpose_code_scheme: PURPOSE_SCHEME,
    purpose_code: purposeCode,
    purpose_text: purposeText,
    remittance_information: remittance,
    payment_context_code: purpose.context,

    // Bloque D · ejecución y autenticación (se poblan en la activación)
    sca_policy: scaPolicy,
    sca_method: null,
    sca_performed_by: null,
    confirmation_channel: easpbvId,
    confirmation_received_at: null,

    // Bloque E · ciclo de vida y evidencia
    granted_at: null,
    revoked_at: null,
    revoked_by: null,
    revocation_reason: null,
    superseded_by: null,
    authorization_artifact_hash: null,
    evidence: { event_log_ref: 'ledger.anchor.proofs', retention_years: 5 },
  };
}

// ─── Constructores de anchor ──────────────────────────────────────────────────

/**
 * Anchor completo del consentimiento de ACCESO A DATOS.
 *
 * Se otorga una vez, al vincular la cuenta. La cuenta va en null en creación y se
 * ata en la activación con lo que devuelve la entidad emisora.
 */
export function buildDataConsentAnchor(params) {
  const {
    initiator,
    customerId,
    customerWallet,
    bankId,
    purposeCode = 'ACCOUNT_LINKING',
    purposeText,
    retentionDays = 90,
    scope,
  } = params;

  const now = new Date();
  const until = new Date(now.getTime() + retentionDays * 86_400_000);

  const custom = {
    consent_id: randomUUID(),
    consent_version: '1.0',
    consent_class: 'data_access',

    initiator_id: initiator.tppId,
    initiator_legal_name: initiator.legalName,
    initiator_domicile: initiator.domicile,
    data_provider_id: `bridge_${bankId}`,
    titular_ref: debtorRef(customerId),

    data_scope: scope || ['category_2_accounts_read', 'category_3_balances_read'],
    purpose: { code: purposeCode, text: purposeText },

    treatment: {
      storage_permission: 'DURATION_BOUND',
      data_retention_days: retentionDays,
      mode: 'STORE',
    },
    commercialization: { flag: false, compensation_offered: false },

    valid_from: now.toISOString(),
    valid_until: until.toISOString(),

    account: null,
    sca_method: null,
    sca_performed_by: null,

    granted_at: null,
    revoked_at: null,
    revoked_by: null,
    revocation_reason: null,
    superseded_by: null,

    evidence: { event_log_ref: 'ledger.anchor.proofs', retention_years: 5 },
  };

  const anchor = {
    handle: `dconsent_${custom.consent_id}`,
    schema: SCHEMA_HANDLES.data,
    wallet: customerWallet,
    source: `bridge_${bankId}`,
    target: initiator.tppId,
    custom,
  };

  validateConsentAnchor('data', anchor);
  return anchor;
}

/**
 * Anchor completo del MANDATO DE PAGO, ya validado contra su esquema y contra la
 * regla de separación de partes.
 */
export function buildPaymentConsentAnchor(params) {
  const custom = buildSinglePaymentConsent(params);

  const anchor = {
    handle: `pconsent_${custom.consent_id}`,
    schema: SCHEMA_HANDLES.payment,
    wallet: params.customerWallet,
    source: custom.debtor_agent_id,
    target: custom.initiator_id,
    custom,
  };

  validateConsentAnchor('payment', anchor);
  assertPartySeparation(custom);
  return anchor;
}

// ─── Errores ──────────────────────────────────────────────────────────────────

export class PaymentConsentError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'PaymentConsentError';
    this.code = code;
    this.detail = detail;
  }
}

// ─── Reglas entre campos ──────────────────────────────────────────────────────

/**
 * Separación de partes · Art. 2.17.1.1.1 num. 27.
 *
 * El iniciador no puede ser ninguna de las otras partes, y el beneficiario no
 * puede ser la entidad emisora del ordenante.
 *
 * DESVIACIÓN DELIBERADA del esquema: no se exige debtor_agent_id ≠ creditor_agent_id.
 * Leído como cadena estricta, eso prohibiría los pagos intrabancarios — si el
 * ordenante y Uber tienen cuenta en el mismo banco, el pago sería inválido. Eso no
 * es lo que la norma persigue: el num. 27 define roles distintos, no bancos distintos.
 */
export function assertPartySeparation(custom) {
  const { initiator_id, creditor_id, debtor_agent_id, creditor_agent_id } = custom;

  const collisions = [];
  if (initiator_id === creditor_id)       collisions.push('initiator_id = creditor_id');
  if (initiator_id === debtor_agent_id)   collisions.push('initiator_id = debtor_agent_id');
  if (initiator_id === creditor_agent_id) collisions.push('initiator_id = creditor_agent_id');
  if (creditor_id === debtor_agent_id)    collisions.push('creditor_id = debtor_agent_id');

  if (collisions.length > 0) {
    throw new PaymentConsentError(
      'party_separation_violated',
      `Las partes del mandato deben ser distintas: ${collisions.join(', ')}`,
      { collisions }
    );
  }
}

/**
 * Consumo del mandato, computado sobre los proofs.
 *
 * Los contadores no persisten en el anchor: se derivan del log append-only, igual
 * que el estado. Cada intent confirmado deja un proof `intent.committed`.
 */
export function computeConsumption(meta) {
  const proofs = meta?.proofs || [];
  const executed = proofs.filter(p => p.custom?.event === 'intent.committed');

  return {
    transactions_executed: executed.length,
    amount_consumed: executed.reduce((sum, p) => sum + (p.custom?.amount || 0), 0),
    executions: executed.map(p => ({ at: p.custom?.timestamp, amount: p.custom?.amount })),
  };
}

/** Ventana de un límite periódico, según su alineación. */
function periodWindow(limit, consentValidFrom, now) {
  const spans = { DAY: 1, WEEK: 7, FORTNIGHT: 14, MONTH: 30, HALF_YEAR: 182, YEAR: 365 };
  const days = spans[limit.period_type];

  if (limit.period_alignment === 'CONSENT') {
    // Periodos contados desde el arranque del mandato: sin prorrateo del primero
    const start = new Date(consentValidFrom).getTime();
    const elapsed = Math.floor((now.getTime() - start) / (days * 86_400_000));
    return new Date(start + elapsed * days * 86_400_000);
  }

  // CALENDAR: el primer periodo se prorratea contra el calendario
  const d = new Date(now);
  if (limit.period_type === 'DAY')   return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (limit.period_type === 'MONTH') return new Date(d.getFullYear(), d.getMonth(), 1);
  if (limit.period_type === 'YEAR')  return new Date(d.getFullYear(), 0, 1);
  return new Date(now.getTime() - days * 86_400_000);
}

/**
 * Gate de ejecución. Rechaza sin interpretación humana: todo lo que compara es
 * numérico o una igualdad de identificadores.
 *
 * Se corre justo antes de crear el intent.
 */
export function assertPayable({ custom, meta, amount, currency, now = new Date() }) {
  const fail = (code, message, detail) => { throw new PaymentConsentError(code, message, detail); };

  // 1 · Estado. Se computa sobre proofs; la revocación gana.
  const revoked = (meta?.proofs || []).find(p => p.custom?.status === 'revoked');
  if (revoked) fail('consent_revoked', 'El mandato fue revocado.', { revoked_at: revoked.custom?.revoked_at });

  const granted = (meta?.proofs || []).find(p => p.custom?.status === 'active');
  if (!granted) fail('consent_not_active', 'El mandato no ha sido autorizado por el ordenante.');

  // 2 · Vigencia
  if (now < new Date(custom.valid_from)) {
    fail('consent_not_yet_valid', 'El mandato aún no está vigente.', { valid_from: custom.valid_from });
  }
  if (custom.valid_until && now > new Date(custom.valid_until)) {
    fail('consent_expired', 'El mandato venció.', { valid_until: custom.valid_until });
  }

  // 3 · Moneda
  if (currency !== custom.max_amount_per_transaction.currency) {
    fail('currency_mismatch',
      `La orden viene en ${currency} y el mandato autoriza ${custom.max_amount_per_transaction.currency}.`);
  }

  // 4 · Tope por orden
  if (amount > custom.max_amount_per_transaction.amount) {
    fail('amount_exceeds_per_transaction_limit',
      `La orden (${amount}) supera el tope por transacción (${custom.max_amount_per_transaction.amount}).`,
      { amount, limit: custom.max_amount_per_transaction.amount });
  }

  // 5 · Consumo acumulado
  const consumption = computeConsumption(meta);

  if (consumption.transactions_executed + 1 > custom.max_transaction_count) {
    fail('transaction_count_exhausted',
      `El mandato admite ${custom.max_transaction_count} orden(es) y ya ejecutó ${consumption.transactions_executed}.`,
      { executed: consumption.transactions_executed, limit: custom.max_transaction_count });
  }

  if (consumption.amount_consumed + amount > custom.max_amount_total.amount) {
    fail('cumulative_amount_exceeded',
      `La orden llevaría el acumulado a ${consumption.amount_consumed + amount}, sobre el tope de ${custom.max_amount_total.amount}.`,
      { consumed: consumption.amount_consumed, amount, limit: custom.max_amount_total.amount });
  }

  // 6 · Límites periódicos
  for (const limit of custom.periodic_limits || []) {
    const from = periodWindow(limit, custom.valid_from, now);
    const inWindow = consumption.executions.filter(e => e.at && new Date(e.at) >= from);
    const windowAmount = inWindow.reduce((s, e) => s + (e.amount || 0), 0);

    if (inWindow.length + 1 > limit.max_count) {
      fail('periodic_count_exceeded',
        `Tope de ${limit.max_count} orden(es) por ${limit.period_type} alcanzado.`,
        { period: limit.period_type, executed: inWindow.length, limit: limit.max_count });
    }
    if (windowAmount + amount > limit.max_amount.amount) {
      fail('periodic_amount_exceeded',
        `Tope de ${limit.max_amount.amount} por ${limit.period_type} alcanzado.`,
        { period: limit.period_type, consumed: windowAmount, limit: limit.max_amount.amount });
    }
  }

  // 7 · Art. 2.17.4.1.3 num. 3 — única regla de validación literal en la norma de pagos
  const performedBy = granted.custom?.sca_performed_by;
  if (performedBy !== custom.debtor_agent_id) {
    fail('sca_performed_by_mismatch',
      `La SCA la registró ${performedBy || 'nadie'} y debía ejecutarla la entidad emisora ${custom.debtor_agent_id}.`,
      { sca_performed_by: performedBy, debtor_agent_id: custom.debtor_agent_id });
  }

  // 8 · Dos factores como mínimo
  const factors = granted.custom?.sca_method || [];
  if (factors.length < 2) {
    fail('sca_insufficient_factors',
      `La autenticación reforzada exige dos factores y se registraron ${factors.length}.`,
      { factors });
  }

  return { consumption, grantedAt: granted.custom?.granted_at, factors };
}
