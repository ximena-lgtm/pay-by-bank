import express from 'express';
import cors from 'cors';
import {
  createDataConsent,
  activateDataConsent,
  createPaymentConsent,
  activatePaymentConsent,
  recordIntentCommitted,
  revokeConsent,
  readConsentRecord,
  listUserConsents,
  createPaymentIntent,
  deriveConsentStatus,
  assertPayable,
  computeConsumption,
  PaymentConsentError,
  SCHEMA_HANDLES,
  ledgerConfig,
  TELAR,
} from './ledger.js';
import { PURPOSE_CODES } from './consents.js';

const app = express();
app.use(cors());
app.use(express.json());

// ─── Mock data ────────────────────────────────────────────────────────────────

// Entidades financieras conectadas a Telar.
// NO son PISP: el iniciador de pagos es Telar. Estas son las entidades donde el
// titular tiene su cuenta y desde donde se origina el débito.
const BANKS = [
  { id: 'nu',          name: 'Nu',              type: 'Fintech', color: '#8A05BE', monogram: 'Nu', account: '*8834', accountType: 'Ahorros', featured: true,  order: 1 },
  { id: 'bancolombia', name: 'Bancolombia',     type: 'Banco',   color: '#FFD100', monogram: 'Bc', account: '*4417', accountType: 'Ahorros', featured: true,  order: 2 },
  { id: 'daviplata',   name: 'Daviplata',       type: 'Fintech', color: '#BE1622', monogram: 'Dp', account: '*3092', accountType: 'Depósito', featured: true, order: 3 },
  { id: 'bogota',      name: 'Banco de Bogotá', type: 'Banco',   color: '#003DA5', monogram: 'Bg', account: '*7725', accountType: 'Ahorros', featured: true,  order: 4 },
  { id: 'nequi',       name: 'Nequi',           type: 'Fintech', color: '#7B2FF7', monogram: 'Nq', account: '*5518', accountType: 'Depósito', featured: true, order: 5 },
  { id: 'falabella',   name: 'Banco Falabella', type: 'Banco',   color: '#00A650', monogram: 'Fa', account: '*2156', accountType: 'Ahorros', featured: true,  order: 6 },
  { id: 'davivienda',  name: 'Davivienda',      type: 'Banco',   color: '#BE1622', monogram: 'Dv', account: '*8801', accountType: 'Ahorros', featured: false, order: 7 },
  { id: 'bbva',        name: 'BBVA Colombia',   type: 'Banco',   color: '#004A99', monogram: 'Bv', account: '*6634', accountType: 'Ahorros', featured: false, order: 8 },
];

const TRIP = {
  origin:      'El Dorado · Terminal T1',
  destination: 'Zona Rosa · Calle 85',
  amount:      18500,
  currency:    'COP',
  type:        'UberX',
  concept:     'Viaje UberX · El Dorado → Zona Rosa',
  merchant:    TELAR.merchantLegalName,
  eta:         4,
  duration:    32,
};

const CUSTOMER = {
  id:       'customer_001',
  wallet:   'wallet_customer_001',
  name:     'Simón Rodríguez',
  document: '1234567890',
};

// Cuenta de Uber donde se abona
const CREDIT_ACCOUNT = {
  bankCode:      'BANCOLOMBIA_CO',
  accountNumber: '400211',
  accountType:   'CHECKING',
};

// El beneficiario del mandato de pago. Uber es el comercio, no el iniciador:
// su entidad emisora (creditor_agent_id) es donde recibe el abono.
const CREDITOR = {
  id:             TELAR.merchantId,
  name:           TELAR.merchantLegalName,
  agentId:        'bridge_bancolombia',
  accountNumber:  CREDIT_ACCOUNT.accountNumber,
  accountType:    CREDIT_ACCOUNT.accountType,
  bankDomain:     'bancolombia.com',
  documentNumber: '900460990',
};

// Finalidad del pago en este caso de uso. Catálogo cerrado: texto libre como
// único identificador de finalidad está prohibido.
const TRIP_PURPOSE_CODE = 'TRANSPORT_FARE';

