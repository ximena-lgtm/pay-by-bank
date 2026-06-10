# Integración con Ledger - Consent Engine

Este proyecto implementa el manejo de consentimientos Open Finance usando el Minka Ledger SDK como backend de almacenamiento y auditoría.

## 📋 Arquitectura

### Flujo de Consentimientos

```
1. Usuario selecciona banco
   ↓
2. Backend crea ANCHOR en ledger (status: pending)
   - Schema: consent-1
   - Labels: consent, tpp:*, bank:*, status:pending
   ↓
3. Usuario autentica en banco (SCA)
   ↓
4. Backend firma ANCHOR con proof (status: active)
   - Agrega: granted_at, sca_method, tokens
   - Labels: consent, tpp:*, bank:*, status:active
```

## 🏗️ Componentes

### Backend (`/backend/src/ledger.js`)

Módulo principal para interactuar con el ledger:

- **`createConsent()`**: Crea un anchor de consentimiento en estado pending
- **`activateConsent()`**: Activa un consentimiento agregando proof con autenticación
- **`readConsent()`**: Lee el estado actual de un consentimiento

### Endpoints API

#### `POST /api/payment/initiate`
Crea un consentimiento en el ledger cuando el usuario selecciona un banco.

**Request:**
```json
{
  "bankId": "nu",
  "tripId": "TRIP-001"
}
```

**Response:**
```json
{
  "ok": true,
  "instrument": {
    "consentToken": "consent_TRIP-001_1234567890",
    "consentHandle": "consent_TRIP-001_1234567890",
    "consentLuid": "luid_...",
    "from": "Nu · Cta *8834 · Simón",
    "to": "Uber Colombia SAS",
    "amount": 18500,
    "currency": "COP",
    "expiresAt": "2024-06-09T10:35:00.000Z"
  },
  "consent": {
    "id": "consent_TRIP-001_1234567890",
    "handle": "consent_TRIP-001_1234567890",
    "status": "pending"
  }
}
```

#### `POST /api/payment/authorize`
Activa el consentimiento cuando el usuario completa la autenticación.

**Request:**
```json
{
  "consentToken": "consent_TRIP-001_1234567890",
  "consentHandle": "consent_TRIP-001_1234567890",
  "method": "biometric"
}
```

**Response:**
```json
{
  "ok": true,
  "paymentId": "PAY-1234567890",
  "status": "EXECUTED",
  "consent": {
    "id": "consent_TRIP-001_1234567890",
    "handle": "consent_TRIP-001_1234567890",
    "status": "active",
    "granted_at": "2024-06-09T10:32:15.000Z",
    "sca_method": "biometric_face_id"
  },
  "ledger": {
    "consent_activated": true,
    "consent_handle": "consent_TRIP-001_1234567890"
  }
}
```

#### `GET /api/consent/:handle`
Consulta el estado de un consentimiento.

**Response:**
```json
{
  "ok": true,
  "consent": {
    "id": "consent_TRIP-001_1234567890",
    "handle": "consent_TRIP-001_1234567890",
    "status": "active",
    "tpp_id": "tpp_uber",
    "bank_id": "nu",
    "trip_id": "TRIP-001",
    "amount": 18500,
    "currency": "COP",
    "granted_at": "2024-06-09T10:32:15.000Z",
    "sca_method": "biometric_face_id"
  }
}
```

## 🔐 Schema del Anchor

### consent-1

**Campos obligatorios:**
- `consent_id`: ID único del consentimiento
- `tpp_id`: ID del TPP (Third Party Provider)
- `tpp_legal_name`: Razón social del TPP
- `data_provider_id`: ID del banco/proveedor de datos
- `titular_ref`: Referencia pseudonimizada del titular (HMAC-SHA256)
- `data_scope`: Array de scopes autorizados
- `purpose`: Propósito del consentimiento
- `duration_days`: Duración en días
- `commercialization_flag`: Flag de comercialización
- `compensation_flag`: Flag de compensación
- `expires_at`: Fecha de expiración ISO 8601

