# Construir el demo de Request-to-Pay desde cero

Instrucciones para levantar una aplicación nueva que demuestre **request-to-pay** (solicitud de pago) sobre Open Finance Colombia, reutilizando el modelo de consentimientos de este proyecto.

Este documento asume que quien lo siga **no** ha trabajado en `pay-by-bank`. Todo lo que hace falta saber está aquí, incluidas las restricciones del ledger que ya costaron tiempo descubrir.

---

## 1. Qué cambia y qué no

| | Pay by Bank (este proyecto) | Request-to-Pay (el nuevo) |
|---|---|---|
| Quién inicia | El **pagador** en el checkout del comercio | El **beneficiario**, enviando una solicitud |
| Consentimiento de acceso a datos | `data-consent` | **idéntico** |
| Mandato de pago | `payment-consent` | **idéntico** |
| Schema del intent | `transfer` (del ledger) | `transfer`, o uno propio · ver §2.2 |
| Datos del intent | source, target, symbol, amount | **los mismos** |
| Quién representa la solicitud | no existe | un anchor `payment-request` propio, o un intent pendiente |
| Notificación al pagador | Consecuencia del pago que él inició | **El punto de partida del flujo** |

Los dos objetos de consentimiento se copian sin tocar. La diferencia sustantiva es la **dirección de la iniciación**: el beneficiario pide, el pagador aprueba.

### La regla que hay que preservar

> Ningún intent se crea sin un mandato de pago activo que lo cubra.

En `pay-by-bank` el orden es mandato → gate → intent. En request-to-pay aparece un objeto antes de todo eso —la solicitud— pero el orden se mantiene: la solicitud no mueve dinero, y el intent sigue naciendo después del mandato firmado. Lo único que cambia es quién dispara el proceso.

Si se opta por representar la solicitud como un intent pendiente (§2.2 opción a), la garantía se traslada al commit: el intent existe pero no se compromete hasta que el mandato esté activo y el gate pase.

---

## 2. Paso 0 · Verificaciones antes de escribir una línea

Estas tres cosas invalidan el plan si no se resuelven. Correrlas primero.

### 2.1 Las lecturas del ledger exigen autenticación

Es lo primero que hay que resolver y lo que más tiempo cuesta si se descubre tarde. Las **escrituras** pasan firmadas en el cuerpo y funcionan de una, así que todo parece bien — hasta que hay que leer algo. `GET /anchors/:handle` responde `auth.forbidden` y las consultas devuelven **cero filas** aunque el record exista y se acabe de escribir.

Sin lecturas no hay estado (se computa sobre proofs), ni gates, ni cómputo de consumo, ni borrado (`drop()` lee antes de borrar). El SDK se construye con un bearer token:

```js
const sdk = () => new LedgerSdk({
  server: LEDGER_URL,
  secure: {
    iss: TPP_ID,
    sub: SIGNER_PUBLIC,          // la llave pública sirve como subject
    aud: 'open-finance2',        // handle del ledger
    exp: Math.floor(Date.now() / 1000) + 300,
    keyPair: { public: SIGNER_PUBLIC, secret: SIGNER_SECRET, format: 'ed25519-raw' },
    kid: SIGNER_PUBLIC,
  },
});
```

El token es de vida corta, así que se compone por llamada y no se cachea. Ver `sdk()` en `backend/src/ledger.js`.

**No perseguir el `access` de los records.** Antes de dar con el token probamos rules de `access` a nivel de anchor —`read` sin restricción, `read` sobre `anchor` y `anchor-proof`, `any` con nuestro signer— y ninguna cambió nada: las reglas de `access` son restricciones, no concesiones. El problema era la ausencia de autenticación, no un permiso faltante en el record.

### 2.2 El schema del intent

`request-to-pay` no existe como schema de intent, verificado:

```
❌ request-to-pay · record.relation-not-found
   Schema request-to-pay not found for record of type intent.
```

Dos caminos, y el segundo es mejor de lo que parece:

**(a) Registrar `request-to-pay`** con el patrón de `backend/src/schemas/register.js`, cambiando `record: 'anchor'` por `record: 'intent'`. Da control total sobre el `custom` del intent y hace explícito el tipo en el propio esquema.