const INITIATOR = {
  name:      'Telar',
  legalName: TELAR.legalName,
  role:      'Iniciador de pagos · PISP',
  sfcReg:    TELAR.sfcReg,
  supervisor: 'Superintendencia Financiera de Colombia',
};

function findBank(bankId) {
  return BANKS.find(b => b.id === bankId);
}

// ─── Diagnóstico ──────────────────────────────────────────────────────────────

/**
 * GET /api/health — qué falta para que el demo funcione.
 *
 * Existe porque el modo de fallo natural de este despliegue es mudo: si la función
 * no arranca o el ledger no responde, el frontend solo muestra listas vacías. Una
 * petición aquí dice si faltan variables de entorno, si los esquemas entraron en el
 * paquete y si el ledger contesta.
 */
app.get('/api/health', async (_req, res) => {
  const config = ledgerConfig();

  const checks = {
    env: {
      ok: config.ready,
      detail: config.ready ? 'variables presentes' : `faltan: ${config.missing.join(', ')}`,
    },
    schemas: {
      ok: Boolean(SCHEMA_HANDLES.data && SCHEMA_HANDLES.payment),
      detail: `${SCHEMA_HANDLES.data}, ${SCHEMA_HANDLES.payment}`,
    },
    banks: { ok: BANKS.length > 0, detail: `${BANKS.length} entidades en el directorio` },
    ledger: { ok: false, detail: 'no se intentó' },
  };

  if (config.ready) {
    try {
      const consents = await listUserConsents(CUSTOMER.id, null, 'data_access');
      checks.ledger = { ok: true, detail: `responde · ${consents.length} consentimientos activos` };
    } catch (error) {
      checks.ledger = { ok: false, detail: error.message };
    }
  } else {
    checks.ledger.detail = 'sin credenciales no se intenta';
  }

  const ok = Object.values(checks).every(c => c.ok);
  res.status(ok ? 200 : 503).json({ ok, ledger: config.url, audience: config.audience, checks });
});

// ─── Trip ─────────────────────────────────────────────────────────────────────

app.get('/api/trip', (_req, res) => {
  res.json({ ok: true, trip: TRIP, merchant: TELAR.merchantLegalName });
});

// ─── Directorio de entidades ──────────────────────────────────────────────────

// GET /api/banks — entidades conectadas a Telar, con estado de vinculación
app.get('/api/banks', async (req, res) => {
  const customerId = req.query.customerId || CUSTOMER.id;

  let activeConsents = [];
  try {
    activeConsents = await listUserConsents(customerId, null, 'data_access');
  } catch (error) {
    console.error('Error obteniendo consentimientos:', error.message);
  }

  const banks = BANKS
    .map(bank => {
      const consent = activeConsents.find(c => c.bank_id === bank.id);
      return {
        ...bank,
        linked: Boolean(consent),
        hasActiveConsent: Boolean(consent),
        consentHandle: consent?.handle || null,
        consentExpiresAt: consent?.expires_at || null,
      };
    })
    .sort((a, b) => a.order - b.order);

  res.json({
    ok: true,
    total: banks.length,
    linked: banks.filter(b => b.linked).length,
    source: 'Entidades conectadas a Telar',
    initiator: INITIATOR,
    banks,
  });
});

// GET /api/accounts — cuentas vinculadas del titular (consentimiento de datos activo)
app.get('/api/accounts', async (req, res) => {
  const customerId = req.query.customerId || CUSTOMER.id;

  try {
    const activeConsents = await listUserConsents(customerId, null, 'data_access');

    const accounts = activeConsents
      .map(consent => {
        const bank = findBank(consent.bank_id);
        if (!bank) return null;
        return {
          bankId:        bank.id,
          bankName:      bank.name,
          color:         bank.color,
          monogram:      bank.monogram,
          account:       bank.account,
          accountType:   bank.accountType,
          holderName:    CUSTOMER.name,
          consentHandle: consent.handle,
          consentId:     consent.consent_id,
          grantedAt:     consent.granted_at,
          expiresAt:     consent.expires_at,
          scaMethod:     consent.sca_method,
          dataScope:     consent.data_scope,
        };
      })
      .filter(Boolean);

    res.json({ ok: true, total: accounts.length, accounts });
  } catch (error) {
    console.error('Error listando cuentas:', error);
    res.status(500).json({ ok: false, error: 'Error listando cuentas vinculadas', message: error.message });
  }
});

