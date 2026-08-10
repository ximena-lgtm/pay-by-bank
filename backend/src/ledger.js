import { LedgerSdk } from '@minka/ledger-sdk';
import {
  buildDataConsentAnchor,
  buildPaymentConsentAnchor,
  assertPayable,
  computeConsumption,
  artifactHash,
  accountToken,
  SCA_FACTORS,
  SCHEMA_HANDLES,
  PaymentConsentError,
} from './consents.js';

export { assertPayable, computeConsumption, PaymentConsentError, SCHEMA_HANDLES };

// ─── Configuración ────────────────────────────────────────────────────────────

const LEDGER_URL = process.env.LEDGER_URL || 'https://open-finance2.ldg-dev.one/api/v2';
const SIGNER_PUBLIC = process.env.SIGNER_PUBLIC;
const SIGNER_SECRET = process.env.SIGNER_SECRET;
const LEDGER_AUDIENCE = process.env.LEDGER_AUDIENCE || 'open-finance2';

if (!SIGNER_PUBLIC || !SIGNER_SECRET) {
  throw new Error('Faltan SIGNER_PUBLIC y SIGNER_SECRET en el entorno.');
}

const KEY_PAIR = { public: SIGNER_PUBLIC, secret: SIGNER_SECRET, format: 'ed25519-raw' };

// ─── Partes ───────────────────────────────────────────────────────────────────

// El TPP registrado ante la SFC como iniciador de pagos (PISP) es Telar.
// Uber es el comercio beneficiario: viaja en el mandato como creditor, nunca como
// titular del consentimiento.
const TPP_ID = 'tpp_telar';
const TPP_LEGAL_NAME = 'Telar Pagos SAS';
const TPP_DOMICILE = 'Calle 93 #11-30, Bogotá, Colombia';
const TPP_SFC_REG = 'Reg. SFC #PISP-2026-042';

const MERCHANT_ID = 'merchant_uber';
const MERCHANT_LEGAL_NAME = 'Uber Colombia SAS, NIT 900.xxx';

// Entidad administradora del sistema de pago de bajo valor que enruta la
// confirmación de vuelta (Art. 2.17.4.1.1 + num. 3).
const EASPBV_ID = 'easpbv_breb';

const INITIATOR = { tppId: TPP_ID, legalName: TPP_LEGAL_NAME, domicile: TPP_DOMICILE };

export const TELAR = {
  tppId: TPP_ID,
  legalName: TPP_LEGAL_NAME,
  domicile: TPP_DOMICILE,
  sfcReg: TPP_SFC_REG,
  merchantId: MERCHANT_ID,
  merchantLegalName: MERCHANT_LEGAL_NAME,
  easpbvId: EASPBV_ID,
};

/**
 * Cliente del ledger, autenticado.
 *
 * Las escrituras pasan firmadas en el cuerpo, pero las **lecturas** de este ledger
 * exigen un bearer token: sin él `GET /anchors/:handle` responde `auth.forbidden` y
 * las consultas devuelven cero filas aunque el record exista. Sin lecturas no hay
 * estado, ni gates, ni cómputo de consumo — de ahí que se componga el JWT en cada
 * llamada. El token es de vida corta, así que no se cachea.
 */
function sdk() {
  return new LedgerSdk({
    server: LEDGER_URL,
    secure: {
      iss: TPP_ID,
      sub: SIGNER_PUBLIC,
      aud: LEDGER_AUDIENCE,
      exp: Math.floor(Date.now() / 1000) + 300,
      keyPair: KEY_PAIR,
      kid: SIGNER_PUBLIC,
    },
  });
}

// ─── Estado derivado ──────────────────────────────────────────────────────────

/**
 * Estado real de un consentimiento a partir de sus proofs.
 * Nunca se escribe: se computa. La revocación gana sobre la activación, sin
 * importar el orden en que lleguen los proofs.
 */
