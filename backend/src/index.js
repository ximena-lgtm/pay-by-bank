import express from 'express';
import cors from 'cors';
import { createConsent, activateConsent, readConsent, listUserConsents, createPaymentIntent } from './ledger.js';

const app = express();
app.use(cors());
app.use(express.json());

// ─── Mock data ────────────────────────────────────────────────────────────────

const BANKS = [
  { id: 'nu',           name: 'Nu',              type: 'Fintech', color: '#8A05BE', linked: true,  account: '*8834' },
  { id: 'falabella',    name: 'Banco Falabella', type: 'Banco',   color: '#00A650', linked: true,  account: '*2156' },
  { id: 'bancolombia', name: 'Bancolombia',      type: 'Banco',   color: '#FFD100' },
  { id: 'daviplata',   name: 'Daviplata',        type: 'Fintech', color: '#BE1622' },
  { id: 'bogota',      name: 'Banco de Bogotá',  type: 'Banco',   color: '#003DA5' },
  { id: 'nequi',       name: 'Nequi',            type: 'Fintech', color: '#7B2FF7' },
  { id: 'davivienda',  name: 'Davivienda',       type: 'Banco',   color: '#BE1622' },
  { id: 'bbva',        name: 'BBVA Colombia',    type: 'Banco',   color: '#004A99' },
];

const TRIP = {
  origin:      'El Dorado · Terminal T1',
  destination: 'Zona Rosa · Calle 85',
  amount:      18500,
  currency:    'COP',
  type:        'UberX',
  concept:     'Viaje UberX · El Dorado → Zona Rosa',
  merchant:    'Uber Colombia SAS · NIT 900.xxx',
  eta:         4,
  duration:    32,
};

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/trip — trip details
app.get('/api/trip', (_req, res) => {
  res.json({ ok: true, trip: TRIP });
});

// GET /api/banks — SFC directory of PISP-enabled banks with consent status
app.get('/api/banks', async (req, res) => {
  const customerId = req.query.customerId || 'customer_001';

  try {
    // Obtener consentimientos activos del usuario
    const activeConsents = await listUserConsents(customerId);

    // Marcar bancos que tienen consentimiento activo
    const banksWithStatus = BANKS.map(bank => {
      const hasConsent = activeConsents.some(c => c.bank_id === bank.id);
      return {
        ...bank,
        hasActiveConsent: hasConsent,
        linked: hasConsent, // Actualizar linked basado en consentimiento real
      };
    });

    res.json({
      ok: true,
      total: BANKS.length,
      linked: banksWithStatus.filter(b => b.hasActiveConsent).length,
      source: 'Directorio SFC',
      banks: banksWithStatus,
      activeConsents: activeConsents,
    });
  } catch (error) {
    console.error('Error obteniendo bancos:', error);
    res.json({
      ok: true,
      total: BANKS.length,
      source: 'Directorio SFC',
      banks: BANKS,
    });
  }
});

