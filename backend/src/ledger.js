import { LedgerSdk } from '@minka/ledger-sdk';
import { createHash } from 'crypto';

// Configuración del ledger
const LEDGER_URL = process.env.LEDGER_URL || 'https://open-finance-1.ldg-dev.one/api/v2';
const SIGNER_PUBLIC = process.env.SIGNER_PUBLIC || 'kao3VT0Hn+AE+f9iA3VnHzy/4k55242D5jBKwnxwFYQ=';
const SIGNER_SECRET = process.env.SIGNER_SECRET || 'keSFN3X+LszAem9NOfFE3/tTokEuFzwDYa/8vQpbL/A=';

// TPP ID para la aplicación
const TPP_ID = 'tpp_uber';
const TPP_LEGAL_NAME = 'Uber Colombia SAS, Calle 93 #14-15, Bogotá, Colombia';

// Funciones de utilidad
function generateTitularRef(titularId) {
  const hmac = createHash('sha256')
    .update(titularId)
    .digest('hex');
  return `hmac_sha256_${hmac}`;
}

function hashToken(token) {
  const hash = createHash('sha256')
    .update(token)
    .digest('hex');
  return `sha256_${hash}`;
}

/**
 * Crear un consentimiento en el ledger (anchor pending)
 * El consentimiento es por banco-TPP-titular, NO por viaje
 * Se puede reutilizar para múltiples pagos mientras esté activo
 */