export function deriveConsentStatus(meta) {
  const proofs = meta?.proofs || [];

  const revoked = proofs.find(p => p.custom?.status === 'revoked');
  if (revoked) {
    return { status: 'revoked', revokedAt: revoked.custom?.revoked_at, grantedAt: null, scaMethod: null };
  }

  const active = proofs.find(p => p.custom?.status === 'active');
  if (active) {
    return {
      status: 'active',
      grantedAt: active.custom?.granted_at,
      scaMethod: active.custom?.sca_method,
      scaPerformedBy: active.custom?.sca_performed_by,
      account: active.custom?.account || null,
      revokedAt: null,
    };
  }

  return { status: meta?.status || 'pending', grantedAt: null, scaMethod: null, revokedAt: null };
}

/** Lee el record completo de un consentimiento, con sus proofs. */
export async function readConsentRecord(handle) {
  try {
    return await sdk().anchor.read(handle);
  } catch (error) {
    const reason = error.response?.data?.data?.reason || error.reason;
    throw new PaymentConsentError('consent_not_found', `No se pudo leer ${handle}${reason ? ` (${reason})` : ''}`);
  }
}

// ─── Consentimiento de acceso a datos ─────────────────────────────────────────

/**
 * Crea el consentimiento de ACCESO A DATOS, en pendiente.
 *
 * Su único uso es traer la información de la cuenta y vincularla la primera vez.
 * No autoriza débitos: su esquema no admite la categoría de iniciación de pago.
 */
export async function createDataConsent({ customerId, customerWallet, bankId, bankName }) {
  const anchor = buildDataConsentAnchor({
    initiator: INITIATOR,
    customerId,
    customerWallet,
    bankId,
    purposeCode: 'ACCOUNT_LINKING',
    purposeText:
      `Vinculación de la cuenta del titular en ${bankName || bankId}. Autoriza a ${TPP_LEGAL_NAME} ` +
      `a verificar titularidad y consultar saldo. No autoriza débitos: cada pago exige un mandato independiente.`,
  });

  console.log('📝 Consentimiento de acceso a datos ·', anchor.handle);

  try {
    const result = await sdk()
      .anchor.init()
      .data(anchor)
      .hash()
      .sign([
        {
          keyPair: KEY_PAIR,
          custom: {
            labels: [
              'consent',
              'class:data_access',
              `tpp:${TPP_ID}`,
              `bank:${bankId}`,
              `titular:${customerId}`,
              'status:pending',
            ],
            status: 'pending',
            event: 'data_consent.created',
            timestamp: new Date().toISOString(),
          },
        },
      ])
      .send();

    return {
      consent_id: anchor.custom.consent_id,
      consent_handle: result.anchor.handle,
      consent_luid: result.luid,
      status: 'pending',
      expires_at: anchor.custom.valid_until,
      custom: anchor.custom,
    };
  } catch (error) {
    const detail = error.response?.data?.detail || error.detail || error.message;
    console.error('❌ Error creando el consentimiento de acceso:', detail);
    throw new PaymentConsentError('data_consent_create_failed', detail);
  }
}

/**
 * La entidad emisora otorga el acceso tras la SCA, y en el mismo proof ata la
 * cuenta: es el momento en que el iniciador se entera de cuál es.
 */
export async function activateDataConsent(consentHandle, { scaMethod, customerId, account }) {
  const factors = SCA_FACTORS[scaMethod];
  if (!factors) throw new PaymentConsentError('unknown_sca_method', `Método de SCA no reconocido: ${scaMethod}`);

  const current = await readConsentRecord(consentHandle);
  const custom = current.anchor.custom;
  const now = new Date().toISOString();

  // La SCA la ejecuta la entidad emisora del titular, nadie más
  const scaPerformedBy = custom.data_provider_id;

  const bound = account
    ? {
        token: accountToken(account.bankId, account.number),
        masked: account.masked,
        type: account.type,
        holder_name: account.holderName,
      }
    : null;

  const result = await sdk()
    .anchor.from({ data: current.anchor, hash: current.hash, meta: current.meta, luid: current.luid })
    .sign([
      {
        keyPair: KEY_PAIR,
        custom: {
          status: 'active',
          event: 'data_consent.granted',
          timestamp: now,
          granted_at: now,
          sca_performed_by: scaPerformedBy,
          sca_method: factors,
          account: bound,
          actor: scaPerformedBy,
          titular: customerId,
        },
      },
    ])
    .send();

  console.log('✅ Acceso otorgado ·', consentHandle, '· SCA por', scaPerformedBy);

  return {
    consent_id: custom.consent_id,
    consent_handle: result.anchor.handle,
    status: 'active',
    granted_at: now,
    sca_method: factors,
    sca_performed_by: scaPerformedBy,
    account: bound,
  };
}