// POST /api/payment/initiate — Crear consentimiento en ledger o reusar existente
// Se llama cuando el usuario selecciona un banco
// El consentimiento es por banco-TPP-titular, NO por viaje
app.post('/api/payment/initiate', async (req, res) => {
  const { bankId } = req.body;
  const bank = BANKS.find(b => b.id === bankId);
  if (!bank) return res.status(404).json({ ok: false, error: 'Bank not found' });

  try {
    // Simular customer ID (en producción vendría del usuario autenticado)
    const customerId = 'customer_001';
    const customerWallet = 'wallet_customer_001';

    // Verificar si existe un consentimiento activo para este banco
    const activeConsents = await listUserConsents(customerId);
    const existingConsent = activeConsents.find(c => c.bank_id === bankId);

    let consent;
    let consentCreated = false;

    if (existingConsent) {
      // Reusar consentimiento existente
      console.log('♻️ Reusando consentimiento existente:', existingConsent.handle);
      console.log('   Válido hasta:', existingConsent.expires_at);
      consent = {
        consent_id: existingConsent.consent_id,
        consent_handle: existingConsent.handle,
        consent_luid: existingConsent.handle,
        status: 'active',
        expires_at: existingConsent.expires_at,
      };
    } else {
      // Crear nuevo consentimiento en el ledger
      console.log('🆕 Creando nuevo consentimiento para:', bankId);
      console.log('   Duración: 90 días');
      consent = await createConsent({
        customerId: customerId,
        customerWallet: customerWallet,
        bankId: bankId,
      });
      consentCreated = true;
      console.log('💾 Consentimiento guardado:', consent.consent_id);
    }

    // Retornar instrumento de pago con el consent_id
    res.json({
      ok: true,
      instrument: {
        consentToken: consent.consent_id,
        consentHandle: consent.consent_handle,
        from:     `${bank.name} · Cta ${bank.account || '*****'} · Simón`,
        to:       TRIP.merchant,
        amount:   TRIP.amount,
        currency: TRIP.currency,
        concept:  TRIP.concept,
        expiresIn: '5 minutos',
        expiresAt: consent.expires_at,
        sfcRef:   'Uber · Reg. SFC #PISP-2024-042 · Consentimiento de uso único',
        ledgerLuid: consent.consent_luid,
      },
      redirectUrl: `/auth?token=${consent.consent_id}&bank=${bankId}`,
      consent: {
        id: consent.consent_id,
        handle: consent.consent_handle,
        status: consent.status,
        reused: !consentCreated,
      },
      bank: {
        id: bank.id,
        name: bank.name,
        color: bank.color,
      }
    });
  } catch (error) {
    console.error('Error creando consentimiento:', error);
    res.status(500).json({
      ok: false,
      error: 'Error creando consentimiento en ledger',
      message: error.message
    });
  }
});

// POST /api/payment/authorize — Verificar consentimiento activo y crear intent de pago
// Se llama cuando el usuario autoriza el pago con SCA
// IMPORTANTE: El consentimiento debe estar activo antes de llamar este endpoint
app.post('/api/payment/authorize', async (req, res) => {
  const { consentToken, method, consentHandle, bankId, amount } = req.body;
  if (!consentToken) return res.status(400).json({ ok: false, error: 'Missing consentToken' });

  try {
    const paymentId = `PAY-${Date.now()}`;
    const customerId = 'customer_001'; // En producción vendría del token
    const paymentAmount = amount || TRIP.amount;

    // Determinar el handle del consentimiento
    const handle = consentHandle || consentToken;

    console.log('🔐 Autorizando pago...');
    console.log('   Consent:', handle);
    console.log('   Method:', method);
    console.log('   Banco:', bankId);
    console.log('   Monto:', paymentAmount);

    // Leer el consentimiento del ledger
    const consentRecord = await readConsent(handle);
    const consent = consentRecord.anchor;
    const meta = consentRecord.meta;

    // Determinar el status del consentimiento
    const activeProof = meta?.proofs?.find(p => p.custom?.status === 'active');
    const status = meta?.status || (activeProof ? 'active' : 'pending');

    // VALIDAR: El consentimiento debe estar activo
    if (status !== 'active') {
      console.log('❌ Consentimiento no está activo:', status);
      return res.status(400).json({
        ok: false,
        error: 'Consentimiento no activo',
        message: `El consentimiento debe estar activo para iniciar un pago. Status actual: ${status}`,
        consentStatus: status,
      });
    }

    console.log('✅ Consentimiento activo verificado');

    // Crear intent de pago en el ledger
    console.log('💳 Creando intent de pago en ledger...');
    const paymentIntent = await createPaymentIntent({
      consentId: consent.custom?.consent_id || handle,
      customerId: customerId,
      bankId: bankId || 'nu',
      amount: paymentAmount,
      currency: 'COP',
      reference: `UBER_TRIP_${paymentId}`,
      debitAccount: {
        accountNumber: '8834', // Cuenta de Nu de Simón
        accountType: 'SAVINGS',
        customerName: 'Simón Rodríguez',
        documentNumber: '1234567890',
      },
      creditAccount: {
        bankCode: 'BANCOLOMBIA_CO',
        accountNumber: '400211', // Cuenta de Uber en Bancolombia
        accountType: 'CHECKING',
      },
    });

    console.log('✅ Intent de pago creado:', paymentIntent.intent_handle);

    // Simular delay de procesamiento (el bridge procesaría esto)
    await new Promise(resolve => setTimeout(resolve, 1500));

    res.json({
      ok: true,
      paymentId: paymentId,
      status: 'PENDING', // Intent creado, esperando procesamiento
      rail: 'Bre-B',
      message: `Pago de COP ${paymentAmount.toLocaleString('es-CO')} iniciado`,
      consent: {
        id: consent.custom?.consent_id,
        handle: consent.handle,
        status: status,
        granted_at: activeProof?.custom?.granted_at,
        sca_method: activeProof?.custom?.sca_method,
      },
      intent: {
        handle: paymentIntent.intent_handle,
        luid: paymentIntent.intent_luid,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        reference: paymentIntent.reference,
      },
      ledger: {
        consent_verified: true,
        consent_handle: consent.handle,
        intent_created: true,
        intent_handle: paymentIntent.intent_handle,
      }
    });
  } catch (error) {
    console.error('Error en autorización de pago:', error);
    res.status(500).json({
      ok: false,
      error: 'Error procesando pago',
      message: error.message
    });
  }
});

