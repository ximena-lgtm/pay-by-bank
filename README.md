# Pay by Bank · Uber Demo

Demo interactivo del caso de uso **PISP Pay by Bank** bajo el framework de Open Finance Colombia (Decreto 368/2026).

## Flujo implementado

| # | Pantalla | Actor |
|---|----------|-------|
| S1 | Seleccionar método de pago | Uber (TPP) |
| S1b | Seleccionar banco habilitado PISP | Uber (TPP) |
| S2 | Instrumento de pago · consentimiento | Hub (Open Finance Hub) |
| S3 | SCA — Autenticar y autorizar débito | Nu (Data Provider / banco) |
| S4 | Viaje en curso · pago ejecutado | Uber (TPP) |
| S5 | Viaje completado · recibo | Uber (TPP) |

## Arrancar

### Backend (mocks de ledger)

```bash
cd backend
npm install
npm run dev
# → http://localhost:3002
```

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5175
```

## Endpoints del backend

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/trip` | Datos del viaje |
| GET | `/api/banks` | Directorio SFC · bancos PISP habilitados |
| POST | `/api/payment/initiate` | Crear instrumento PISP (mock ledger) |
| POST | `/api/payment/authorize` | SCA · ejecutar débito (mock ledger) |
| GET | `/api/payment/:id` | Estado del pago |
| POST | `/api/trip/complete` | Completar viaje · generar recibo |

## Stack

- **Frontend**: React 18 + Vite + React Router v6
- **Backend**: Node.js + Express (ESM)
- **Design**: Tokens del diseño en Figma — paleta Revolut (Shark #0d0f11), Nu purple #8A05BE, green #2EB87A