**(b) Usar el esquema `transfer` que el ledger ya trae** y llevar el tipo en la descripción. Es lo que hace `pay-by-bank` tras mudarse al ledger limpio: registrar un esquema solo para renombrarlo no aporta, y registrar es irreversible.

Si se elige (b), la forma del claim de `transfer` es estricta y hay que respetarla:

| Campo | Restricción |
|---|---|
| `symbol.handle` | enum `COP` / `USD`, **en mayúsculas**. Factor 100: el monto va en unidades menores |
| `source.handle`, `target.handle` | patrón `^(svgs\|tran):\d+@[a-zA-Z0-9_\-+.]+$` |
| `source.custom`, `target.custom` | requieren `name`, `entityType` (`individual`/`business`), `idType` (`txid`/`ccpt`/`nidn`), `idNumber` |
| `amount` | entero |
| `config.commit` | enum **solo `auto`** |
| `custom` del intent | `additionalProperties: false`, solo admite `description` |

Ese último punto **cambia el diseño de request-to-pay**: `transfer` no admite `commit: 'manual'`, así que la solicitud no puede ser un intent pendiente. Con (b) hay que modelar la solicitud como un anchor propio —un `payment-request`— y crear el intent solo al aprobar, con lo que se recupera el orden de `pay-by-bank`: mandato primero, intent después. Con (a) sí se puede dejar el intent pendiente y comprometerlo al aprobar.

Decidir esto antes de escribir el backend: es la bifurcación de la que dependen la máquina de estados y el número de esquemas.

### 2.3 Los schemas son permanentes: no se sobrescriben y no se borran

- **No se sobrescriben** por handle: `Schema with handle X already exists`. Un cambio de contenido obliga a un handle nuevo (`request-to-pay-v1-1`).
- **No se borran.** El cliente de schema del SDK expone `init`, `from`, `read` y `list`, sin `drop`, a diferencia de los clientes de anchor, bridge, wallet, policy y effect. Y `DELETE /schemas/:handle` responde 404.

Registrar un schema es irreversible y queda a la vista de todos los que usen ese ledger. **No registrar hasta tener el JSON Schema estable**: validarlo localmente con `ajv`, ejercitarlo contra un payload real, y registrar al final.

Para experimentar con variantes de un esquema sin dejar rastro permanente, no registrar una por una: escribir el JSON Schema completo, validarlo en local con `ajv`, y solo entonces registrar el que quede. Si aun así hace falta probar contra el ledger, usar handles con un prefijo reconocible y asumir que quedan ahí.

### 2.4 Borrar records de prueba

Los anchors sí se borran, con una cadena que no es obvia:

```js
await sdk.anchor.drop(handle).hash().sign([{ keyPair }]).send();
```

Sin `.hash()` el cuerpo viaja con los datos completos del anchor en vez del registro de borrado `{parent: hash}`, y el ledger responde `record.schema-invalid`. Ver `backend/scripts/drop-probe-records.mjs` en este repo, que simula por defecto y borra con `--apply`.

Dos límites: **solo se puede borrar lo que se puede leer**, así que sin el token de §2.1 el borrado también falla con `auth.forbidden`; y el **cliente de intents no expone `drop`** — los intents de prueba se quedan.

---

## 3. Escenario del demo

Recomendado: **un comercio pequeño cobra una cuenta.**

> Café Bourbon termina de atender a Simón. En vez de darle un datáfono, el mesero
> genera una solicitud de pago por COP 85.000. A Simón le llega la notificación en
> su banco, revisa quién cobra y por qué, y aprueba con biometría.

Funciona mejor que un P2P para demostrar el caso porque hace visible el `remittance_information` estructurado (NIT del facturador, referencia de la cuenta) que el esquema del mandato ya contempla y que en `pay-by-bank` quedó en `null`.

Actores, con los mismos nombres de rol del esquema:

