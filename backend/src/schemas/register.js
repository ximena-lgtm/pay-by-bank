/**
 * Registra en el ledger los esquemas de anchor de este proyecto.
 *
 * Son exactamente dos: el consentimiento de acceso a datos y el mandato de pago.
 *
 * Idempotente: si el esquema ya existe, no lo toca. Se ejecuta a mano
 * (`npm run schema:register`), no al arrancar el servidor: registrar un esquema es
 * una escritura de infraestructura, no parte del ciclo de vida de la aplicación.
 *
 * IMPORTANTE · registrar es irreversible. Los esquemas del ledger no se
 * sobrescriben por handle (`Schema with handle X already exists`) y no se borran:
 * el cliente de schema del SDK no expone `drop` y `DELETE /schemas/:handle`
 * responde 404. Por eso este script valida el contenido en local contra payloads
 * reales antes de escribir — ver `src/consents.js`, que compila los mismos
 * archivos con ajv al importarse. Nunca registrar variantes para experimentar.
 */
import { LedgerSdk } from '@minka/ledger-sdk';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));

const LEDGER_URL = process.env.LEDGER_URL || 'https://open-finance2.ldg-dev.one/api/v2';
const SIGNER_PUBLIC = process.env.SIGNER_PUBLIC;
const SIGNER_SECRET = process.env.SIGNER_SECRET;

if (!SIGNER_PUBLIC || !SIGNER_SECRET) {
  console.error('Faltan SIGNER_PUBLIC y SIGNER_SECRET en el entorno.');
  process.exit(1);
}

const SCHEMAS = [
  { handle: 'data-consent',    file: 'data-consent.json',    record: 'anchor' },
  { handle: 'payment-consent', file: 'payment-consent.json', record: 'anchor' },
];

async function exists(sdk, handle) {
  try {
    const res = await sdk.schema.read(handle);
    return Boolean(res?.schema);
  } catch (error) {
    // 403 significa que existe pero no es legible; 404, que no existe
    const reason = error.response?.data?.data?.reason || error.reason;
    return reason === 'auth.forbidden';
  }
}

async function registerSchema({ handle, file, record }) {
  const content = JSON.parse(readFileSync(join(HERE, file), 'utf8'));
  const sdk = new LedgerSdk({ server: LEDGER_URL });

  if (await exists(sdk, handle)) {
    console.log(`♻️  ${handle} ya existe, no se toca`);
    return { handle, created: false };
  }

  try {
    const result = await sdk.schema
      .init()
      .data({ handle, format: 'json-schema', record, schema: content })
      .hash()
      .sign([
        {
          keyPair: { public: SIGNER_PUBLIC, secret: SIGNER_SECRET, format: 'ed25519-raw' },
          custom: { labels: ['schema', `record:${record}`], created_at: new Date().toISOString() },
        },
      ])
      .send();

    console.log(`✅ ${handle} registrado · luid ${result.luid}`);
    return { handle, created: true };
  } catch (error) {
    const detail = error.response?.data?.detail || error.detail || error.message;
    console.error(`❌ ${handle}: ${detail}`);
    return { handle, created: false, error: detail };
  }
}

console.log(`Ledger: ${LEDGER_URL}\n`);

const results = [];
for (const schema of SCHEMAS) {
  results.push(await registerSchema(schema));
}

if (results.some(r => r.error)) process.exitCode = 1;
