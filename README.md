# Pay by Bank · Uber + Telar

Demo interactivo de **Pay by Bank** bajo el framework de Open Finance Colombia (Decreto 368/2026), con un iniciador de pagos embebido al estilo del patrón *Embedded Institution Search*.

## Los tres actores

| Actor | Quién es | Superficie |
|-------|----------|------------|
| **Uber** | Comercio beneficiario | Blanco, acciones en negro |
| **Telar** | Iniciador de pagos (PISP) vigilado por la SFC | Lavanda `#F5F5FF`, acciones en azul |
| **Nu, Bancolombia…** | Entidades financieras donde el titular tiene su cuenta | Su propio color de marca |

Las entidades financieras **no** son PISP. El PISP es Telar: es quien mantiene el consentimiento con el banco y quien inicia el débito por cuenta del comercio. Telar es una marca inventada para este demo; cambiarla debería ser cambiar `frontend/src/telar/brand.js` y los tokens `--telar-*` de `frontend/src/index.css`.

## Dos experiencias, dos consentimientos

|  | Acceso a datos | Pago |
|--|----------------|------|
| Cuándo | Al vincular la cuenta | En cada pago |
| Dónde | Perfil → Medios de pago | Checkout del viaje |
| Autoriza | Leer titularidad y consultar saldo | Un débito específico |
| Vigencia | 90 días · revocable | Uso único · 5 minutos |
| ¿Mueve dinero? | No | Sí |
| `data_scope` | `category_2_accounts_read`, `category_3_balances_read` | `category_1_payment_initiation` |
| `purpose.code` | `ACCOUNT_AGGREGATION` | `PAYMENT_INITIATION` |
| Ledger | `createDataConsent()` + `activateDataConsent()` | `createPaymentConsent()` + `createPaymentIntent()` |
| Esquema | `data-consent` | `payment-consent` |

Cada consentimiento tiene **su propio esquema**, versionado en este repo y registrado en el ledger: [data-consent.json](backend/src/schemas/data-consent.json) y [payment-consent.json](backend/src/schemas/payment-consent.json). El mismo archivo se usa dos veces — con `ajv` en el iniciador, para rechazar con errores concretos antes de gastar una llamada de red, y en el ledger como validación autoritativa del record.

La separación es estructural, no de convención: el esquema de acceso a datos **no admite** `category_1_payment_initiation` en su `data_scope`, así que es imposible que un consentimiento de datos autorice un débito. Los gates que JSON Schema no puede expresar —topes contra consumo, separación de partes, `sca_performed_by`— están en [backend/src/consents.js](backend/src/consents.js).

El mandato **cuelga** del de acceso: sin un acceso vigente el backend responde `409 needsLinking` y no hay débito posible. Revocar el acceso invalida la capacidad de iniciar pagos nuevos.

### Experiencia A · Vincular una cuenta

Medios de pago → buscador embebido de Telar → consentimiento de acceso → notificación del banco → login → SCA → cuenta vinculada. Termina **sin mover dinero**.

### Experiencia B · Pagar el viaje

Checkout con la cuenta ya vinculada → consentimiento de pago (uso único, con cuenta regresiva) → notificación del banco → SCA → liquidación en Bre-B → recibo.

Si en el checkout no hay cuenta vinculada, las dos experiencias se **encadenan en una sola visita al banco**: una autenticación, dos consentimientos anclados por separado.

## Pantallas

| Ruta | Pantalla | Actor |
|------|----------|-------|
| `/` | Checkout del viaje | Uber |
| `/payment-methods` | Medios de pago · vincular cuenta | Uber |
| `/telar/directory` | Todas las entidades · búsqueda | Telar |
| `/telar/consent-data` | Consentimiento de acceso a datos | Telar |
| `/telar/consent-payment` | Consentimiento de pago | Telar |
| `/telar/linked` | Cuenta vinculada | Telar |
| `/phone-home` | Solicitud del banco · pantalla de bloqueo | Sistema / banco |
| `/nu-login` | Inicio de sesión | Banco |
| `/nu-auth` | SCA · otorga acceso, pago o ambos | Banco |
| `/processing` | Liquidación | Telar |
| `/trip` · `/complete` | Viaje y recibo | Uber |

