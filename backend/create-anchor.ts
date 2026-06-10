#!/usr/bin/env ts-node
/**
 * Script para crear un anchor de consentimiento Open Finance
 *
 * Uso:
 *   ts-node scripts/create-consent-anchor.ts
 *
 * Variables de entorno requeridas:
 *   LEDGER_URL - URL del ledger (ej: https://ldg-dev.one/api/v2)
 *   SIGNER_PUBLIC - Public key del signer
 *   SIGNER_SECRET - Secret key del signer
 */

import { LedgerSdk } from '@minka/ledger-sdk'
import { createHash } from 'crypto'

// Configuración
const LEDGER_URL = 'https://open-finance-1.ldg-dev.one/api/v2'
const SIGNER_PUBLIC = 'kao3VT0Hn+AE+f9iA3VnHzy/4k55242D5jBKwnxwFYQ='
const SIGNER_SECRET = 'keSFN3X+LszAem9NOfFE3/tTokEuFzwDYa/8vQpbL/A='
if (!SIGNER_PUBLIC || !SIGNER_SECRET) {
  console.error('Error: SIGNER_PUBLIC y SIGNER_SECRET son requeridos')
  console.error('Uso: SIGNER_PUBLIC=<key> SIGNER_SECRET=<secret> ts-node scripts/create-consent-anchor.ts')
  process.exit(1)
}

// Función para generar HMAC-SHA256
function generateTitularRef(titularId: string): string {
  const hmac = createHash('sha256')
    .update(titularId)
    .digest('hex')
  return `hmac_sha256_${hmac}`
}

// Función para generar hash de token
function hashToken(token: string): string {
  const hash = createHash('sha256')
    .update(token)
    .digest('hex')
  return `sha256_${hash}`
}

// Datos del consentimiento de ejemplo
const consentData = {
  // IDs
  consent_id: 'consent_' + Date.now(),
  tpp_id: 'tpp_crediviva',
  data_provider_id: 'bridge_bancolombia',

  // Titular (customer)
  titular_id: 'customer_001',
  titular_wallet: 'wallet_customer_001',

  // Datos del TPP
  tpp_legal_name: 'CrediViva S.A.S., Calle 72 #10-51, Bogotá, Colombia',

  // Scope y propósito
  data_scope: [
    'category_1_accounts',
    'category_1_transactions_12m',
    'category_2_kyc'
  ],
  purpose: 'Credit risk assessment for personal loan underwriting. Data will be used to evaluate creditworthiness and determine loan terms.',

  // Duración
  duration_days: 90,

  // Flags
  commercialization_flag: false,
  compensation_flag: false,
}

async function createConsentAnchor() {
  console.log('🔗 Conectando al ledger:', LEDGER_URL)

  const sdk = new LedgerSdk({
    server: LEDGER_URL,
  })

  // Calcular fecha de expiración
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + consentData.duration_days)

  // Generar titular reference (pseudonymized)
  const titularRef = generateTitularRef(consentData.titular_id)

  console.log('\n📝 Creando anchor de consentimiento...')
  console.log('   Consent ID:', consentData.consent_id)
  console.log('   TPP:', consentData.tpp_id)
  console.log('   Data Provider:', consentData.data_provider_id)
  console.log('   Titular Wallet:', consentData.titular_wallet)
  console.log('   Expira:', expiresAt.toISOString())

  try {
    const result = await sdk.anchor
      .init()
      .data({
        handle: consentData.consent_id,
        schema: 'consent-1',  // ← Actualizado a consent-1
        wallet: consentData.titular_wallet,
        target: consentData.tpp_id,
        symbol: 'DATA',
        custom: {
          // 16 campos obligatorios
          consent_id: consentData.consent_id,
          tpp_id: consentData.tpp_id,
          tpp_legal_name: consentData.tpp_legal_name,
          data_provider_id: consentData.data_provider_id,
          data_provider_source: consentData.data_provider_id, // Guardado en custom
          titular_ref: titularRef,
          data_scope: consentData.data_scope,
          purpose: consentData.purpose,
          duration_days: consentData.duration_days,
          commercialization_flag: consentData.commercialization_flag,
          compensation_flag: consentData.compensation_flag,
          expires_at: expiresAt.toISOString(),

          // Campos opcionales (null en pending)
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
      } as any)
      .hash()
      .sign([
        {
          keyPair: {
            public: SIGNER_PUBLIC,
            secret: SIGNER_SECRET,
            format: 'ed25519-raw' as const,
          },
          custom: {
            labels: [
              'consent',
              `tpp:${consentData.tpp_id}`,
              `bank:${consentData.data_provider_id}`,
              'status:pending',
            ],
            status: 'pending',
          },
        },
      ])
      .send()

    console.log('\n✅ Anchor creado exitosamente!')
    console.log('\n📊 Resultado:')
    console.log('   LUID:', result.luid)
    console.log('   Hash:', result.hash)
    console.log('   Handle:', result.anchor.handle)
    console.log('   Schema:', result.anchor.schema)
    console.log('   Wallet:', result.anchor.wallet)
    console.log('   Target:', result.anchor.target)

    if (result.anchor.custom) {
      console.log('\n📋 Campos custom:')
      console.log('   Consent ID:', result.anchor.custom.consent_id)
      console.log('   TPP:', result.anchor.custom.tpp_id)
      console.log('   Data Scope:', result.anchor.custom.data_scope?.join(', '))
      console.log('   Purpose:', result.anchor.custom.purpose?.substring(0, 60) + '...')
      console.log('   Duration:', result.anchor.custom.duration_days, 'days')
      console.log('   Expires:', result.anchor.custom.expires_at)
    }

    console.log('\n🔍 Para ver el anchor:')
    console.log(`   minka anchor show ${result.anchor.handle}`)

    return result
  } catch (error: any) {
    console.error('\n❌ Error creando anchor:', error.message)
    if (error.response?.data) {
      console.error('   Detalles:', JSON.stringify(error.response.data, null, 2))
    }
    throw error
  }
}