// ─── Experiencia A · Consentimiento de acceso a datos ─────────────────────────

// POST /api/consent/link/initiate — crear (o reusar) el consentimiento de acceso
app.post('/api/consent/link/initiate', async (req, res) => {
  const { bankId, customerId = CUSTOMER.id } = req.body;
  const bank = findBank(bankId);
  if (!bank) return res.status(404).json({ ok: false, error: 'Entidad no encontrada' });

  try {
    const activeConsents = await listUserConsents(customerId, bankId, 'data_access');
    const existing = activeConsents[0];

    if (existing) {
      console.log('♻️  Acceso vigente, no se crea uno nuevo:', existing.handle);
      return res.json({
        ok: true,
        reused: true,
        consent: {
          id:        existing.consent_id,
          handle:    existing.handle,
          status:    'active',
          type:      'data_access',
          expiresAt: existing.expires_at,
          grantedAt: existing.granted_at,
        },
        bank,
        initiator: INITIATOR,
      });
    }

    console.log('🆕 Creando consentimiento de acceso a datos para:', bankId);
    const consent = await createDataConsent({
      customerId,
      customerWallet: CUSTOMER.wallet,
      bankId,
      bankName: bank.name,
    });

    res.json({
      ok: true,
      reused: false,
      consent: {
        id:        consent.consent_id,
        handle:    consent.consent_handle,
        status:    consent.status,
        type:      'data_access',
        expiresAt: consent.expires_at,
        luid:      consent.consent_luid,
      },
      // Lo que el titular está a punto de autorizar, para pintar la hoja de Telar
      scope: [
        { granted: true,  text: 'Confirmar que la cuenta es tuya — nombre y documento' },
        { granted: true,  text: 'Ver el número y tipo de cuenta' },
        { granted: true,  text: 'Consultar si hay fondos antes de cada pago' },
        { granted: false, text: 'No mueve dinero. Cada pago se autoriza aparte.' },
        { granted: false, text: 'No accede a tu historial de movimientos.' },
      ],
      retentionDays: 90,
      bank,
      holder: { name: CUSTOMER.name, document: CUSTOMER.document },
      initiator: INITIATOR,
    });
  } catch (error) {
    console.error('Error creando consentimiento de acceso:', error);
    res.status(500).json({ ok: false, error: 'Error creando consentimiento de acceso', message: error.message });
  }
});

// POST /api/consent/link/activate — el banco otorga el acceso tras la SCA
app.post('/api/consent/link/activate', async (req, res) => {
  const { consentHandle, scaMethod = 'biometric_face_id', bankId, customerId = CUSTOMER.id } = req.body;
  if (!consentHandle) return res.status(400).json({ ok: false, error: 'Falta consentHandle' });

  const bank = findBank(bankId);

  try {
    // La cuenta se ata aquí: es el momento en que la entidad emisora la revela
    const result = await activateDataConsent(consentHandle, {
      scaMethod,
      customerId,
      account: bank && {
        bankId: bank.id,
        number: bank.account.replace('*', ''),
        type: bank.accountType === 'Depósito' ? 'DEPOSIT' : 'SAVINGS',
        masked: bank.account,
        holderName: CUSTOMER.name,
      },
    });

    res.json({
      ok: true,
      consent: {
        id:        result.consent_id,
        handle:    result.consent_handle,
        status:    'active',
        type:      'data_access',
        grantedAt: result.granted_at,
        scaMethod: result.sca_method,
        scaPerformedBy: result.sca_performed_by,
        account: result.account,
      },
    });
  } catch (error) {
    console.error('Error activando consentimiento de acceso:', error);
    res.status(500).json({ ok: false, error: 'Error activando el acceso', message: error.message });
  }
});