/**
 * Revoca un consentimiento. Sirve para las dos clases.
 *
 * Revocar el acceso a datos deja al titular sin capacidad de iniciar pagos nuevos:
 * el mandato exige que la cuenta siga vinculada.
 */
export async function revokeConsent(consentHandle, reason = 'Revocado por el titular') {
  const current = await readConsentRecord(consentHandle);
  const now = new Date().toISOString();

  await sdk()
    .anchor.from({ data: current.anchor, hash: current.hash, meta: current.meta, luid: current.luid })
    .sign([
      {
        keyPair: KEY_PAIR,
        custom: {
          status: 'revoked',
          event: 'consent.revoked',
          timestamp: now,
          revoked_at: now,
          revoked_by: 'TITULAR',
          revocation_reason: reason,
        },
      },
    ])
    .send();

  console.log('🚫 Consentimiento revocado ·', consentHandle);
  return { consent_handle: consentHandle, status: 'revoked', revoked_at: now, revocation_reason: reason };
}

// ─── Mandato de pago ──────────────────────────────────────────────────────────

/**
 * Crea el MANDATO DE PAGO, en pendiente. Uso único, con su propio esquema.
 *
 * Se crea en cada pago, antes del intent. El consentimiento de acceso a datos no
 * autoriza débitos; de él solo se hereda el token de cuenta.
 */
export async function createPaymentConsent(params) {
  const {
    customerId,
    customerWallet,
    bankId,
    bankAccount,
    linkingConsentRef,
    amount,
    currency = 'COP',
    purposeCode,
    purposeText,
    remittance = null,
    creditor,
    validityMinutes = 5,
  } = params;

  const anchor = buildPaymentConsentAnchor({
    initiator: INITIATOR,
    easpbvId: EASPBV_ID,
    customerWallet,
    debtor: {
      customerId,
      bankId,
      accountNumber: bankAccount.number,
      accountType: bankAccount.type,
      masked: bankAccount.masked,
    },
    creditor,
    amount,
    currency,
    purposeCode,
    purposeText,
    remittance,
    linkingConsentRef,
    validityMinutes,
  });

  console.log('📝 Mandato de pago ·', anchor.handle, '·', currency, amount, '·', purposeCode);

  try {
    const result = await sdk()
      .anchor.init()
      .data(anchor)
      .hash()
      .sign([
        {
          keyPair: KEY_PAIR,
          custom: {
            labels: [
              'consent',
              'class:payment',
              `tpp:${TPP_ID}`,
              `bank:${bankId}`,
              `titular:${customerId}`,
              `purpose:${purposeCode}`,
              'status:pending',
            ],
            status: 'pending',
            event: 'payment_consent.created',
            timestamp: new Date().toISOString(),
          },
        },
      ])
      .send();

    return {
      consent_id: anchor.custom.consent_id,
      consent_handle: result.anchor.handle,
      consent_luid: result.luid,
      status: 'pending',
      custom: anchor.custom,
    };
  } catch (error) {
    const detail = error.response?.data?.detail || error.detail || error.message;
    console.error('❌ Error creando el mandato de pago:', detail);
    throw new PaymentConsentError('payment_consent_create_failed', detail);
  }
}

