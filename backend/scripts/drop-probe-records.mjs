/**
 * Borra los anchors de sondeo creados al descubrir las restricciones del ledger.
 *
 * Simula por defecto; borra de verdad solo con --apply. Solo toca handles con
 * prefijo de prueba (consent_probe_, zz_, probe_), nunca datos del demo.
 *
 * Dos cosas que este script documenta y cuestan tiempo descubrir:
 *
 *  - La cadena correcta es drop(handle).hash().sign([...]).send(). Sin .hash() el
 *    cuerpo va con los datos completos del anchor en vez del registro de borrado
 *    {parent: hash}, y el ledger responde record.schema-invalid.
 *
 *  - Solo se pueden borrar los records que se pueden LEER, y las lecturas de este
 *    ledger exigen bearer token: drop() lee antes de borrar, así que sin el JWT
 *    falla con auth.forbidden. Ver sdk() en src/ledger.js.
 *
 * Los SCHEMAS no se pueden borrar de ninguna forma: el cliente de schema del SDK
 * expone init, from, read y list, sin drop, y DELETE /schemas/:handle responde 404.
 * Son permanentes — registrar uno es irreversible.
 */
import { LedgerSdk } from '@minka/ledger-sdk';

const LEDGER = process.env.LEDGER_URL || 'https://open-finance2.ldg-dev.one/api/v2';
const PUB = process.env.SIGNER_PUBLIC;
const SEC = process.env.SIGNER_SECRET;
const keyPair = { public: PUB, secret: SEC, format: 'ed25519-raw' };

/** Las lecturas y los borrados de este ledger exigen bearer token. */
const sdk = () => new LedgerSdk({
  server: LEDGER,
  secure: {
    iss: 'tpp_telar', sub: PUB, aud: process.env.LEDGER_AUDIENCE || 'open-finance2',
    exp: Math.floor(Date.now() / 1000) + 300, keyPair, kid: PUB,
  },
});

// Prefijos que SOLO existen por los sondeos
const JUNK = [/^consent_probe_/, /^zz_/, /^probe_/];
const isJunk = h => JUNK.some(re => re.test(h || ''));

const dryRun = !process.argv.includes('--apply');

async function listAnchors() {
  const res = await sdk().anchor.list({ limit: 100 });
  return (res.anchors || []).filter(a => isJunk(a.handle)).map(a => ({ handle: a.handle }));
}

const junk = await listAnchors();
console.log(`${junk.length} anchors de sondeo en la página más reciente`);

if (dryRun) {
  junk.forEach(j => console.log('  ·', j.handle));
  console.log('\nSimulación. Volver a correr con --apply para borrarlos.');
  process.exit(0);
}

let dropped = 0, failed = 0;
for (const j of junk) {
  try {
    await sdk().anchor.drop(j.handle).hash().sign([{ keyPair }]).send();
    console.log('  ✅', j.handle);
    dropped++;
  } catch (e) {
    const d = e.response?.data || e;
    console.log('  ❌', j.handle, '·', d?.reason || e.message);
    failed++;
  }
}
console.log(`\nborrados: ${dropped} · fallidos: ${failed}`);