// POST /api/consent/:handle/revoke — el titular revoca el acceso
app.post('/api/consent/:handle/revoke', async (req, res) => {
  const { handle } = req.params;
  const { reason } = req.body || {};

  try {
    const result = await revokeConsent(handle, reason || 'Revocado por el titular desde Medios de pago');
    res.json({ ok: true, consent: result });
  } catch (error) {
    console.error('Error revocando consentimiento:', error);
    res.status(500).json({ ok: false, error: 'Error revocando el consentimiento', message: error.message });
  }
});

// ─── Experiencia B · Consentimiento de pago ───────────────────────────────────

// POST /api/payment/consent — crear el mandato de pago de uso único
//
// El consentimiento de acceso a datos NO autoriza débitos: solo sirvió para traer
// la información de la cuenta y vincularla. De él se toma el token de cuenta del
// ordenante; la autorización de pago la da este mandato, con su propio esquema.
app.post('/api/payment/consent', async (req, res) => {
  const { bankId, amount, customerId = CUSTOMER.id } = req.body;
  const bank = findBank(bankId);
  if (!bank) return res.status(404).json({ ok: false, error: 'Entidad no encontrada' });

  const paymentAmount = amount || TRIP.amount;

  try {
    // La cuenta tiene que estar vinculada: de ahí sale el token del ordenante
    const linked = await listUserConsents(customerId, bankId, 'data_access');
    const linking = linked[0];

    if (!linking) {
      return res.status(409).json({
        ok: false,
        error: 'Cuenta no vinculada',
        message: `No hay una cuenta vinculada en ${bank.name}. Vincúlala antes de pagar.`,
        needsLinking: true,
        bank,
      });
    }

    const consent = await createPaymentConsent({
      customerId,
      customerWallet: CUSTOMER.wallet,
      bankId,
      bankAccount: {
        number: bank.account.replace('*', ''),
        type:   bank.accountType === 'Depósito' ? 'DEPOSIT' : 'SAVINGS',
        masked: bank.account,
      },
      linkingConsentRef: linking.handle,
      amount:      paymentAmount,
      currency:    TRIP.currency,
      purposeCode: TRIP_PURPOSE_CODE,
      purposeText: `Pago del ${TRIP.concept} a ${TELAR.merchantLegalName}. Débito único autorizado por el titular de la cuenta ${bank.account} en ${bank.name}.`,
      creditor:    CREDITOR,
      easpbvId:    TELAR.easpbvId,
      validityMinutes: 5,
    });

    const c = consent.custom;

    res.json({
      ok: true,
      consent: {
        id:        c.consent_id,
        handle:    consent.consent_handle,
        status:    consent.status,
        type:      'payment',
        singleUse: c.consent_type === 'SINGLE',
        expiresAt: c.valid_until,
        luid:      consent.consent_luid,
      },
      // Parámetros del mandato que el ordenante debe poder ver antes de firmar
      mandate: {
        consentType:            c.consent_type,
        maxAmountPerTransaction: c.max_amount_per_transaction,
        maxAmountTotal:          c.max_amount_total,
        maxTransactionCount:     c.max_transaction_count,
        periodicLimits:          c.periodic_limits,
        frequency:               c.frequency,
        validFrom:               c.valid_from,
        validUntil:              c.valid_until,
        settlementType:          c.settlement_type,
        purposeCode:             c.purpose_code,
        purposeScheme:           c.purpose_code_scheme,
        purposeLabel:            PURPOSE_CODES[c.purpose_code]?.label,
        purposeText:             c.purpose_text,
        paymentContextCode:      c.payment_context_code,
        scaPolicy:               c.sca_policy,
        settlementRail:          'Bre-B',
        easpbv:                  c.easpbv_id,
        parties: {
          initiator:    { id: c.initiator_id, name: c.initiator_legal_name, domicile: c.initiator_domicile },
          debtorAgent:  { id: c.debtor_agent_id, account: c.debtor_account?.masked },
          creditor:     { id: c.creditor_id, name: c.creditor_name },
          creditorAgent:{ id: c.creditor_agent_id, account: c.creditor_account?.masked },
        },
      },
      linkingConsent: { handle: linking.handle, expiresAt: linking.expires_at },
      payment: {
        amount:   paymentAmount,
        currency: TRIP.currency,
        concept:  TRIP.concept,
        from:     `${bank.name} · ${bank.accountType} ${bank.account}`,
        to:       TELAR.merchantLegalName,
        rail:     'Bre-B',
        holder:   CUSTOMER.name,
      },
      bank,
      initiator: INITIATOR,
    });
  } catch (error) {
    if (error instanceof PaymentConsentError) {
      console.error('Mandato rechazado en creación:', error.code, error.message);
      return res.status(422).json({ ok: false, error: error.code, message: error.message, detail: error.detail });
    }
    console.error('Error creando el mandato de pago:', error);
    res.status(500).json({ ok: false, error: 'Error creando el mandato de pago', message: error.message });
  }
});