**Campos opcionales (null en pending, poblados en active):**
- `granted_at`: Fecha de otorgamiento
- `sca_method`: Método de autenticación usado
- `double_check_confirmed_at`: Fecha de confirmación doble check
- `access_token_hash`: Hash del access token
- `refresh_token_hash`: Hash del refresh token
- `token_expires_at`: Expiración del token
- `revoked_at`: Fecha de revocación
- `revoked_by`: Revocado por (user/tpp/regulator)
- `revocation_reason`: Razón de revocación

**Custom fields específicos del caso de uso:**
- `trip_id`: ID del viaje
- `trip_amount`: Monto del viaje
- `trip_currency`: Moneda del viaje
- `payment_id`: ID del pago ejecutado

## 🚀 Setup

### 1. Instalar dependencias

```bash
cd backend
npm install
```

### 2. Configurar variables de entorno

Copiar `.env.example` a `.env` y configurar:

```bash
# Ledger Configuration
LEDGER_URL=https://open-finance-1.ldg-dev.one/api/v2
SIGNER_PUBLIC=kao3VT0Hn+AE+f9iA3VnHzy/4k55242D5jBKwnxwFYQ=
SIGNER_SECRET=keSFN3X+LszAem9NOfFE3/tTokEuFzwDYa/8vQpbL/A=
```

### 3. Pre-registrar entidades en el ledger

**IMPORTANTE**: Antes de crear consentimientos, las siguientes entidades deben existir en el ledger:

1. **Wallets de clientes**: e.g. `wallet_customer_001`
2. **TPP (Third Party Provider)**: e.g. `tpp_uber`
3. **Bridges (proveedores de datos/bancos)**: e.g. `bridge_nu`, `bridge_bancolombia`

Si estas entidades no existen, la creación de anchors fallará con error `record.relation-not-found`.

**Para ambiente de desarrollo:**
- Usar wallets/TPPs/bridges de prueba ya registrados en el ledger de desarrollo
- Consultar con el equipo de Minka para obtener entidades de prueba válidas

**Para producción:**
- Los bancos deben registrarse como bridges en el ledger
- El TPP (Uber en este caso) debe estar registrado
- Los wallets de usuarios se crean durante el onboarding

### 4. Iniciar el backend

```bash
npm start
# o con watch mode
npm run dev
```

## 🧪 Testing

### Crear un consentimiento manualmente

```bash
cd backend
node -e "import('./src/ledger.js').then(m => m.createConsent({
  customerId: 'test_customer',
  customerWallet: 'wallet_test',
  bankId: 'nu',
  tripId: 'TRIP-TEST',
  amount: 18500,
  currency: 'COP'
}).then(console.log))"
```

### Ver un consentimiento

```bash
curl http://localhost:3001/api/consent/consent_TRIP-001_1234567890
```

### Ver en el ledger (con minka CLI)

```bash
minka anchor show consent_TRIP-001_1234567890
```

## 📊 Estados del Consentimiento

1. **pending**: Consentimiento creado, esperando autenticación del usuario
2. **active**: Usuario autenticó, consentimiento otorgado
3. **revoked**: Consentimiento revocado por user/tpp/regulator
4. **expired**: Consentimiento expirado por tiempo

## 🔍 Auditoría

Todos los consentimientos quedan registrados en el ledger con:
- Hash criptográfico inmutable
- Firmas digitales de cada evento
- Timestamps precisos
- Trazabilidad completa del ciclo de vida

### Labels para búsqueda

- `consent`: Todos los consentimientos
- `tpp:uber`: Consentimientos del TPP Uber
- `bank:nu`: Consentimientos para el banco Nu
- `status:pending`: Consentimientos pendientes
- `status:active`: Consentimientos activos
- `type:r2p`: Request to Pay

## 📚 Referencias

- [Minka Ledger SDK](https://github.com/minka-sdks/ledger-sdk)
- [Consent Engine Spec](./consent-engine-spec.md)
- [Open Finance Colombia - Decreto 368/2026](https://www.sfc.gov.co)