// GET /api/payment/:paymentId — Ledger: get payment status
app.get('/api/payment/:paymentId', (req, res) => {
  res.json({
    ok: true,
    paymentId: req.params.paymentId,
    status:    'EXECUTED',
    rail:      'Bre-B',
    amount:    TRIP.amount,
    currency:  TRIP.currency,
    from:      'Nu *8834',
    to:        TRIP.merchant,
    concept:   TRIP.concept,
  });
});

// GET /api/consents — Listar consentimientos activos del usuario
app.get('/api/consents', async (req, res) => {
  const customerId = req.query.customerId || 'customer_001';

  try {
    const activeConsents = await listUserConsents(customerId);

    res.json({
      ok: true,
      customerId: customerId,
      total: activeConsents.length,
      consents: activeConsents,
    });
  } catch (error) {
    console.error('Error listando consentimientos:', error);
    res.status(500).json({
      ok: false,
      error: 'Error listando consentimientos',
      message: error.message
    });
  }
});

// GET /api/consent/:handle — Consultar estado de un consentimiento
app.get('/api/consent/:handle', async (req, res) => {
  const { handle } = req.params;

  try {
    const consentRecord = await readConsent(handle);
    const consent = consentRecord.anchor;
    const meta = consentRecord.meta;

    // Buscar el último proof con información de activación
    let grantedAt = null;
    let scaMethod = null;
    const activeProof = meta?.proofs?.find(p => p.custom?.status === 'active');
    if (activeProof) {
      grantedAt = activeProof.custom?.granted_at;
      scaMethod = activeProof.custom?.sca_method;
    }

    // Status computed from meta or from proofs
    const status = meta?.status || (grantedAt ? 'active' : 'pending');

    res.json({
      ok: true,
      consent: {
        id: consent.custom?.consent_id,
        handle: consent.handle,
        status: status,
        tpp_id: consent.custom?.tpp_id,
        bank_id: consent.custom?.data_provider_id,
        trip_id: consent.custom?.trip_id,
        amount: consent.custom?.trip_amount,
        currency: consent.custom?.trip_currency,
        created_at: consent.custom?.expires_at ? new Date(new Date(consent.custom.expires_at).getTime() - 5*60*1000).toISOString() : null,
        expires_at: consent.custom?.expires_at,
        granted_at: grantedAt,
        sca_method: scaMethod,
      }
    });
  } catch (error) {
    console.error('Error leyendo consentimiento:', error);
    res.status(404).json({
      ok: false,
      error: 'Consentimiento no encontrado',
      message: error.message
    });
  }
});

// POST /api/trip/complete — mark trip done, return receipt
app.post('/api/trip/complete', (_req, res) => {
  res.json({
    ok: true,
    receipt: {
      origin:   TRIP.origin,
      destination: TRIP.destination,
      duration: '31 min · 18.4 km',
      payment:  `COP ${TRIP.amount.toLocaleString('es-CO')} · Nu *8834`,
      status:   'Liquidado vía Bre-B',
      driver:   { name: 'Carlos M.', vehicle: 'Toyota Prius · ABC-123', rating: 4.92 },
    },
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = 3002;
app.listen(PORT, () => console.log(`Pay-by-bank API running on http://localhost:${PORT}`));