// POST /api/payment/authorize — SCA del débito, gates del mandato y creación del intent
//
// Orden estricto: se autoriza el mandato, se corre el gate contra sus límites y
// solo entonces se crea el intent. Ningún intent existe sin un mandato activo que
// lo cubra.
app.post('/api/payment/authorize', async (req, res) => {
  const {
    paymentConsentHandle,
    scaMethod = 'biometric_face_id',
    bankId,
    amount,
    customerId = CUSTOMER.id,
  } = req.body;

  if (!paymentConsentHandle) {
    return res.status(400).json({ ok: false, error: 'Falta paymentConsentHandle' });
  }

  const bank = findBank(bankId) || findBank('nu');
  const paymentAmount = amount || TRIP.amount;
  const paymentId = `PAY-${Date.now()}`;

  try {
    console.log('🔐 Autorizando pago contra el mandato:', paymentConsentHandle);

    // 1 · La entidad emisora deja constancia de la SCA sobre el mandato
    const activation = await activatePaymentConsent(paymentConsentHandle, { scaMethod, customerId });

    // 2 · Releer y correr el gate. Todo lo que compara es numérico o una igualdad
    //     de identificadores: rechaza sin interpretación humana.
    const record = await readConsentRecord(paymentConsentHandle);
    const custom = record.anchor.custom;

    const gate = assertPayable({
      custom,
      meta: record.meta,
      amount: paymentAmount,
      currency: TRIP.currency,
    });

    console.log('✅ Gate superado · consumo previo:', gate.consumption.transactions_executed);

    // 3 · Recién ahora se crea el intent
    const paymentIntent = await createPaymentIntent({
      consentId: custom.consent_id,
      customerId,
      bankId:    bank.id,
      amount:    paymentAmount,
      currency:  TRIP.currency,
      reference: `UBER_TRIP_${paymentId}`,
      debtor: {
        accountNumber:  bank.account.replace('*', ''),
        name:           CUSTOMER.name,
        documentNumber: CUSTOMER.document,
      },
      creditor: CREDITOR,
    });

    // 4 · Constancia del consumo en el propio mandato, para poder computarlo luego
    await recordIntentCommitted(paymentConsentHandle, {
      amount: paymentAmount,
      currency: TRIP.currency,
      intentHandle: paymentIntent.intent_handle,
    });

    res.json({
      ok: true,
      paymentId,
      status: 'PENDING',
      rail: 'Bre-B',
      message: `Pago de COP ${paymentAmount.toLocaleString('es-CO')} iniciado`,
      paymentConsent: {
        id:        custom.consent_id,
        handle:    record.anchor.handle,
        schema:    SCHEMA_HANDLES.payment,
        status:    'active',
        consentType: custom.consent_type,
        singleUse: custom.consent_type === 'SINGLE',
        grantedAt: activation.granted_at,
        scaPolicy: custom.sca_policy,
        scaMethod: activation.sca_method,
        scaPerformedBy: activation.sca_performed_by,
        authorizationArtifactHash: activation.authorization_artifact_hash,
        confirmationChannel: custom.confirmation_channel,
        validUntil: custom.valid_until,
      },
      consumption: {
        transactionsExecuted: gate.consumption.transactions_executed + 1,
        maxTransactionCount:  custom.max_transaction_count,
        amountConsumed:       gate.consumption.amount_consumed + paymentAmount,
        maxAmountTotal:       custom.max_amount_total.amount,
      },
      linkingConsent: { handle: custom.linking_consent_ref || null },
      intent: {
        handle:    paymentIntent.intent_handle,
        luid:      paymentIntent.intent_luid,
        status:    paymentIntent.status,
        amount:    paymentIntent.amount,
        currency:  paymentIntent.currency,
        reference: paymentIntent.reference,
      },
      initiator: INITIATOR,
    });
  } catch (error) {
    if (error instanceof PaymentConsentError) {
      console.error('❌ Gate del mandato rechazó el pago:', error.code, '·', error.message);
      return res.status(422).json({
        ok: false,
        error: error.code,
        message: error.message,
        detail: error.detail,
        intentCreated: false,
      });
    }
    console.error('Error en autorización de pago:', error);
    res.status(500).json({ ok: false, error: 'Error procesando pago', message: error.message });
  }
});