| Rol | Quién | Campo |
|---|---|---|
| Beneficiario | Café Bourbon SAS | `creditor_id`, `creditor_name` |
| Entidad del beneficiario | Bancolombia | `creditor_agent_id` |
| Iniciador (PISP) | Telar — o el nombre que se elija | `initiator_id` |
| Pagador | Simón Rodríguez | `debtor_ref` (pseudónimo) |
| Entidad del pagador | Nu | `debtor_agent_id` |
| Enrutador de la confirmación | Bre-B | `easpbv_id` |

Las entidades financieras **no son PISP**. El PISP es el iniciador. Un error frecuente es escribir "bancos habilitados para PISP" en la interfaz: los bancos están *conectados al iniciador*, y es el iniciador quien tiene el registro ante la SFC.

---

## 4. Restricciones del ledger ya verificadas

Todo lo de esta sección está comprobado empíricamente. No hay que volver a descubrirlo.

### 4.1 Los esquemas de consentimiento son nuestros

En el ledger limpio no hay `of-consent-v1`: los dos esquemas se registran desde este repo (`data-consent` y `payment-consent`), así que las restricciones son las que uno decida, no las de un catálogo ajeno. Se copian tal cual y ya vienen ejercitados contra payloads reales.

Lo que vale la pena conservar de su diseño:

- **La separación es estructural.** El esquema de acceso a datos no admite `category_1_payment_initiation` como valor de `data_scope`; el del mandato solo admite ese. Un consentimiento de datos no puede autorizar un débito ni por error de programación.
- **`additionalProperties: false`** en el `custom` de ambos: la minimización deja de ser una intención y pasa a ser una restricción que rechaza.
- **El estado no se escribe.** `status`, `granted_at`, `revoked_at` y los contadores de consumo se computan sobre los proofs. En el esquema van en null.
- **Prefijos de handle distintos** (`dconsent_` / `pconsent_`) para distinguir las dos clases de un vistazo en el ledger.
- **Un `consent_class` explícito** como discriminante, en vez de deducirlo del `purpose`.

### 4.2 Consultas

| Qué | Cómo |
|---|---|
| Filtrar | `?data.handle=X` o `?data.schema=X` — **en crudo** |
| Forma que NO funciona | `?filter[data.handle]=X` se ignora en silencio y devuelve la página completa |
| Campos filtrables | `data.handle`, `data.schema`, `data.wallet`, `data.source`, `data.target`, `data.symbol`, `data.record`, `meta.domain` |
| Límite | tope real de 100 por página, aunque se pida más |
| Ordenar | `?sort.meta.moment=1` (asc) o `-1` (desc). Único campo ordenable |
| Leer con proofs | **no** usar `sdk.anchor.read()` si hace falta `meta.proofs`; ir por HTTP a `/anchors?data.handle=X`, que devuelve `{hash, data, luid, meta}` |

### 4.3 Estado y contadores

El estado nunca se escribe: se computa sobre los proofs, y **la revocación gana sobre la activación** sin importar el orden. Los contadores de consumo tampoco persisten: se derivan de los proofs con evento `intent.committed`. Copiar `deriveConsentStatus()` y `computeConsumption()` de `backend/src/paymentConsent.js` tal cual.

---

## 5. Qué copiar y qué escribir

### 5.1 Se copia sin cambios

```
backend/src/consents.js                    → constructores, validación con ajv, gates, consumo
backend/src/schemas/data-consent.json      → esquema del consentimiento de acceso
backend/src/schemas/payment-consent.json   → esquema del mandato de pago
backend/src/schemas/register.js            → registro idempotente, con la advertencia de irreversibilidad
backend/src/ledger.js                      → sdk() autenticado, proofs, estado derivado
backend/scripts/drop-probe-records.mjs     → limpieza de records de prueba
frontend/src/telar/                        → marca, módulo embebido, hoja, estado, eventos
frontend/src/index.css                     → paleta y tokens
```

Del módulo del iniciador conviene conservar tres decisiones ya probadas:

- **El fondo dice de quién es la pantalla.** Comercio en blanco, iniciador en lavanda `#F5F5FF`, entidad financiera con su color de marca. La hoja del iniciador entra flotando sobre el anfitrión atenuado; ese gesto comunica el cambio de responsable antes que el color.
- **El arranque de cada experiencia se declara en un solo sitio** (`beginLink` / `beginPayment`). Fijar el flujo por separado es lo que produce hojas de pago sin monto.
- **Registro de eventos visible en pantalla.** Es lo que hace demostrable que hay dos consentimientos distintos y no uno repintado.