/**
 * La entidad emisora firma la SCA sobre el mandato.
 *
 * De este proof dependen dos gates: sca_performed_by = debtor_agent_id
 * (Art. 2.17.4.1.3 num. 3) y el mínimo de dos factores (Art. 2.35.8.3.4).
 */
export async function activatePaymentConsent(consentHandle, { scaMethod, customerId }) {
  const factors = SCA_FACTORS[scaMethod];
  if (!factors) throw new PaymentConsentError('unknown_sca_method', `Método de SCA no reconocido: ${scaMethod}`);

  const current = await readConsentRecord(consentHandle);
  const custom = current.anchor.custom;
  const now = new Date().toISOString();

  const scaPerformedBy = custom.debtor_agent_id;

  const artifact = artifactHash({
    consent_id: custom.consent_id,
    debtor_account: custom.debtor_account?.token,
    creditor_account: custom.creditor_account?.token,
    max_amount_per_transaction: custom.max_amount_per_transaction,
    purpose_code: custom.purpose_code,
    granted_at: now,
  });

  const result = await sdk()
    .anchor.from({ data: current.anchor, hash: current.hash, meta: current.meta, luid: current.luid })
    .sign([
      {
        keyPair: KEY_PAIR,
        custom: {
          status: 'active',
          event: 'payment_consent.granted',
          timestamp: now,
          granted_at: now,
          sca_performed_by: scaPerformedBy,
          sca_method: factors,
          sca_policy: custom.sca_policy,
          confirmation_channel: custom.confirmation_channel,
          confirmation_received_at: now,
          authorization_artifact_hash: artifact,
          actor: scaPerformedBy,
          titular: customerId,
        },
      },
    ])
    .send();

  console.log('✅ Mandato autorizado ·', consentHandle, '· SCA por', scaPerformedBy, '·', factors.join(' + '));

  return {
    consent_handle: result.anchor.handle,
    status: 'active',
    granted_at: now,
    sca_performed_by: scaPerformedBy,
    sca_method: factors,
    authorization_artifact_hash: artifact,
  };
}

/**
 * Deja constancia de que el intent se comprometió contra este mandato.
 * Es lo que permite computar el consumo sin persistir contadores.
 */
export async function recordIntentCommitted(consentHandle, { amount, currency, intentHandle }) {
  const current = await readConsentRecord(consentHandle);

  await sdk()
    .anchor.from({ data: current.anchor, hash: current.hash, meta: current.meta, luid: current.luid })
    .sign([
      {
        keyPair: KEY_PAIR,
        custom: {
          event: 'intent.committed',
          timestamp: new Date().toISOString(),
          amount,
          currency,
          intent_handle: intentHandle,
        },
      },
    ])
    .send();

  console.log('🧾 Consumo registrado en el mandato ·', intentHandle);
}

// ─── Consulta de consentimientos ──────────────────────────────────────────────

/**
 * Consentimientos activos y vigentes del titular, por clase.
 *
 * `list()` no devuelve `meta`, y el estado se computa sobre los proofs, así que
 * hace falta releer cada uno. Con un puñado de consentimientos por titular es
 * aceptable; si creciera, tocaría un índice propio en vez de N lecturas.
 */