// GET /api/payment/:paymentId — estado del pago
app.get('/api/payment/:paymentId', (req, res) => {
  res.json({
    ok: true,
    paymentId: req.params.paymentId,
    status:    'EXECUTED',
    rail:      'Bre-B',
    amount:    TRIP.amount,
    currency:  TRIP.currency,
    to:        TELAR.merchantLegalName,
    concept:   TRIP.concept,
    initiator: INITIATOR,
  });
});

// ─── Consentimientos ──────────────────────────────────────────────────────────

// GET /api/consents — consentimientos del titular. type=data_access | payment | all
app.get('/api/consents', async (req, res) => {
  const customerId = req.query.customerId || CUSTOMER.id;
  const type = req.query.type || 'data_access';

  try {
    const consents = await listUserConsents(customerId, null, type === 'all' ? null : type);
    res.json({ ok: true, customerId, type, total: consents.length, consents });
  } catch (error) {
    console.error('Error listando consentimientos:', error);
    res.status(500).json({ ok: false, error: 'Error listando consentimientos', message: error.message });
  }
});

// GET /api/consent/:handle — estado de un consentimiento
app.get('/api/consent/:handle', async (req, res) => {
  const { handle } = req.params;

  try {
    const record = await readConsentRecord(handle);
    const consent = record.anchor;
    const derived = deriveConsentStatus(record.meta);

    res.json({
      ok: true,
      consent: {
        id:          consent.custom?.consent_id,
        handle:      consent.handle,
        type:        consent.custom?.consent_type || 'data_access',
        status:      derived.status,
        singleUse:   consent.custom?.single_use || false,
        tpp_id:      consent.custom?.tpp_id,
        tpp_legal_name: consent.custom?.tpp_legal_name,
        bank_id:     consent.custom?.data_provider_id?.replace('bridge_', ''),
        data_scope:  consent.custom?.data_scope,
        purpose:     consent.custom?.purpose,
        payment:     consent.custom?.payment || null,
        parent_consent_handle: consent.custom?.parent_consent_handle || null,
        expires_at:  consent.custom?.expires_at,
        granted_at:  derived.grantedAt,
        revoked_at:  derived.revokedAt,
        sca_method:  derived.scaMethod,
      },
    });
  } catch (error) {
    console.error('Error leyendo consentimiento:', error);
    res.status(404).json({ ok: false, error: 'Consentimiento no encontrado', message: error.message });
  }
});

// ─── Viaje ────────────────────────────────────────────────────────────────────

app.post('/api/trip/complete', (_req, res) => {
  res.json({
    ok: true,
    receipt: {
      origin:      TRIP.origin,
      destination: TRIP.destination,
      duration:    '31 min · 18.4 km',
      status:      'Liquidado vía Bre-B',
      initiatedBy: `${INITIATOR.name} · PISP`,
      driver:      { name: 'Carlos M.', vehicle: 'Toyota Prius · ABC-123', rating: 4.92 },
    },
  });
});

// ─── Arranque ─────────────────────────────────────────────────────────────────

// En serverless no se escucha un puerto: la plataforma invoca el handler. En local
// sí. Exportar la app permite que api/index.js la reutilice sin duplicar rutas.
const PORT = process.env.PORT || 3002;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Pay-by-bank API running on http://localhost:${PORT}`);
    console.log(`Iniciador: ${INITIATOR.name} · ${INITIATOR.sfcReg}`);
  });
}

export default app;