## Arrancar

### Backend

```bash
cd backend
npm install
npm run dev
# → http://localhost:3002
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5175
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/trip` | Datos del viaje |
| GET | `/api/banks` | Entidades conectadas a Telar |
| GET | `/api/accounts` | Cuentas con acceso a datos vigente |
| POST | `/api/consent/link/initiate` | Crear o reusar el consentimiento de acceso |
| POST | `/api/consent/link/activate` | El banco otorga el acceso tras la SCA |
| POST | `/api/consent/:handle/revoke` | El titular revoca el acceso |
| POST | `/api/payment/consent` | Consentimiento de pago de uso único |
| POST | `/api/payment/authorize` | SCA del débito · crea el intent |
| GET | `/api/consents?type=` | `data_access`, `payment` o `all` |
| GET | `/api/consent/:handle` | Estado de un consentimiento |
| POST | `/api/trip/complete` | Completar viaje · recibo |

## Ledger

El demo corre contra `open-finance2`. Tres cosas que hay que saber:

**Las lecturas exigen autenticación.** Las escrituras pasan firmadas en el cuerpo, pero `GET /anchors/:handle` responde `auth.forbidden` sin bearer token, y las consultas devuelven cero filas aunque el record exista. El SDK se construye con `secure: {iss, sub, aud, exp, keyPair, kid}` en cada llamada; sin eso no hay estado, ni gates, ni cómputo de consumo.

**Registrar un esquema es irreversible.** No se sobrescriben por handle y no se pueden borrar: el cliente de schema del SDK no expone `drop` y `DELETE /schemas/:handle` responde 404. Por eso `npm run schema:register` es idempotente y los esquemas se validan en local antes de escribirse. Nunca registrar variantes para experimentar.

**El intent usa el esquema `transfer` del propio ledger**, no uno nuestro. Su forma es estricta: `symbol.handle` en mayúsculas (`COP`, factor 100, así que el monto viaja en unidades menores), `source.custom` y `target.custom` con `name`/`entityType`/`idType`/`idNumber`, y el `custom` del intent solo admite `description`.

Los anchors de prueba sí se borran, con `drop(handle).hash().sign([...]).send()` — sin `.hash()` el ledger responde `record.schema-invalid`. Ver `npm run probe:clean`.

### Registrar los esquemas en un ledger nuevo

```bash
cd backend
npm run schema:register     # data-consent y payment-consent · idempotente
```

## Despliegue

Tres cosas que hay que configurar, y las tres se descubrieron rompiéndose:

**Variables de entorno en la plataforma.** `LEDGER_URL`, `SIGNER_PUBLIC` y `SIGNER_SECRET`. El `.env` del repo no se lee en runtime, y la capa de ledger falla al importarse si faltan — a propósito, para no operar contra un ledger equivocado. Sin ellas la función serverless revienta y el frontend muestra listas vacías.

**La API es un catch-all**, `api/[[...path]].js`. Un `api/index.js` con un rewrite de `/api/(.*)` a `/api/index` no sirve: el rewrite cambia la ruta que ve Express, que solo conoce `/api/banks`, `/api/accounts` y compañía, así que toda petición responde 404.

**El rewrite es solo para el router del cliente**, `/((?!api/).*)` a `/index.html`. Sin él, recargar `/payment-methods` en el navegador da 404. Y ojo: Vercel valida `vercel.json` de forma estricta y rechaza claves extra en los objetos de `rewrites` — ni siquiera un `comment`.

## Request-to-Pay

Para construir el demo hermano de solicitud de pago, ver [REQUEST_TO_PAY_INSTRUCTIONS.md](REQUEST_TO_PAY_INSTRUCTIONS.md): mismos consentimientos, intent de tipo `request-to-pay`.

## Stack

- **Frontend**: React 18 + Vite + React Router v6
- **Backend**: Node.js + Express (ESM) + `@minka/ledger-sdk` + `ajv`
- **Paleta**: tomada de plaid.com, en la disposición clara de Plaid Link