export async function listUserConsents(customerId, bankId = null, consentClass = 'data_access') {
  const schema = consentClass === 'payment' ? SCHEMA_HANDLES.payment : SCHEMA_HANDLES.data;

  let handles = [];
  try {
    const res = await sdk().anchor.list({ 'data.schema': schema, 'data.target': TPP_ID, limit: 100 });
    handles = (res.anchors || [])
      .filter(a => !bankId || a.source === `bridge_${bankId}`)
      .map(a => a.handle);
  } catch (error) {
    console.error('❌ Error listando consentimientos:', error.response?.data?.detail || error.message);
    return [];
  }

  const consents = [];
  for (const handle of handles) {
    try {
      const record = await sdk().anchor.read(handle);
      const custom = record.anchor.custom || {};
      const derived = deriveConsentStatus(record.meta);

      const expiresAt = custom.valid_until;
      const isCurrent = !expiresAt || new Date(expiresAt) > new Date();
      if (derived.status !== 'active' || !isCurrent) continue;

      consents.push({
        consent_id: custom.consent_id,
        handle: record.anchor.handle,
        wallet: record.anchor.wallet,
        status: derived.status,
        consent_class: custom.consent_class || (schema === SCHEMA_HANDLES.payment ? 'payment' : 'data_access'),
        data_scope: custom.data_scope,
        purpose: custom.purpose || { code: custom.purpose_code, text: custom.purpose_text },
        initiator_id: custom.initiator_id,
        data_provider_id: custom.data_provider_id || custom.debtor_agent_id,
        bank_id: (custom.data_provider_id || custom.debtor_agent_id || '').replace('bridge_', ''),
        titular_ref: custom.titular_ref || custom.debtor_ref,
        account: derived.account || custom.account || custom.debtor_account || null,
        granted_at: derived.grantedAt,
        sca_method: derived.scaMethod,
        sca_performed_by: derived.scaPerformedBy,
        expires_at: expiresAt,
        created_at: custom.valid_from,
      });
    } catch {
      // Un consentimiento ilegible no debe tumbar el listado
    }
  }

  return consents;
}

// ─── Intent ───────────────────────────────────────────────────────────────────

/**
 * Crea el intent de transferencia.
 *
 * Usa el esquema `transfer` que el propio ledger trae para intents: registrar uno
 * nuestro solo para renombrarlo no aportaría nada, y los esquemas no se pueden
 * borrar. Su forma es estricta y distinta de la del demo anterior:
 *
 *  - `symbol.handle` va en MAYÚSCULAS (`COP`), y el símbolo tiene factor 100, así
 *    que el monto viaja en unidades menores.
 *  - `source.custom` y `target.custom` exigen name, entityType, idType e idNumber,
 *    con idType en {txid, ccpt, nidn}.
 *  - el `custom` del intent solo admite `description`, así que la trazabilidad
 *    hacia el mandato va ahí, en texto.
 */
export async function createPaymentIntent(params) {
  const { consentId, bankId, amount, currency = 'COP', reference, debtor, creditor } = params;

  const handle = `pay_${reference}`.toLowerCase().replace(/[^a-z0-9_-]/g, '');

  const intentData = {
    handle,
    schema: 'transfer',
    access: [{ action: 'any', signer: { public: SIGNER_PUBLIC } }],
    config: { commit: 'auto' },
    claims: [
      {
        action: 'transfer',
        symbol: { handle: currency.toUpperCase() },
        source: {
          handle: `svgs:${debtor.accountNumber}@${bankId}.com`,
          custom: {
            name: debtor.name,
            entityType: 'individual',
            idType: 'nidn',
            idNumber: debtor.documentNumber,
          },
        },
        target: {
          handle: `svgs:${creditor.accountNumber}@${creditor.bankDomain}`,
          custom: {
            name: creditor.name,
            entityType: 'business',
            idType: 'txid',
            idNumber: creditor.documentNumber,
          },
        },
        amount: Math.round(amount * 100),
      },
    ],
    custom: {
      description: `${reference} · mandato ${consentId} · iniciado por ${TPP_LEGAL_NAME}`,
    },
  };

  console.log('💳 Intent de transferencia ·', handle, '·', currency, amount);

  try {
    const result = await sdk().intent.init().data(intentData).hash().sign([{ keyPair: KEY_PAIR }]).send();

    return {
      intent_handle: result.intent?.handle || handle,
      intent_luid: result.luid,
      status: result.intent?.status || 'created',
      amount,
      currency,
      reference,
    };
  } catch (error) {
    const detail = error.response?.data?.detail || error.detail || error.message;
    console.error('❌ Error creando el intent:', detail);
    throw new PaymentConsentError('intent_create_failed', detail);
  }
}
