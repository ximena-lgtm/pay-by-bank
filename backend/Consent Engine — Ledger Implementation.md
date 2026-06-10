# Consent Engine — Ledger Implementation

**Component:** Open Finance Hub Colombia — Consent Engine
**Ledger Version:** Minka Ledger v2
**Implementation Model:** Anchors + Proofs + Policies
**Regulatory Compliance:** Decreto 368/2026 · CE 004/2024 · Ley 1581/2012

---

## Table of Contents

1. [Architecture Overview](about:blank#1-architecture-overview)
2. [Data Model Implementation](about:blank#2-data-model-implementation)
3. [Authorization Flow](about:blank#3-authorization-flow)
4. [Core Functions](about:blank#4-core-functions)
5. [Authentication & Security](about:blank#5-authentication--security)
6. [API Implementation](about:blank#6-api-implementation)
7. [Compliance Mapping](about:blank#7-compliance-mapping)
8. [Deployment Guide](about:blank#8-deployment-guide)

---

## 1. Architecture Overview

### 1.1 Ledger as Consent Engine

The Minka Ledger provides three primitives that map perfectly to the Consent Engine requirements:

| Consent Engine Concept | Ledger Primitive | Why It Fits |
| --- | --- | --- |
| **Consent Record** | Anchor | Mutable metadata store with immutable proofs |
| **Event Log** | Proofs (meta.proofs[]) | Append-only, cryptographically signed events |
| **Status Transitions** | Status Policies | Quorum-based state machine enforcement |
| **Access Control** | Access Policies | Who can read/modify/sign consents |
| **Gate Function** | Policy Evaluation | Real-time permission checking |

### 1.2 Core Architecture Principles

```
┌─────────────────────────────────────────────────────────────┐
│                     CONSENT ANCHOR                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ data (partially mutable)                               │ │
│  │  ├─ handle: "consent_uuid"                             │ │
│  │  ├─ schema: "of-consent-v1"                            │ │
│  │  ├─ wallet: "wallet_titular_ref"  (titular identity)   │ │
│  │  ├─ target: "tpp_crediviva"       (TPP)                │ │
│  │  ├─ source: "bridge_bancolombia"  (Data Provider)      │ │
│  │  └─ custom: { consent fields }    (mutable via PUT)    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ meta (computed from proofs)                            │ │
│  │  ├─ status: "active"       (computed via status policy)│ │
│  │  ├─ proofs: [...]          (IMMUTABLE EVENT LOG) ✅    │ │
│  │  ├─ moment: "2026-06-04"                               │ │
│  │  └─ owners: [signers]                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

         ↓ Each status change = new proof

┌─────────────────────────────────────────────────────────────┐
│                      PROOF (Event)                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ proof.custom (immutable event data)                    │ │
│  │  ├─ status: "active"                                   │ │
│  │  ├─ event: "sca_completed"                             │ │
│  │  ├─ timestamp: "2026-06-04T10:00:00Z"                  │ │
│  │  ├─ sca_method: "password+otp"                         │ │
│  │  ├─ tokens: [{ type, hash, expires_at }]              │ │
│  │  ├─ actor: "bridge_bancolombia"                        │ │
│  │  └─ data: { event-specific fields }                   │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ proof signature (cryptographic binding)                │ │
│  │  ├─ public: "signer_key"                               │ │
│  │  ├─ method: "ed25519-v2"                               │ │
│  │  ├─ result: "signature_bytes"                          │ │
│  │  └─ digest: "proof_hash"                               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Why Anchors (Not Intents)?

| Requirement | Anchors | Intents |
| --- | --- | --- |
| **Mutable metadata** | ✅ `data.custom` mutable via PUT | ❌ Immutable after creation |
| **Immutable event log** | ✅ `meta.proofs[]` append-only | ✅ `meta.proofs[]` append-only |
| **Status via proofs** | ✅ Status policies supported | ✅ Status policies supported |
| **No 2PC required** | ✅ Single-phase operations | ❌ Requires commit/abort flow |
| **Long-lived records** | ✅ Designed for metadata | ⚠️ Designed for transactions |

**Verdict:** Consents are **metadata anchors**, not financial transactions.

---

## 2. Data Model Implementation

### 2.1 Anchor Schema: `of-consent-v1`

**Registered Schema Handle:** `of-consent-v1`

**Top-Level Fields:**

```json
{
  "handle": "consent_<uuid>",           // Unique consent ID
  "schema": "of-consent-v1",            // Schema type
  "wallet": "<titular_pseudonym>",      // Titular identity (HMAC-SHA256)
  "target": "<tpp_id>",                 // TPP receiving data
  "source": "<data_provider_id>",      // Data Provider source
  "custom": { /* see below */ }         // Consent metadata
}
```

**Immutable Fields:**
- `handle` - Cannot change after creation
- `wallet` - Titular identity locked at creation
- `source` - Data Provider locked at creation
- `target` - TPP locked at creation

**Mutable Fields:**
- `custom.*` - All consent metadata can be updated via PUT
- But in practice, we use **proofs for modifications** to maintain audit trail

### 2.2 Custom Fields Mapping

Maps directly from spec Section 3 (Data Model):

```json
{
  "custom": {
    // ===== IDENTIFICATION =====
    "consent_id": "uuid-v4",
    "tpp_id": "col-tpp-00421",
    "tpp_legal_name": "Fintech ABC S.A.S., Calle 72 #10-51, Bogotá",
    "data_provider_id": "col-dp-00018",
    "titular_ref": "hmac_sha256_a3f9...c2d1",

    // ===== SCOPE & PURPOSE =====
    "data_scope": [
      "ACCOUNTS_READ",
      "BALANCES_READ",
      "TRANSACTIONS_READ_12M"
    ],
    "purpose": {
      "code": "CREDIT_ASSESSMENT",
      "text": "Evaluate your creditworthiness for a personal loan"
    },

    // ===== TREATMENT =====
    "treatment": {
      "storage_permission": "DURATION_BOUND",
      "data_retention_days": 90,
      "mode": "STORE"
    },

    // ===== COMMERCIALIZATION =====
    "commercialization": {
      "flag": false,
      "compensation_offered": false
    },

    // ===== TEMPORAL =====
    "expires_at": "2026-12-31T00:00:00Z",
    "transaction_from": "2025-06-01T00:00:00Z",
    "transaction_to": "2026-06-01T00:00:00Z",

    // ===== ACTIVATION (null when pending) =====
    "granted_at": null,
    "double_check_confirmed_at": null,
    "sca_method": null,

    // ===== REVOCATION (null when active) =====
    "revoked_at": null,
    "revoked_by": null,
    "revocation_reason": null
  }
}
```

**Note:** `tokens` are **NOT** in `custom`. They live in **`meta.proofs[].custom.tokens`** (see Section 1.3 - Tokens Architecture).

### 2.3 Status Field Location

**CRITICAL:** `status` is **NOT** in `anchor.custom.status`.

It’s in **`meta.status`** and is **computed from proofs** via status policies.

```json
{
  "data": { /* anchor data */ },
  "meta": {
    "status": "active",        // ← Computed by status policy
    "proofs": [                // ← Immutable event log
      {
        "custom": {
          "status": "pending",
          "event": "consent_created"
        }
      },
      {
        "custom": {
          "status": "active",
          "event": "sca_completed"
        }
      }
    ]
  }
}
```

### 2.4 Consent State Machine Implementation

Maps spec Section 3.1 states to Ledger status policy:

```json
{
  "handle": "of-consent-status-policy",
  "schema": "status",
  "record": "anchor",
  "filter": {
    "schema": "of-consent-v1"
  },
  "values": [
    {
      "status": { "$in": ["pending", "active", "denied", "revoked", "expired"] },
      "quorum": [
        { "public": "<hub_signer_key>" }
      ]
    }
  ],
  "config": {
    "quorumProofSelection": "LatestChain"
  }
}
```

**State Transitions:**

| From | To | Trigger | Proof Event |
| --- | --- | --- | --- |
| (none) | `pending` | POST /anchors | `consent.requested` |
| `pending` | `active` | Double-check confirmed | `consent.activated` |
| `pending` | `denied` | Titular denies | `consent.denied` |
| `active` | `revoked` | Any actor revokes | `consent.revoked` |
| `active` | `expired` | expires_at reached | `consent.expired` |

**Terminal states:** `denied`, `revoked`, `expired` (no further transitions)

---

## 3. Authorization Flow

### 3.1 Flow Overview

Maps spec Section 4 (Authorization Flow) to Ledger operations:

```
Step 1: POST /anchors (pending)
  └─ Creates anchor with status "pending"
  └─ Proof #1: { event: "consent.requested", status: "pending" }

Step 2: TPP directory validation
  └─ Bridge SFC validates TPP registration
  └─ Proof #2: { event: "tpp.validated", bridge: "bridge-sfc", status: "prepared" }

Step 3: Redirect to Data Provider
  └─ (No ledger operation)

Step 4: SCA at Data Provider
  └─ Proof #3: { event: "sca.completed", sca_method: "password+otp" }

Step 5: Double-check confirmation
  └─ Proof #4: {
       event: "double_check.confirmed",
       status: "active",           // ← Triggers status change
       granted_at: "...",
       double_check_confirmed_at: "...",
       sca_method: "password+otp"
     }

Step 6: Consent activation
  └─ Status policy evaluates: pending → active ✅
  └─ meta.status = "active"

Step 7: Token issuance
  └─ Proof #5: {
       event: "tokens.issued",
       tokens: [
         { type: "access", hash: "sha256_...", expires_at: "..." },
         { type: "refresh", hash: "sha256_...", expires_at: "..." }
       ]
     }
```

### 3.2 Creating Pending Consent (Step 1)

```tsx
POST /anchors

const result = await sdk.anchor
  .init()
  .data({
    handle: `consent_${uuidv4()}`,
    schema: 'of-consent-v1',
    wallet: generateTitularRef(document_number),  // HMAC-SHA256
    target: tpp_id,
    source: data_provider_id,
    custom: {
      consent_id: consent_id,
      tpp_id: tpp_id,
      tpp_legal_name: "...",
      data_provider_id: data_provider_id,
      titular_ref: hmac_sha256(...),
      data_scope: ["ACCOUNTS_READ", "BALANCES_READ"],
      purpose: {
        code: "CREDIT_ASSESSMENT",
        text: "..."
      },
      treatment: { /* ... */ },
      commercialization: { /* ... */ },
      expires_at: "2026-12-31T00:00:00Z",
      transaction_from: "2025-06-01",
      transaction_to: "2026-06-01",
      granted_at: null,
      double_check_confirmed_at: null,
      sca_method: null,
      revoked_at: null,
      revoked_by: null,
      revocation_reason: null
    }
  })
  .hash()
  .sign([{
    keyPair: { public: HUB_SIGNER_PUBLIC, secret: HUB_SIGNER_SECRET },
    custom: {
      status: "pending",
      event: "consent.requested",
      timestamp: new Date().toISOString(),
      actor: tpp_id
    }
  }])
  .send()
```

**Result:**
- Anchor created with `meta.status = "pending"`
- Proof #1 registered: `consent.requested`

### 3.3 Double-Check Activation (Step 5)

```tsx
POST /anchors/:consent_id/proofs

const currentAnchor = await sdk.anchor.read(consent_id)

const activationProof = await sdk.anchor
  .from({
    data: currentAnchor.anchor,
    hash: currentAnchor.hash,
    meta: currentAnchor.meta,
    luid: currentAnchor.luid
  })
  .sign([{
    keyPair: {
      public: DATA_PROVIDER_SIGNER_PUBLIC,
      secret: DATA_PROVIDER_SIGNER_SECRET
    },
    custom: {
      status: "active",              // ← Triggers status policy
      event: "double_check.confirmed",
      timestamp: new Date().toISOString(),
      granted_at: titular_approval_timestamp,
      double_check_confirmed_at: new Date().toISOString(),
      sca_method: "password+otp",
      actor: data_provider_id,
      titular_decision: "approved"
    }
  }])
  .send()
```

**Result:**
- Status policy evaluates proof
- Quorum met → `meta.status = "active"` ✅
- Proof added to `meta.proofs[]`

### 3.4 Token Issuance (Step 7)

```tsx
POST /anchors/:consent_id/proofs

const tokens = [
  {
    type: "access",
    hash: sha256(access_token),
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()  // 15 min
  },
  {
    type: "refresh",
    hash: sha256(refresh_token),
    issued_at: new Date().toISOString(),
    expires_at: consent.custom.expires_at  // Until consent expires
  }
]

await sdk.anchor
  .from(currentRecord)
  .sign([{
    keyPair: { public: HUB_SIGNER_PUBLIC, secret: HUB_SIGNER_SECRET },
    custom: {
      event: "tokens.issued",
      timestamp: new Date().toISOString(),
      tokens: tokens,
      actor: "hub"
    }
  }])
  .send()
```

**Result:**
- Tokens stored in `meta.proofs[].custom.tokens`
- NOT in `anchor.custom` (immutable event log principle)

---

## 4. Core Functions

Maps spec Section 5 (Core Functions) to Ledger operations.

### 4.1 F-01: Consent Creation

**Implementation:**

```tsx
async function createConsent(request: ConsentRequest): Promise<Anchor> {
  // 1. Validate scope codes (static validation)
  if (!validateDataScope(request.data_scope)) {
    throw new Error('invalid_scope')
  }

  // 2. Validate purpose code - closed catalogue (static validation)
  if (!VALID_PURPOSE_CODES.includes(request.purpose.code)) {
    throw new Error('invalid_purpose')
  }

  // 3. Generate titular pseudonym (NEVER store raw document)
  const titular_ref = hmac_sha256_pseudonym(request.titular_id)

  // 4. Create anchor in pending status
  // TPP/DP validation will happen via bridge-sfc after creation
  const consent = await sdk.anchor
    .init()
    .data({
      handle: `consent_${uuidv4()}`,
      schema: 'of-consent-v1',
      wallet: titular_ref,
      target: request.tpp_id,
      source: request.data_provider_id,
      custom: {
        consent_id: uuidv4(),
        ...request,
        titular_ref,
        granted_at: null,
        double_check_confirmed_at: null,
        sca_method: null
      }
    })
    .hash()
    .sign([{
      keyPair: HUB_SIGNER,
      custom: {
        status: "pending",
        event: "consent.requested",
        timestamp: new Date().toISOString()
      }
    }])
    .send()

  return consent
}
```

### 4.1.1 TPP/DP Directory Validation (Bridge SFC)

**Problem**: The directory of active TPPs and Data Providers is maintained by SFC (external entity). Policies CANNOT make HTTP calls to external systems.

**Solution**: Implement a **bridge** that queries the SFC directory and adds validation proofs.

### Bridge SFC Architecture

```
┌─────────────┐
│   Ledger    │
│   Consent   │ status: pending
└──────┬──────┘
       │
       │ (1) Notify bridge: validate participant
       ▼
┌─────────────────────┐
│  Bridge SFC         │
│  (External Service) │
├─────────────────────┤
│ GET /directory/tpps │──┐
│ GET /directory/dps  │  │ (2) Query SFC API
└─────────────────────┘  │
                         │
                    ┌────▼─────────────┐
                    │  SFC Directory   │
                    │  API (External)  │
                    └────┬─────────────┘
                         │
                         │ (3) Response: active/inactive/revoked
                         ▼
                    ┌─────────────┐
                    │ Bridge adds │
                    │   proof     │ status: prepared/failed
                    └──────┬──────┘
                           │
                           │ (4) POST /anchors/:handle/proofs
                           ▼
                    ┌─────────────┐
                    │   Consent   │ status: validated
                    │   + Proof   │
                    └─────────────┘
```

### Bridge Implementation

**1. Register the Bridge:**

```bash
minka bridge create \
  --handle bridge-sfc \
  --url https://hub.openfinance.co/sfc-bridge \
  --public <sfc_bridge_public_key>
```

**2. Bridge Endpoints (implement in hub):**

```tsx
// Bridge SFC validates participant registration
app.post('/sfc-bridge/validate', async (req, res) => {
  const { consent_id, tpp_id, data_provider_id } = req.body

  try {
    // Query SFC directory
    const tppStatus = await fetch(`${SFC_API_URL}/directory/tpps/${tpp_id}`)
      .then(r => r.json())

    const dpStatus = await fetch(`${SFC_API_URL}/directory/providers/${data_provider_id}`)
      .then(r => r.json())

    // Check if both are active
    const isValid = tppStatus.status === 'active' && dpStatus.status === 'active'

    if (isValid) {
      // Add "prepared" proof (validation passed)
      await sdk.anchor
        .from(currentConsent)
        .sign([{
          keyPair: BRIDGE_SFC_SIGNER,
          custom: {
            event: 'participant.validated',
            status: 'prepared',
            tpp_status: tppStatus.status,
            dp_status: dpStatus.status,
            sfc_validation_timestamp: new Date().toISOString()
          }
        }])
        .send()

      res.json({ result: 'prepared' })
    } else {
      // Add "failed" proof (validation failed)
      await sdk.anchor
        .from(currentConsent)
        .sign([{
          keyPair: BRIDGE_SFC_SIGNER,
          custom: {
            event: 'participant.validation_failed',
            status: 'failed',
            reason: 'participant_not_active',
            detail: `TPP:${tppStatus.status}, DP:${dpStatus.status}`
          }
        }])
        .send()

      res.json({ result: 'failed', reason: 'participant_not_active' })
    }
  } catch (error) {
    // Add "failed" proof (SFC unreachable)
    await sdk.anchor
      .from(currentConsent)
      .sign([{
        keyPair: BRIDGE_SFC_SIGNER,
        custom: {
          event: 'participant.validation_error',
          status: 'failed',
          reason: 'sfc_directory_unavailable',
          detail: error.message
        }
      }])
      .send()

    res.status(500).json({ result: 'failed', error: error.message })
  }
})
```

**3. Status Policy (requires bridge proof):**

```json
{
  "handle": "consent-validation-policy",
  "schema": "status",
  "record": "anchor",
  "filter": { "schema": "of-consent-v1" },
  "values": [
    {
      "action": "update",
      "status": {
        "from": "pending",
        "to": "validated"
      },
      "quorum": {
        "count": 1,
        "method": "ed25519-v2",
        "proofs": {
          "filter": {
            "custom.event": "participant.validated",
            "custom.status": "prepared"
          }
        },
        "signers": ["bridge-sfc"]
      }
    }
  ]
}
```

**4. Complete Flow:**

```tsx
async function createConsentWithValidation(request: ConsentRequest): Promise<Anchor> {
  // 1. Create consent in pending status
  const consent = await createConsent(request)

  // 2. Trigger bridge validation (async)
  await fetch('https://hub.openfinance.co/sfc-bridge/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consent_id: consent.handle,
      tpp_id: request.tpp_id,
      data_provider_id: request.data_provider_id
    })
  })

  // 3. Bridge will add proof asynchronously
  // Status policy will transition pending → validated when proof arrives

  return consent
}
```

**5. Verify validation:**

```bash
# Check if consent has SFC validation proof
minka anchor show <consent_handle> -v | grep "participant.validated"
```

### Advantages of this approach:

✅ **Separation of concerns**: Ledger doesn’t know about SFC API
✅ **Immutable audit**: Each validation is recorded as a proof
✅ **Retry-able**: If SFC is down, the bridge can retry
✅ **Real-time**: Validates current participant status, not static snapshot
✅ **Policy-driven**: Status transitions require bridge proof
✅ **Traceable**: Timestamp and result of each SFC query

### 4.2 F-02: Gate Function (Consent Verification)

**Implementation: Policy-based Gate**

```json
{
  "handle": "consent-gate-policy",
  "schema": "access",
  "record": "any",
  "values": [
    {
      "action": "read",
      "record": "data-request",
      "filter": {
        "consent_id": { "$exists": true }
      },
      "condition": {
        "$and": [
          { "consent.meta.status": "active" },
          { "consent.custom.expires_at": { "$gt": "$$now" } },
          { "consent.target": "$$request.tpp_id" },
          { "consent.source": "$$request.data_provider_id" }
        ]
      }
    }
  ]
}
```

**Runtime Check:**

```tsx
async function gateCheck(
  consent_id: string,
  requested_scope: string[],
  tpp_id: string,
  data_provider_id: string
): Promise<boolean> {
  // 1. Fetch consent
  const consent = await sdk.anchor.read(consent_id)

  // 2. Status check
  if (consent.meta.status !== 'active') {
    await logGateRejection(consent_id, 'consent_not_active')
    return false
  }

  // 3. Expiration check
  if (new Date() > new Date(consent.anchor.custom.expires_at)) {
    await logGateRejection(consent_id, 'consent_expired')
    return false
  }

  // 4. Scope check
  const authorizedScope = consent.anchor.custom.data_scope
  const scopeValid = requested_scope.every(s => authorizedScope.includes(s))
  if (!scopeValid) {
    await logGateRejection(consent_id, 'scope_exceeded')
    return false
  }

  // 5. TPP match
  if (consent.anchor.target !== tpp_id) {
    await logGateRejection(consent_id, 'tpp_mismatch')
    return false
  }

  // 6. Data Provider match
  if (consent.anchor.source !== data_provider_id) {
    await logGateRejection(consent_id, 'data_provider_mismatch')
    return false
  }

  // 7. Log successful access
  await logDataAccess(consent_id, requested_scope, tpp_id, data_provider_id)

  return true
}

async function logGateRejection(consent_id: string, reason: string) {
  await sdk.anchor.from(currentRecord).sign([{
    keyPair: HUB_SIGNER,
    custom: {
      event: "gate.rejected",
      reason,
      timestamp: new Date().toISOString()
    }
  }]).send()
}
```

**Performance:** < 50ms at p95 (spec NFR-01)

### 4.3 F-03: Double-Check Orchestration

**Implementation:**

```tsx
async function requestDoubleCheckPayload(consent_id: string): Promise<SignedPayload> {
  const consent = await sdk.anchor.read(consent_id)

  const payload = {
    tpp_legal_name: consent.anchor.custom.tpp_legal_name,
    data_scope_labels: translateScopeToHumanReadable(consent.anchor.custom.data_scope),
    purpose_text: consent.anchor.custom.purpose.text,
    duration: {
      from: consent.anchor.custom.granted_at || "upon approval",
      to: consent.anchor.custom.expires_at
    },
    storage_permission: consent.anchor.custom.treatment.storage_permission,
    data_retention_days: consent.anchor.custom.treatment.data_retention_days,
    commercialization_flag: consent.anchor.custom.commercialization.flag
  }

  // Sign with Hub's key (PS256)
  const signature = signPayload(payload, HUB_PRIVATE_KEY)

  return { payload, signature }
}

async function processDoubleCheckConfirmation(
  consent_id: string,
  confirmation: SignedConfirmation
): Promise<void> {
  // 1. Verify Data Provider signature
  if (!verifySignature(confirmation, DATA_PROVIDER_PUBLIC_KEY)) {
    throw new Error('invalid_signature')
  }

  // 2. Record confirmation
  if (confirmation.decision === 'approved') {
    await sdk.anchor.from(currentRecord).sign([{
      keyPair: DATA_PROVIDER_SIGNER,
      custom: {
        status: "active",
        event: "double_check.confirmed",
        timestamp: confirmation.timestamp,
        granted_at: confirmation.timestamp,
        double_check_confirmed_at: new Date().toISOString(),
        sca_method: confirmation.sca_method,
        actor: confirmation.data_provider_id,
        titular_decision: "approved"
      }
    }]).send()
  } else {
    await sdk.anchor.from(currentRecord).sign([{
      keyPair: DATA_PROVIDER_SIGNER,
      custom: {
        status: "denied",
        event: "consent.denied",
        timestamp: new Date().toISOString(),
        actor: confirmation.data_provider_id,
        titular_decision: "denied"
      }
    }]).send()
  }
}
```

### 4.4 F-04: Revocation

**Implementation:**

```tsx
async function revokeConsent(
  consent_id: string,
  actor: 'titular' | 'tpp' | 'data_provider' | 'hub',
  reason: string
): Promise<void> {
  const start = Date.now()

  // 1. Add revocation proof
  await sdk.anchor.from(currentRecord).sign([{
    keyPair: getSignerForActor(actor),
    custom: {
      status: "revoked",
      event: "consent.revoked",
      timestamp: new Date().toISOString(),
      revoked_at: new Date().toISOString(),
      revoked_by: actor,
      revocation_reason: reason,
      actor
    }
  }]).send()

  // 2. Invalidate all tokens
  const tokens = getTokensFromProofs(consent_id)
  await Promise.all(tokens.map(token => invalidateToken(token.hash)))

  // 3. Dispatch webhooks
  await Promise.all([
    sendWebhook(tpp_id, 'consent.revoked', { consent_id, actor, reason }),
    sendWebhook(data_provider_id, 'consent.revoked', { consent_id, actor, reason })
  ])

  const elapsed = Date.now() - start
  console.log(`Revocation completed in${elapsed}ms`)

  // NFR: Must be < 500ms at p99
  if (elapsed > 500) {
    console.warn(`Revocation SLA violated:${elapsed}ms`)
  }
}
```

**SLA:** < 500ms at p99 (spec FR-03)

### 4.5 F-05: Expiration

**Implementation: Scheduled Job**

```tsx
async function expireConsents() {
  const now = new Date().toISOString()

  // Find all active consents past expires_at
  const expiredConsents = await sdk.anchor.list({
    filter: {
      'anchor.schema': 'of-consent-v1',
      'meta.status': 'active',
      'anchor.custom.expires_at': { '$lt': now }
    }
  })

  for (const consent of expiredConsents.anchors) {
    await sdk.anchor.from(consent).sign([{
      keyPair: HUB_SIGNER,
      custom: {
        status: "expired",
        event: "consent.expired",
        timestamp: now,
        actor: "system"
      }
    }]).send()

    // Invalidate tokens
    const tokens = getTokensFromProofs(consent.handle)
    await Promise.all(tokens.map(token => invalidateToken(token.hash)))

    // Send webhooks
    await sendWebhook(consent.target, 'consent.expired', { consent_id: consent.handle })
  }
}

// Run every minute
setInterval(expireConsents, 60 * 1000)
```

### 4.6 F-06: Storage Permission Enforcement

**Implementation:**

```tsx
async function sendDataDeletionSignal(consent_id: string) {
  const consent = await sdk.anchor.read(consent_id)

  // Only send if storage_permission is not PERPETUAL
  if (consent.anchor.custom.treatment.storage_permission === 'PERPETUAL') {
    return
  }

  await sdk.anchor.from(currentRecord).sign([{
    keyPair: HUB_SIGNER,
    custom: {
      event: "deletion_signal.sent",
      timestamp: new Date().toISOString(),
      storage_permission: consent.anchor.custom.treatment.storage_permission,
      data_retention_days: consent.anchor.custom.treatment.data_retention_days,
      acknowledgment_deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString()
    }
  }]).send()

  await sendWebhook(consent.target, 'deletion_signal.sent', {
    consent_id,
    deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString()
  })
}

async function acknowledgeDeletionSignal(consent_id: string, tpp_id: string) {
  await sdk.anchor.from(currentRecord).sign([{
    keyPair: TPP_SIGNER,
    custom: {
      event: "deletion_signal.acknowledged",
      timestamp: new Date().toISOString(),
      actor: tpp_id
    }
  }]).send()
}
```

### 4.7 F-07: Titular Rights Interface

**Implementation:**

```tsx
// Right to Know
async function getTitularConsents(titular_ref: string): Promise<Anchor[]> {
  return sdk.anchor.list({
    filter: {
      'anchor.schema': 'of-consent-v1',
      'anchor.wallet': titular_ref
    }
  })
}

// Right to Revoke
async function titularRevokeConsent(
  consent_id: string,
  reason: string
): Promise<void> {
  return revokeConsent(consent_id, 'titular', reason)
}

// Right to Explanation (Export Event Log)
async function exportConsentEventLog(consent_id: string): Promise<EventLog> {
  const consent = await sdk.anchor.read(consent_id)

  return consent.meta.proofs.map(proof => ({
    event: proof.custom.event,
    timestamp: proof.custom.timestamp || proof.custom.moment,
    actor: proof.custom.actor,
    status: proof.custom.status,
    details: proof.custom
  }))
}
```

### 4.8 F-08: Audit Trail

**Already implemented via `meta.proofs[]`!**

Every proof is:
- ✅ Append-only
- ✅ Cryptographically signed
- ✅ Timestamp on each event
- ✅ 5-year retention (ledger policy)
- ✅ Available to SFC on demand

```tsx
// Export full audit for SFC
async function exportConsentAudit(
  from_date: string,
  to_date: string
): Promise<AuditExport> {
  const consents = await sdk.anchor.list({
    filter: {
      'anchor.schema': 'of-consent-v1',
      'meta.moment': { '$gte': from_date, '$lte': to_date }
    }
  })

  return consents.anchors.map(consent => ({
    consent_id: consent.handle,
    titular_ref: consent.wallet,
    tpp_id: consent.target,
    data_provider_id: consent.source,
    status: consent.meta.status,
    event_log: consent.meta.proofs.map(p => p.custom)
  }))
}
```

---

*To be continued in next message…*

## 5. Authentication & Security

Maps spec Section 6 (NFR-03, NFR-04) to Ledger security features.

### 5.1 Signer Management

**Actor-to-Signer Mapping:**

```tsx
// Hub operator signer
const HUB_SIGNER = {
  public: "hub_operator_key_base64",
  secret: "hub_operator_secret_base64",
  format: "ed25519-raw"
}

// TPP signer (registered per TPP)
const TPP_SIGNERS = {
  "col-tpp-00421": {
    public: "tpp_crediviva_key_base64",
    secret: "tpp_crediviva_secret_base64",
    format: "ed25519-raw"
  }
}

// Data Provider signer (registered per DP)
const DP_SIGNERS = {
  "col-dp-00018": {
    public: "bancolombia_key_base64",
    secret: "bancolombia_secret_base64",
    format: "ed25519-raw"
  }
}
```

**Signer Registration:**

```bash
# Register Hub signer
minka signer create
  --handle hub-operator-1
  --public <base64_public_key>
  --secret <base64_secret_key>

# Register TPP signer
minka signer create
  --handle col-tpp-00421
  --public <tpp_public_key>
  --secret <tpp_secret_key>
  --custom '{"entity_type":"tpp","sfc_id":"col-tpp-00421"}'

# Register Data Provider signer
minka signer create
  --handle col-dp-00018
  --public <dp_public_key>
  --secret <dp_secret_key>
  --custom '{"entity_type":"data_provider","sfc_id":"col-dp-00018"}'
```

### 5.2 Strong Customer Authentication (SCA)

**Spec Requirement (NFR-04):** Minimum 2 factors

**Implementation Pattern:**

```tsx
interface SCAMethod {
  factors: string[]  // Min 2 required
}

const VALID_SCA_METHODS = [
  "password+otp",
  "password+biometric_face_id",
  "password+biometric_fingerprint",
  "biometric_fingerprint+otp",
  "biometric_face_id+hardware_token",
  "totp+hardware_token"
]

function validateSCAMethod(sca_method: string): boolean {
  const factors = sca_method.split('+')
  return factors.length >= 2 && VALID_SCA_METHODS.includes(sca_method)
}
```

**Recorded in Proof:**

```tsx
{
  "custom": {
    "event": "sca.completed",
    "sca_method": "password+otp",  // Multi-factor
    "timestamp": "2026-06-04T10:00:00Z",
    "actor": "col-dp-00018"
  }
}
```

### 5.3 Titular Pseudonymization

**Spec Requirement:** HMAC-derived pseudonym (Ley 1581/2012)

**Implementation:**

```tsx
import { createHmac } from 'crypto'

const TITULAR_HMAC_SECRET = process.env.TITULAR_HMAC_SECRET  // Secure storage

function generateTitularRef(document_number: string): string {
  const hmac = createHmac('sha256', TITULAR_HMAC_SECRET)
    .update(document_number)
    .digest('hex')

  return `hmac_sha256_${hmac}`
}

// Example:
// Input:  "1234567890" (document number)
// Output: "hmac_sha256_a3f9c2d1..."

// NEVER store raw document number in consent record
// ALWAYS use titular_ref as wallet identifier
```

### 5.4 Token Security

**Access Token (JWT, PS256):**

```tsx
interface AccessTokenClaims {
  consent_id: string
  scope: string[]
  tpp_id: string
  data_provider_id: string
  exp: number  // 15 minutes from iat
  iat: number
  jti: string
  iss: "hub-operator"
  aud: "data-provider"
}

function issueAccessToken(consent: Anchor): string {
  const claims: AccessTokenClaims = {
    consent_id: consent.handle,
    scope: consent.anchor.custom.data_scope,
    tpp_id: consent.anchor.target,
    data_provider_id: consent.anchor.source,
    exp: Math.floor(Date.now() / 1000) + 15 * 60,  // 15 min
    iat: Math.floor(Date.now() / 1000),
    jti: uuidv4(),
    iss: "hub-operator",
    aud: consent.anchor.source
  }

  return jwt.sign(claims, HUB_PRIVATE_KEY_PS256, { algorithm: 'PS256' })
}
```

**Refresh Token:**

```tsx
interface RefreshToken {
  consent_id: string
  token_id: string
  issued_at: string
  expires_at: string  // Same as consent.custom.expires_at
  revoked_at: string | null
}

// Refresh tokens are stored in proofs, not as JWTs
// They're references that can be revoked instantly
```

---

## 6. API Implementation

Maps spec Section 6.4 (API Interface Summary) to HTTP endpoints over Ledger operations.

### 6.1 TPP-Facing Endpoints

### POST /consents

Create new consent request.

```tsx
app.post('/consents', async (req, res) => {
  try {
    // 1. Validate request
    validateConsentRequest(req.body)

    // 2. Create anchor
    const consent = await createConsent(req.body)

    // 3. Return redirect URL
    res.status(201).json({
      consent_id: consent.anchor.handle,
      status: consent.meta.status,
      authorization_url: buildAuthorizationURL(consent)
    })
  } catch (error) {
    handleConsentError(error, res)
  }
})
```

### GET /consents/:consent_id

Retrieve consent status.

```tsx
app.get('/consents/:consent_id', async (req, res) => {
  const consent = await sdk.anchor.read(req.params.consent_id)

  res.json({
    consent_id: consent.anchor.handle,
    status: consent.meta.status,
    tpp_id: consent.anchor.target,
    data_provider_id: consent.anchor.source,
    data_scope: consent.anchor.custom.data_scope,
    purpose: consent.anchor.custom.purpose,
    expires_at: consent.anchor.custom.expires_at,
    granted_at: consent.anchor.custom.granted_at,
    revoked_at: consent.anchor.custom.revoked_at
  })
})
```

### POST /consents/:consent_id/revoke

Revoke consent.

```tsx
app.post('/consents/:consent_id/revoke', async (req, res) => {
  await revokeConsent(
    req.params.consent_id,
    'tpp',
    req.body.reason || 'TPP-initiated revocation'
  )

  res.status(200).json({ status: 'revoked' })
})
```

### POST /token

Exchange authorization code for tokens.

```tsx
app.post('/token', async (req, res) => {
  // 1. Validate authorization code + PKCE
  const code = validateAuthorizationCode(req.body.code, req.body.code_verifier)

  // 2. Verify consent is active with double-check
  const consent = await sdk.anchor.read(code.consent_id)

  if (consent.meta.status !== 'active') {
    return res.status(403).json({ error: 'consent_not_active' })
  }

  if (!consent.anchor.custom.double_check_confirmed_at) {
    return res.status(403).json({ error: 'consent_unconfirmed' })
  }

  // 3. Issue tokens
  const access_token = issueAccessToken(consent)
  const refresh_token = issueRefreshToken(consent)

  // 4. Record token issuance in proof
  await recordTokenIssuance(consent, access_token, refresh_token)

  res.json({
    access_token,
    refresh_token,
    token_type: 'Bearer',
    expires_in: 900,  // 15 min
    consent_id: consent.anchor.handle
  })
})
```

### 6.2 Data Provider-Facing Endpoints

### POST /consents/:consent_id/double-check

Submit Titular approval/denial.

```tsx
app.post('/consents/:consent_id/double-check', async (req, res) => {
  const confirmation = req.body

  // 1. Verify Data Provider signature
  if (!verifyDataProviderSignature(confirmation)) {
    return res.status(401).json({ error: 'invalid_signature' })
  }

  // 2. Process confirmation
  await processDoubleCheckConfirmation(
    req.params.consent_id,
    confirmation
  )

  res.status(200).json({ status: 'confirmed' })
})
```

### GET /consents/:consent_id/validate

Validate consent before releasing data (Gate Function).

```tsx
app.get('/consents/:consent_id/validate', async (req, res) => {
  const { tpp_id, data_provider_id, scope } = req.query

  const isValid = await gateCheck(
    req.params.consent_id,
    scope.split(','),
    tpp_id,
    data_provider_id
  )

  res.json({
    consent_id: req.params.consent_id,
    valid: isValid,
    timestamp: new Date().toISOString()
  })
})
```

### 6.3 Titular-Facing Endpoints

### GET /titular/consents

List all consents for a Titular.

```tsx
app.get('/titular/consents', async (req, res) => {
  // Titular authenticated via OAuth/OIDC
  const titular_ref = req.user.titular_ref

  const consents = await sdk.anchor.list({
    filter: {
      'anchor.schema': 'of-consent-v1',
      'anchor.wallet': titular_ref
    }
  })

  res.json({
    consents: consents.anchors.map(c => ({
      consent_id: c.handle,
      tpp_legal_name: c.custom.tpp_legal_name,
      data_scope: c.custom.data_scope,
      purpose: c.custom.purpose,
      status: c.meta.status,
      granted_at: c.custom.granted_at,
      expires_at: c.custom.expires_at
    }))
  })
})
```

### GET /titular/consents/:consent_id

Get full consent detail including event log.

```tsx
app.get('/titular/consents/:consent_id', async (req, res) => {
  const consent = await sdk.anchor.read(req.params.consent_id)

  // Verify titular owns this consent
  if (consent.anchor.wallet !== req.user.titular_ref) {
    return res.status(403).json({ error: 'forbidden' })
  }

  res.json({
    consent: consent.anchor.custom,
    status: consent.meta.status,
    event_log: consent.meta.proofs.map(p => ({
      event: p.custom.event,
      timestamp: p.custom.timestamp,
      actor: p.custom.actor,
      details: p.custom
    }))
  })
})
```

---

## 7. Compliance Mapping

Maps spec Section 7 (Compliance Map) to Ledger implementation.

| Regulatory Requirement | Implementation |
| --- | --- |
| **Consent must be prior, express, informed** | Anchors created in `pending` status; activation requires double-check proof |
| **9 mandatory fields** | Schema validation enforces all required fields in `custom` |
| **No open-ended authorizations** | `purpose.code` must be in closed catalogue; validated at creation |
| **No conditioning product access** | Policy enforcement (not technical gate) |
| **Double-check before data circulation** | Gate checks `double_check_confirmed_at` field; rejects if null |
| **Strong authentication (min 2 factors)** | `sca_method` must match pattern `factor1+factor2` |
| **Right to know** | Titular API returns all consents via wallet filter |
| **Right to revoke** | Revocation proof → status transition → token invalidation |
| **Right to abstain** | Denial proof recorded with same durability as approval |
| **Right to explanation** | `meta.proofs[]` exportable as structured event log |
| **Responsabilidad demostrada** | Immutable `meta.proofs[]` = append-only audit store |
| **Circulación restringida** | Storage permission enforcement + deletion signal proofs |
| **Data commercialization requires consent** | `commercialization.flag` mandatory field |
| **Audit log 5-year retention** | Ledger retention policy for anchors + proofs |
| **FAPI 2.0 security** | JWT PS256 tokens + mTLS + PKCE + JARM |
| **Network isolation** | Ledger deployment on isolated network (infrastructure) |
| **Availability SLAs** | Ledger redundancy + load balancing (infrastructure) |
| **ISO 20022 data dictionary** | `data_scope` codes mapped to ISO 20022 fields |

---

## 8. Deployment Guide

### 8.1 Schema Registration

```bash
# 1. Register consent schema
minka schema create
  --handle of-consent-v1
  --record anchor
  --format json-schema
  --schema @docs/schemas/consent-anchor-schema-v2.json

# Verify
minka schema show of-consent-v1
```

### 8.2 Policy Registration

```bash
# 2. Register status policy
minka policy create
  --handle of-consent-status-policy
  --schema status
  --record anchor
  --filter '{"schema":"of-consent-v1"}'
  --values @docs/policies/consent-status-policy-v2.json

# 3. Register access policy
minka policy create
  --handle of-consent-access-policy
  --schema access
  --record any
  --values @docs/policies/consent-access-policy-v2.json

# Verify
minka policy show of-consent-status-policy
minka policy show of-consent-access-policy
```

### 8.3 Signer Setup

```bash
# 4. Create Hub operator signer
minka signer create
  --handle hub-operator-1
  --public <hub_public_key>
  --secret <hub_secret_key>

# 5. Create TPP signers (one per TPP)
for tpp in $(cat tpp_directory.json | jq -r '.[]'); do
  minka signer create \
    --handle "$tpp.id" \
    --public "$tpp.public_key" \
    --secret "$tpp.secret_key"
done

# 6. Create Data Provider signers
for dp in $(cat dp_directory.json | jq -r '.[]'); do
  minka signer create \
    --handle "$dp.id" \
    --public "$dp.public_key" \
    --secret "$dp.secret_key"
done
```

### 8.4 Environment Variables

```bash
# Required environment variables
export LEDGER_URL="https://ledger.hub.co/api/v2"
export HUB_SIGNER_PUBLIC="..."
export HUB_SIGNER_SECRET="..."
export TITULAR_HMAC_SECRET="..."  # For pseudonymization
export HUB_PRIVATE_KEY_PS256="..."  # For JWT signing
export SFC_DIRECTORY_URL="https://sfc.gov.co/directory"
```

### 8.5 Verification

```bash
# Test consent creation
curl -X POST https://api.hub.co/consents \
  -H "Content-Type: application/json" \
  -d @test_consent.json

# Verify in ledger
minka anchor list --filter '{"anchor.schema":"of-consent-v1"}'

# Check a specific consent
minka anchor show <consent_id> -v
```

---

## 9. Performance Targets

| Operation | Target | Implementation |
| --- | --- | --- |
| **Gate check** | < 50ms p95 | Anchor read + policy evaluation |
| **Revocation propagation** | < 500ms p99 | Proof addition + webhook dispatch |
| **Consent creation** | < 200ms p95 | Anchor creation with proof |
| **Token issuance** | < 100ms p95 | JWT signing + proof addition |
| **Titular rights API** | < 150ms p95 | Anchor list with wallet filter |

**Monitoring:**

```tsx
// Gate function with latency tracking
async function gateCheckWithMetrics(consent_id: string) {
  const start = Date.now()

  const result = await gateCheck(consent_id, ...)

  const latency = Date.now() - start
  metrics.record('gate.latency', latency)

  if (latency > 50) {
    console.warn(`Gate check p95 SLA violated:${latency}ms`)
  }

  return result
}
```

---

## 10. Migration Path

### From V1 Schema to V2 (if applicable)

```tsx
async function migrateConsentV1ToV2(consent_id: string) {
  // 1. Read V1 consent
  const v1 = await sdk.anchor.read(consent_id)

  // 2. Transform to V2 structure
  const v2_custom = {
    ...v1.anchor.custom,
    purpose: {
      code: inferPurposeCode(v1.anchor.custom.purpose),
      text: v1.anchor.custom.purpose
    },
    treatment: {
      storage_permission: "DURATION_BOUND",
      data_retention_days: v1.anchor.custom.duration_days,
      mode: "STORE"
    },
    commercialization: {
      flag: v1.anchor.custom.commercialization_flag,
      compensation_offered: v1.anchor.custom.compensation_flag
    }
  }

  // 3. Create new V2 anchor
  const v2 = await sdk.anchor.init().data({
    handle: `consent_v2_${v1.anchor.handle}`,
    schema: 'of-consent-v1',
    wallet: v1.anchor.wallet,
    target: v1.anchor.target,
    source: v1.anchor.source,
    custom: v2_custom
  }).sign([...]).send()

  // 4. Add migration proof to both
  await addMigrationProof(v1, v2)
}
```

---

## 11. Testing Guide

### Unit Tests

```tsx
describe('Consent Creation', () => {
  it('should create consent in pending status', async () => {
    const consent = await createConsent(mockRequest)
    expect(consent.meta.status).toBe('pending')
  })

  it('should reject consent without purpose.code', async () => {
    await expect(createConsent({ ...mockRequest, purpose: { text: "..." } }))
      .rejects.toThrow('invalid_purpose')
  })
})

describe('Gate Function', () => {
  it('should pass gate for active consent with valid scope', async () => {
    const result = await gateCheck(consent_id, ['ACCOUNTS_READ'], tpp_id, dp_id)
    expect(result).toBe(true)
  })

  it('should reject gate for expired consent', async () => {
    // Set consent.custom.expires_at to past
    const result = await gateCheck(expired_consent_id, ['ACCOUNTS_READ'], tpp_id, dp_id)
    expect(result).toBe(false)
  })
})
```

### Integration Tests

```bash
# Test full flow
npm run test:integration

# Test sequence:
# 1. Create consent (pending)
# 2. Simulate SCA
# 3. Submit double-check (active)
# 4. Issue tokens
# 5. Gate check (pass)
# 6. Revoke consent
# 7. Gate check (fail)
```

---

## 12. Troubleshooting

### Common Issues

**Consent stuck in pending:**

```bash
# Check for double-check confirmation
minka anchor show <consent_id> -v | grep "double_check"

# If missing, Data Provider never confirmed
# Check webhook logs for delivery failures
```

**Gate rejections:**

```bash
# View gate rejection events
minka anchor show <consent_id> -v | grep "gate.rejected"

# Common reasons:
# - scope_exceeded: requested data not in data_scope
# - consent_expired: past expires_at
# - tpp_mismatch: wrong TPP ID
```

**Status not changing:**

```bash
# Check status policy
minka policy show of-consent-status-policy

# Verify quorum is met
# Check if proof has status field
```

---

## 13. Resources

- **Schema:** `docs/schemas/consent-anchor-schema-v2.json`
- **Policies:** `docs/policies/consent-*-policy-v2.json`
- **Scripts:** `scripts/create-consent-*.ts`
- **Architecture:** `docs/TOKENS-ARCHITECTURE.md`
- **Spec:** `/Users/ximenalopezcifuentes/Downloads/consent_engine_full_spec_1.md`

---

**Document Version:** 1.0
**Last Updated:** June 2026
**Status:** Implementation Ready ✅