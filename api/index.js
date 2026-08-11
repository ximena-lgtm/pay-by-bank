import app from '../backend/api.js';

/**
 * Entrada serverless de la API.
 *
 * Vercel enruta todo /api/* aquí mediante el rewrite de vercel.json, que fija el
 * resto de la ruta en el parámetro __p. Este handler la reconstruye antes de
 * delegar en Express.
 *
 * Por qué así y no con un nombre de archivo dinámico: probamos `api/[[...path]].js`
 * y `api/[...path].js`, y en ambos casos Vercel solo enrutó rutas de UN segmento —
 * /api/banks llegaba, /api/consent/link/initiate respondía 404 NOT_FOUND sin tocar
 * la función. Reconstruir la ruta desde un parámetro explícito no depende de cómo
 * Vercel interprete los corchetes ni de si el rewrite preserva la ruta original.
 */
export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.searchParams.get('__p');

  if (path !== null) {
    url.searchParams.delete('__p');
    const query = url.searchParams.toString();
    req.url = `/api/${path}${query ? `?${query}` : ''}`;
  }

  return app(req, res);
}