// Función para activar el consentimiento
async function activateConsent(consentHandle: string) {
  const sdk = new LedgerSdk({
    server: LEDGER_URL,
  })

  console.log('\n🔄 Activando consentimiento:', consentHandle)

  try {
    // 1. Leer anchor actual
    const currentRecord = await sdk.anchor.read(consentHandle)

    if (!currentRecord.anchor.custom) {
      throw new Error('Anchor no tiene datos custom')
    }

    // 2. Simular tokens (en producción, estos vienen del banco)
    const accessToken = 'access_token_' + Date.now()
    const refreshToken = 'refresh_token_' + Date.now()
    const tokenExpiresAt = new Date()
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 1)

    const now = new Date().toISOString()

    // 3. Actualizar anchor a status active
    const result = await sdk.anchor
      .from(currentRecord)
      .data({
        handle: currentRecord.anchor.handle,
        schema: currentRecord.anchor.schema,
        wallet: currentRecord.anchor.wallet,
        target: currentRecord.anchor.target,
        symbol: currentRecord.anchor.symbol,
        custom: {
          ...currentRecord.anchor.custom,
          granted_at: now,
          sca_method: 'biometric_face_id',
          double_check_confirmed_at: now,
          access_token_hash: hashToken(accessToken),
          refresh_token_hash: hashToken(refreshToken),
          token_expires_at: tokenExpiresAt.toISOString(),
        },
      } as any)
      .hash()
      .sign([
        {
          keyPair: {
            public: SIGNER_PUBLIC,
            secret: SIGNER_SECRET,
            format: 'ed25519-raw' as const,
          },
          custom: {
            labels: [
              'consent',
              `tpp:${currentRecord.anchor.target}`,
              `bank:${currentRecord.anchor.custom.data_provider_id}`,
              'status:active',
            ],
            status: 'active',
          },
        },
      ])
      .send()

    console.log('\n✅ Consentimiento activado!')
    console.log('   Handle:', result.anchor.handle)
    if (result.anchor.custom) {
      console.log('   Granted at:', result.anchor.custom.granted_at)
      console.log('   SCA Method:', result.anchor.custom.sca_method)
    }

    return result
  } catch (error: any) {
    console.error('\n❌ Error activando consentimiento:', error.message)
    if (error.response?.data) {
      console.error('   Detalles:', JSON.stringify(error.response.data, null, 2))
    }
    throw error
  }
}

// Ejecutar
async function main() {
  try {
    // Crear anchor
    const result = await createConsentAnchor()

    console.log('\n❓ ¿Activar el consentimiento?')
    console.log('   Presiona Ctrl+C para salir o espera 5 segundos...')

    await new Promise(resolve => setTimeout(resolve, 5000))

    // Activar
    await activateConsent(result.anchor.handle)

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

// Solo ejecutar si es el script principal
if (require.main === module) {
  main()
}

export { createConsentAnchor, activateConsent }
