/**
 * Punto de entrada para el despliegue serverless.
 *
 * No define rutas: reexporta la misma app que corre en local. Antes había aquí una
 * copia de las rutas que se quedó atrás y habría roto el deploy — importaba
 * exports del ledger que ya no existen.
 *
 * El despliegue necesita LEDGER_URL, SIGNER_PUBLIC y SIGNER_SECRET como variables
 * de entorno: la capa de ledger falla al arrancar si faltan, a propósito.
 */
export { default } from './src/index.js';