### 5.2 Se adapta

`buildSinglePaymentConsent()` recibe los mismos parámetros, con dos cambios de contenido:

```js
purposeCode: 'BILL_PAYMENT',          // en vez de TRANSPORT_FARE
remittance: {                          // en pay-by-bank iba en null
  biller_nit: '900123456',
  invoice_reference: 'MESA-14-2026-08-09',
  billing_period: '2026-08',
},
```

`payment_context_code` se deriva del catálogo: `BILL_PAYMENT` → `BillPayment`.

### 5.3 Se escribe nuevo: la solicitud y su intent

Partiendo de `createPaymentIntent()` de `backend/src/ledger.js`. Con la opción (a) de §2.2 —esquema propio de intent— la solicitud puede ser el intent mismo:

```js
const intentData = {
  handle: `rtp_${randomUUID()}`,
  schema: 'request-to-pay',            // ← 1. schema propio
  access: [{ action: 'any', signer: { public: SIGNER_PUBLIC } }],
  config: { commit: 'manual' },        // ← 2. no se liquida al crearse
  claims: [
    {
      action: 'transfer',
      symbol: { handle: currency.toLowerCase() },
      source: { handle: `svgs:${payerAccount}@${payerBank}.com`, custom: { /* datos del pagador */ } },
      target: { handle: `svgs:${payeeAccount}@${payeeBank}.com`, custom: { /* datos del beneficiario */ } },
      amount: amount * 100,            // el ledger trabaja en centavos
    },
  ],
  custom: {
    intent_type: 'request-to-pay',     // ← 3. explícito, útil si toca caer a pay-by-bank
    request_reference: reference,
    request_description: 'Cuenta Café Bourbon · mesa 14',
    requested_by: CREDITOR.id,
    requested_at: new Date().toISOString(),
    expires_at: /* +N minutos */,
    tpp_id: TPP_ID,
    payment_consent_handle: null,      // se llena al aprobar
  },
};
```

Los claims son idénticos a `pay-by-bank`: mismos wallets, mismo símbolo, mismo `amount` en centavos, mismos `custom` de titularidad con `document_type` / `document_number`.

**Sobre el commit.** `config.commit: 'manual'` deja el intent pendiente — verificado. La transición a comprometido **no está verificada**: el cliente de intents del SDK expone `init`, `from`, `read`, `list`, `transfers`, sin un método `commit` explícito, así que probablemente se hace firmando un proof con `sdk.intent.from(record).sign([...]).send()`, igual que en los anchors. Confirmarlo con un intent de prueba antes de construir el flujo encima.

---

## 6. Máquina de estados

```
                        (beneficiario)
                              │
                     crea la solicitud
                              │
                              ▼
     ┌──────────────── REQUESTED ────────────────┐
     │            intent pendiente               │
     │        commit: manual, sin mandato        │
     └───────────────────┬───────────────────────┘
                         │  notificación al pagador
                         ▼
                    ┌─────────┐
        ┌───────────┤ REVIEWED├───────────┐
        │           └─────────┘           │
   rechaza                            aprueba (SCA)
        │                                 │
        ▼                                 ▼
    DECLINED                     mandato de pago anclado
  intent abortado                         │
                                    gate del mandato
                                          │
                              ┌───────────┴───────────┐
                          falla                     pasa
                              │                       │
                              ▼                       ▼
                          REJECTED              intent comprometido
                       sin movimiento              SETTLED
                                                        │
                                            proof intent.committed
                                             (consumo computable)
```

Estados que hay que poder demostrar además del feliz: **solicitud expirada** (el intent vence antes de que el pagador la abra), **rechazo explícito**, **fondos insuficientes** y **mandato revocado entre la aprobación y el commit**.

---

## 7. Endpoints

