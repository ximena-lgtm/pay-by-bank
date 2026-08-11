/**
 * Entrada serverless de la API.
 *
 * Es un catch-all a propósito. Antes había un `api/index.js` con un rewrite que
 * mandaba /api/(.*) a /api/index: eso cambia la ruta que ve Express, que solo
 * conoce /api/banks, /api/accounts, etc., así que toda petición respondía 404 y el
 * frontend mostraba listas vacías. Con un catch-all la ruta original llega intacta.
 *
 * El nombre lleva corchetes SIMPLES. `[[...path]]` es sintaxis de Next.js; en las
 * funciones serverless de Vercel se interpreta como un único segmento dinámico
 * llamado literalmente "[...path]", así que /api/banks llegaba a la función y
 * /api/consent/link/initiate respondía 404 sin llegar nunca.
 *
 * El despliegue necesita LEDGER_URL, SIGNER_PUBLIC y SIGNER_SECRET configuradas en
 * la plataforma. El `.env` del repo no se lee en runtime, y la capa de ledger falla
 * al importarse si faltan — a propósito, para no operar contra un ledger equivocado.
 */
export { default } from '../backend/api.js';