export async function createConsent(params) {
  const {
    customerId,
    customerWallet,
    bankId,
  } = params;

  console.log('📝 Creando consentimiento en ledger...');
  console.log('   Customer:', customerId);
  console.log('   Bank:', bankId);
  console.log('   TPP:', TPP_ID);

  const sdk = new LedgerSdk({ server: LEDGER_URL });

  // Generar IDs - basado en banco-TPP-titular, no en viaje
  const consentId = `consent_${TPP_ID}_${bankId}_${customerId}_${Date.now()}`;
  const titularRef = generateTitularRef(customerId);

  // Consentimientos de larga duración (90 días típico para Open Finance)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  const transactionFrom = new Date();
  const transactionTo = new Date();
  transactionTo.setDate(transactionTo.getDate() + 90);

  try {
    const result = await sdk.anchor
      .init()
      .data({
        handle: consentId,
        schema: 'of-consent-v1',
        wallet: customerWallet,
        source: `bridge_${bankId}`,
        target: TPP_ID,
        custom: {
          // Campos obligatorios del consentimiento
          consent_id: consentId,
          tpp_id: TPP_ID,
          tpp_legal_name: TPP_LEGAL_NAME,
          data_provider_id: `bridge_${bankId}`,
          titular_ref: titularRef,

          // Scope para PISP (Payment Initiation)
          data_scope: [
            'category_1_payment_initiation',
            'category_2_accounts_read',
            'category_3_balances_read'
          ],

          // Purpose genérico - no específico de un viaje
          purpose: {
            code: 'PAYMENT_INITIATION',
            text: `Autorización de iniciación de pagos desde ${bankId} hacia ${TPP_ID}. Consentimiento de uso recurrente para múltiples transacciones.`
          },

          // Treatment (almacenamiento y retención - 90 días)
          treatment: {
            storage_permission: 'DURATION_BOUND',
            data_retention_days: 90,
            mode: 'STORE'
          },

          // Commercialization como objeto
          commercialization: {
            flag: false,
            compensation_offered: false
          },

          expires_at: expiresAt.toISOString(),
          transaction_from: transactionFrom.toISOString(),
          transaction_to: transactionTo.toISOString(),

          // Campos opcionales (null en pending, poblados en active)
          granted_at: null,
          sca_method: null,
          double_check_confirmed_at: null,
          access_token_hash: null,
          refresh_token_hash: null,
          token_expires_at: null,
          revoked_at: null,
          revoked_by: null,
          revocation_reason: null,
        },
      })
      .hash()
      .sign([
        {
          keyPair: {
            public: SIGNER_PUBLIC,
            secret: SIGNER_SECRET,
            format: 'ed25519-raw',
          },
          custom: {
            labels: [
              'consent',
              `tpp:${TPP_ID}`,
              `bank:${bankId}`,
              `titular:${customerId}`,
              'status:pending',
              'type:pisp'
            ],
            status: 'pending',
            event_type: 'consent_created',
            created_at: new Date().toISOString(),
          },
        },
      ])
      .send();

    console.log('✅ Consentimiento creado exitosamente');
    console.log('   LUID:', result.luid);
    console.log('   Handle:', result.anchor.handle);

    return {
      consent_id: consentId,
      consent_handle: result.anchor.handle,
      consent_luid: result.luid,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('❌ Error creando consentimiento:', error.message);
    if (error.response?.data) {
      console.error('   Detalles completos:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    console.error('   Full error:', JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * Activar un consentimiento (agregar proof con autenticación)
 * Se llama cuando el usuario completa la autenticación en el banco
 * Una vez activo, el consentimiento se puede usar para múltiples pagos
 */
export async function activateConsent(consentHandle, authData) {
  const {
    sca_method,
    customer_id
  } = authData;

  console.log('🔄 Activando consentimiento:', consentHandle);
  console.log('   SCA Method:', sca_method);
  console.log('   Customer:', customer_id);

  const sdk = new LedgerSdk({ server: LEDGER_URL });

  try {
    // 1. Leer anchor actual
    const currentRecord = await sdk.anchor.read(consentHandle);

    if (!currentRecord.anchor.custom) {
      throw new Error('Anchor no tiene datos custom');
    }

    // 2. Generar tokens (en producción, estos vienen del banco)
    const accessToken = `access_${consentHandle}_${Date.now()}`;
    const refreshToken = `refresh_${consentHandle}_${Date.now()}`;
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24); // Tokens válidos por 24h

    const now = new Date().toISOString();
    const scaMethodFormatted = sca_method === 'biometric_face_id' ? 'password+biometric' : 'password+otp';

    // 3. Agregar proof de activación (NO actualizar data, solo firmar)
    const result = await sdk.anchor
      .from({
        data: currentRecord.anchor,
        hash: currentRecord.hash,
        meta: currentRecord.meta,
        luid: currentRecord.luid
      })
      .sign([
        {
          keyPair: {
            public: SIGNER_PUBLIC,
            secret: SIGNER_SECRET,
            format: 'ed25519-raw',
          },
          custom: {
            status: 'active',
            event: 'double_check.confirmed',
            timestamp: now,
            granted_at: now,
            double_check_confirmed_at: now,
            sca_method: scaMethodFormatted,
            actor: currentRecord.anchor.custom.data_provider_id,
            tokens: [
              {
                type: 'access_token',
                hash: hashToken(accessToken),
                expires_at: tokenExpiresAt.toISOString()
              },
              {
                type: 'refresh_token',
                hash: hashToken(refreshToken),
                expires_at: tokenExpiresAt.toISOString()
              }
            ]
          },
        },
      ])
      .send();

    console.log('✅ Consentimiento activado!');
    console.log('   Handle:', result.anchor.handle);
    console.log('   Proof added with status: active');

    return {
      consent_id: result.anchor.custom?.consent_id,
      consent_handle: result.anchor.handle,
      status: 'active',
      granted_at: now,
      sca_method: scaMethodFormatted,
    };
  } catch (error) {
    console.error('❌ Error activando consentimiento:', error.message);
    if (error.response?.data) {
      console.error('   Detalles:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Leer un consentimiento del ledger
 * Retorna el record completo con anchor, meta y proofs
 */
export async function readConsent(consentHandle) {
  const sdk = new LedgerSdk({ server: LEDGER_URL });

  try {
    const record = await sdk.anchor.read(consentHandle);
    return record; // Retornar record completo, no solo anchor
  } catch (error) {
    console.error('❌ Error leyendo consentimiento:', error.message);
    throw error;
  }
}

/**
 * Crear un intent de pago (Pay by Bank)
 * El TPP crea la instrucción de pago que será enrutada por el ledger
 */
export async function createPaymentIntent(params) {
  const {
    consentId,
    customerId,
    bankId,
    amount,
    currency = 'COP',
    reference,
    debitAccount,
    creditAccount,
  } = params;

  console.log('💳 Creando intent de pago...');
  console.log('   Monto:', amount, currency);
  console.log('   Banco débito:', bankId);
  console.log('   Consent:', consentId);
  console.log('   Referencia:', reference);

  const sdk = new LedgerSdk({ server: LEDGER_URL });

  const intentHandle = `payment_${TPP_ID}_${Date.now()}`;

  // Source: Cuenta de Simón Rodríguez en el banco que debita
  const sourceAccount = debitAccount.accountNumber || '8834'; // Cuenta de Nu *8834
  const sourceWallet = `svgs:${sourceAccount}@${bankId}.com`;

  // Target: Cuenta de Uber en Bancolombia
  const targetAccount = creditAccount.accountNumber || '400211';
  const targetWallet = `svgs:${targetAccount}@bancolombia.com`;

  try {
    // Monto en centavos (multiplicar por 100)
    const amountInCents = amount * 100;

    const intentData = {
      handle: intentHandle,
      schema: 'pay-by-bank',
      access: [
        {
          action: 'any',
          signer: {
            public: SIGNER_PUBLIC,
          },
        },
      ],
      config: {
        commit: 'auto',
      },
      claims: [
        {
          action: 'transfer',
          symbol: {
            handle: currency.toLowerCase(),
          },
          source: {
            handle: sourceWallet,
            custom: {
              account_number: debitAccount.accountNumber || '8834',
              account_type: debitAccount.accountType || 'SAVINGS',
              holder_name: debitAccount.customerName || 'Simón Rodríguez',
              document_type: 'CC',
              document_number: debitAccount.documentNumber || '1234567890',
            },
          },
          target: {
            handle: targetWallet,
            custom: {
              account_number: creditAccount.accountNumber || '123456789',
              account_type: creditAccount.accountType || 'CHECKING',
              holder_name: 'Uber Colombia SAS',
              document_type: 'NIT',
              document_number: '900460990',
            },
          },
          amount: amountInCents,
        },
      ],
      custom: {
        payment_reference: reference,
        payment_description: 'Pago de viaje Uber',
        tpp_id: TPP_ID,
        consent_handle: consentId,
        initiated_at: new Date().toISOString(),
        payment_method: 'open_finance_pisp',
      },
    };

    console.log('📄 Estructura del intent:');
    console.log(JSON.stringify(intentData, null, 2));

    const result = await sdk.intent
      .init()
      .data(intentData)
      .hash()
      .sign([
        {
          keyPair: {
            public: SIGNER_PUBLIC,
            secret: SIGNER_SECRET,
            format: 'ed25519-raw',
          },
        },
      ])
      .send();

    console.log('✅ Intent de pago creado exitosamente!');
    console.log('   Handle:', intentHandle);
    console.log('   LUID:', result.luid);
    console.log('   Hash:', result.hash);

    return {
      intent_handle: result.intent?.handle || intentHandle,
      intent_luid: result.luid,
      status: result.meta?.status || 'pending',
      amount: amount,
      currency: currency,
      reference: reference,
    };
  } catch (error) {
    console.error('❌ Error creando intent de pago:', error.message);
    if (error.response?.data) {
      console.error('   Detalles:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    throw error;
  }
}

/**
 * Listar consentimientos activos para un banco específico y el TPP actual
 * Filtra por: banco (source) + TPP (target) + schema
 */
export async function listUserConsents(customerId, bankId = null) {
  try {
    console.log('🔍 Buscando consentimientos:');
    console.log('   TPP:', TPP_ID);
    if (bankId) {
      console.log('   Banco:', bankId);
    }

    // Nota: SDK list() NO retorna meta, por eso usamos HTTP fetch
    // que sí retorna el record completo con meta/proofs
    const params = new URLSearchParams({
      'filter[anchor.schema]': 'of-consent-v1',
      'limit': '100',
    });

    const url = `${LEDGER_URL}/anchors?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const allRecords = data.data || [];

    // Filtrar client-side por banco (source) Y TPP (target)
    // (el ledger no soporta filtros AND complejos)
    const records = allRecords.filter(record => {
      const anchor = record.data || record.anchor || record;
      const matchesTarget = anchor.target === TPP_ID;
      const matchesBank = !bankId || anchor.source === `bridge_${bankId}`;
      return matchesTarget && matchesBank;
    });

    console.log(`   Encontrados: ${records.length} consentimientos`);

    // Procesar cada consentimiento
    const consents = records.map(record => {
      const anchor = record.data || record.anchor || record;
      const meta = record.meta;

      if (!anchor || !anchor.custom) {
        console.warn('   ⚠️  Anchor sin estructura válida');
        return null;
      }

      // Buscar proof de activación
      const activeProof = meta?.proofs?.find(p => p.custom?.status === 'active');
      const grantedAt = activeProof?.custom?.granted_at;
      const scaMethod = activeProof?.custom?.sca_method;
      const status = meta?.status || (grantedAt ? 'active' : 'pending');

      return {
        consent_id: anchor.custom.consent_id,
        handle: anchor.handle,
        wallet: anchor.wallet,
        status: status,
        tpp_id: anchor.custom.tpp_id,
        tpp_legal_name: anchor.custom.tpp_legal_name,
        data_provider_id: anchor.custom.data_provider_id,
        bank_id: anchor.custom.data_provider_id?.replace('bridge_', ''),
        titular_ref: anchor.custom.titular_ref,
        granted_at: grantedAt,
        sca_method: scaMethod,
        expires_at: anchor.custom.expires_at,
        transaction_from: anchor.custom.transaction_from,
        transaction_to: anchor.custom.transaction_to,
        created_at: anchor.custom.transaction_from || anchor.custom.expires_at,
      };
    }).filter(c => c !== null);

    // Filtrar solo consentimientos activos (meta.status === 'active') y no expirados
    const activeConsents = consents.filter(c => {
      const isActive = c.status === 'active';
      const isNotExpired = !c.expires_at || new Date(c.expires_at) > new Date();

      if (!isActive) {
        console.log(`   🔴 Filtrado ${c.handle}: status=${c.status}`);
      } else if (!isNotExpired) {
        console.log(`   🔴 Filtrado ${c.handle}: expiró el ${c.expires_at}`);
      } else {
        console.log(`   ✅ Activo ${c.handle}: bank=${c.bank_id}, granted=${c.granted_at}`);
      }

      return isActive && isNotExpired;
    });

    console.log(`   Activos y vigentes: ${activeConsents.length}`);

    return activeConsents;
  } catch (error) {
    console.error('❌ Error listando consentimientos:', error.message);
    return [];
  }
}