```
GET  /api/banks                        entidades conectadas al iniciador
GET  /api/accounts                     cuentas con acceso a datos vigente

POST /api/consent/link/initiate        crea o reutiliza el acceso a datos
POST /api/consent/link/activate        el banco lo otorga tras la SCA
POST /api/consent/:handle/revoke       el titular lo revoca

POST /api/request                      ← NUEVO · el beneficiario crea la solicitud
GET  /api/request/:handle              ← NUEVO · estado de la solicitud
GET  /api/requests?payer=              ← NUEVO · bandeja del pagador
POST /api/request/:handle/decline      ← NUEVO · el pagador rechaza
POST /api/request/:handle/approve      ← NUEVO · SCA → mandato → gate → commit
```

`POST /api/request/:handle/approve` es el corazón del demo. Orden estricto, sin atajos:

```js
// 1 · La entidad emisora deja constancia de la SCA
//     sca_performed_by DEBE igualar debtor_agent_id, y mínimo dos factores
// 2 · Se ancla el mandato de pago (payment-consent, validado en local y en el ledger)
// 3 · Gate: vigencia, tope por orden, tope acumulado, conteo, límites periódicos,
//     sca_performed_by, número de factores. Todo numérico o igualdad de ids.
// 4 · Recién ahora se compromete el intent
// 5 · Proof intent.committed en el mandato, para que el consumo sea computable
```

Si el gate falla, responder `422` con el código del error (`amount_exceeds_per_transaction_limit`, `consent_expired`, `sca_performed_by_mismatch`, …) y `intentCommitted: false`. El intent queda pendiente o se aborta, nunca a medias.

---

## 8. Pantallas

Tres superficies, igual que en `pay-by-bank`, más una que es propia de request-to-pay.

| Ruta | Pantalla | Superficie |
|---|---|---|
| `/cobrar` | El comercio arma la solicitud: monto, concepto, referencia | Comercio |
| `/cobrar/enviada` | Solicitud enviada, esperando al pagador | Comercio |
| `/bandeja` | **Bandeja de solicitudes del pagador** ← nueva respecto a pay-by-bank | Pagador |
| `/telar/request` | Detalle de la solicitud: quién cobra, cuánto, por qué, hasta cuándo | Iniciador |
| `/telar/consent-payment` | Mandato de pago con sus topes | Iniciador |
| `/phone-home` | Notificación del banco en la pantalla de bloqueo | Sistema |
| `/nu-login`, `/nu-auth` | Login y SCA | Entidad financiera |
| `/telar/settling` | Liquidación | Iniciador |
| `/recibo` | Recibo con quién inició y con qué autorización | Comercio |

**La pantalla de notificación no puede desaparecer.** Es el salto app-to-app y en request-to-pay es además el punto de entrada del pagador: sin ella el flujo no se entiende. En `pay-by-bank` esa pantalla es la única que se queda oscura, y con razón — es la pantalla de bloqueo del sistema operativo, no una superficie de producto.

La bandeja es lo único estructuralmente nuevo. En pay-by-bank el pagador siempre está en un checkout; aquí llega sin contexto y necesita ver qué le están cobrando, quién, y qué pasa si no hace nada.

---

## 9. Cómo probar

Sin navegador, con curl, antes de tocar el frontend. Este orden encontró todos los errores reales de `pay-by-bank`:

```bash
# 1 · Vinculación (acceso a datos)
POST /api/consent/link/initiate  {"bankId":"nu"}
POST /api/consent/link/activate  {"consentHandle":"..."}
GET  /api/accounts                             # debe listar la cuenta

# 2 · Solicitud
POST /api/request  {"amount":85000,"concept":"Mesa 14","payerRef":"..."}
GET  /api/request/:handle                      # estado REQUESTED, sin mandato

# 3 · Aprobación
POST /api/request/:handle/approve  {"scaMethod":"biometric_face_id"}
                                               # mandato + gate + commit

# 4 · Casos que DEBEN fallar
POST /api/request/:handle/approve              # otra vez → transaction_count_exhausted
POST /api/request/:h2/approve  {"amount":999000}  # → amount_exceeds_per_transaction_limit
POST /api/consent/:linkHandle/revoke           # y luego aprobar → sin acceso vigente
```

Que los casos 4 fallen con el código correcto vale más que cualquier captura de pantalla: es lo que demuestra que la separación de consentimientos es real y no decorativa.

---

## 10. Errores ya cometidos, para no repetirlos

1. **Atribuir el registro PISP al comercio.** El `sfcRef` y el `tpp_id` son del iniciador. El comercio es beneficiario y viaja en `creditor_id` y en el propósito del mandato, no como titular del consentimiento.

2. **Meter `category_1_payment_initiation` en el consentimiento de acceso a datos.** Si vincular ya autoriza iniciar pagos, el mandato es decorativo. El acceso lleva categorías 2 y 3 con `ACCOUNT_AGGREGATION`; la categoría 1 va solo en el mandato con `PAYMENT_INITIATION`.

3. **Un valor por defecto de flujo que mueve dinero.** Si el estado de la experiencia puede quedar sin declarar, el valor por defecto tiene que ser el que *no* mueve dinero. Un flujo de pago sin monto pintó una autorización por cero pesos.

4. **Registrar schemas para experimentar.** Son permanentes: no se sobrescriben ni se borran. Descubrir las restricciones del ledger registrando un schema por variante dejó catorce esquemas basura en un ledger compartido, imposibles de retirar. Lo correcto es escribir el esquema completo, validarlo en local con ajv contra un payload real, y registrar una sola vez.

5. **Confiar en `filter[...]`.** Se ignora en silencio, y el código parece funcionar hasta que hay más de 100 registros.

6. **Dar por hecho que si la escritura funciona, la lectura también.** Las escrituras van firmadas y pasan sin token; las lecturas no. El síntoma engaña: el record se escribe, y luego "no existe". Costó rediseñar la persistencia del mandato a mitad de camino, y el rediseño resultó innecesario en cuanto apareció el bearer token de §2.1.

7. **Dejar acciones sin punto de entrada.** Revocar y vincular otra cuenta existían pero eran inalcanzables desde la pantalla principal. Al terminar cada función, recorrer el camino del usuario hasta ella.

---

## 11. Decisiones abiertas

Ninguna es bloqueante, pero conviene resolverlas antes de escribir el backend.

**¿El mandato se ancla al aprobar o al crear la solicitud?** Lo propuesto es al aprobar, porque hasta ese momento el pagador no ha consentido nada y un mandato sin firma es un registro vacío. La alternativa —crearlo pendiente junto con la solicitud— hace el flujo más simétrico con `pay-by-bank` a cambio de dejar mandatos pendientes que nadie firmará.

**¿Qué pasa si el acceso a datos se revoca entre la aprobación y el commit?** Lo propuesto es abortar: el gate ya verifica el mandato, y conviene que verifique también que la cuenta sigue vinculada. Es una ventana de segundos, pero es la clase de caso que alguien de una entidad financiera va a preguntar.

**¿`sca_policy` en `PER_TRANSACTION` o `AT_MANDATE`?** Para una solicitud única da igual, pero el campo existe para poder operar bajo las dos lecturas del num. 2 sin rearquitectura. Si el demo va a mostrar suscripciones o cobros recurrentes, decidirlo ahora cambia la máquina de estados.

**Nombres ISO 20022.** `purpose_code` usa un catálogo local (`TELAR_LOCAL_V1`) con `purpose_code_scheme` justamente para que la llegada del catálogo de la SFC o de ISO sea un mapeo y no una reescritura. Los nombres `ExternalPurpose1Code` y los códigos de `Frequency` del esquema **no se han contrastado** contra el repositorio ISO. Verificarlos antes de presentar el esquema como definitivo.

---

## 12. Stack y arranque

Mismo que `pay-by-bank`, sin sorpresas:

- **Frontend** React 18 + Vite + React Router v6, puerto 5175
- **Backend** Node.js + Express (ESM) + `@minka/ledger-sdk` + `ajv`, puerto 3002
- **Proxy** `/api → localhost:3002` en `vite.config.js`
- **Ledger** `LEDGER_URL`, `SIGNER_PUBLIC`, `SIGNER_SECRET` en `backend/.env`

Las credenciales del ledger de desarrollo están versionadas en `backend/.env` de este repo. Si el nuevo proyecto va a otro entorno, rotarlas y sacarlas del control de versiones.
