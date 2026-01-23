# Payment Simulator - API REST

Base URL: `http://localhost:10100/api`

## Reloj de simulación

### GET /clock

Devuelve el estado actual del reloj simulado.

**Respuesta:**
```json
{
  "simTimeMs": 1735689600000,
  "tick": 60000,
  "isPaused": false
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| simTimeMs | number | Tiempo simulado actual (milisegundos epoch) |
| tick | number | Milisegundos que avanzan por segundo real |
| isPaused | boolean | Si el reloj está pausado |

### POST /admin/clock/pause

Pausa el reloj de simulación.

### POST /admin/clock/play

Reanuda el reloj de simulación.

### POST /admin/clock/faster

Acelera el reloj (x2). Valores: x60 → x120 → x240 → x480...

### POST /admin/clock/slower

Desacelera el reloj (/2). Mínimo: x60.

---

## Bancos

### GET /banks

Lista todos los bancos registrados.

**Respuesta:**
```json
[
  {
    "id": "B_0001",
    "name": "Bank of America",
    "baseCurrency": "USD",
    "createdAtMs": 1735689600000
  }
]
```

### POST /banks

Crea un nuevo banco.

**Body:**
```json
{
  "name": "Deutsche Bank",
  "baseCurrency": "EUR"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| name | string | Si | Nombre del banco (único) |
| baseCurrency | string | Si | Divisa base (3 caracteres: USD, EUR, GBP, CHF, JPY, HKD, MXN) |

**Respuesta:**
```json
{ "id": "B_0002" }
```

---

## Clientes

### GET /clients

Lista todos los clientes con sus balances.

**Respuesta:**
```json
[
  {
    "id": "C_0001",
    "bankId": "B_0001",
    "name": "Alice",
    "type": "REGULAR",
    "balances": [
      { "currency": "USD", "amount": 1000 },
      { "currency": "EUR", "amount": 500 }
    ]
  }
]
```

| Campo type | Descripción |
|------------|-------------|
| REGULAR | Cliente normal que puede hacer pagos y depósitos |
| VOSTRO | Cuenta espejo de un banco corresponsal (creada automáticamente) |

### POST /banks/:bankId/clients

Crea un cliente REGULAR en un banco.

**Body:**
```json
{ "name": "Alice" }
```

**Respuesta:**
```json
{ "id": "C_0001" }
```

### POST /clients/:clientId/deposit

Deposita fondos en la cuenta de un cliente.

**Body:**
```json
{
  "currency": "USD",
  "amount": 1000
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| currency | string | Si | Divisa del depósito (3 caracteres) |
| amount | number | Si | Cantidad a depositar (> 0) |

**Restricciones:**
- Solo clientes REGULAR pueden recibir depósitos
- Si la divisa es diferente a la base del banco, el banco debe tener un Nostro en esa divisa

**Respuesta:**
```json
{ "ok": true }
```

---

## Cuentas Nostro/Vostro

### GET /nostros

Lista todas las cuentas Nostro.

**Respuesta:**
```json
[
  {
    "id": "N_0001",
    "ownerBankId": "B_0001",
    "correspondentBankId": "B_0002",
    "currency": "EUR",
    "balance": 500,
    "createdAtMs": 1735689600000
  }
]
```

### POST /correspondents/nostro

Crea una cuenta Nostro (y su Vostro espejo automáticamente).

**Body:**
```json
{
  "ownerBankId": "B_0001",
  "correspondentBankId": "B_0002"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| ownerBankId | string | Si | Banco que abre la cuenta Nostro |
| correspondentBankId | string | Si | Banco corresponsal donde se abre |

**Restricciones:**
- La divisa de la cuenta Nostro es la divisa base del banco corresponsal
- No se puede crear Nostro en la propia divisa base del banco owner
- Solo se permite un corresponsal por divisa por banco

**Respuesta:**
```json
{
  "nostroId": "N_0001",
  "vostroClientId": "C_0003"
}
```

---

## Pagos

### GET /payments

Lista todos los pagos con sus rutas.

**Respuesta:**
```json
[
  {
    "id": "P_0001",
    "fromClientId": "C_0001",
    "toClientId": "C_0002",
    "fromBankId": "B_0001",
    "toBankId": "B_0002",
    "debitCurrency": "USD",
    "creditCurrency": "EUR",
    "debitAmount": 100,
    "creditAmount": 85,
    "settlementCurrency": "EUR",
    "state": "SETTLED",
    "failReason": null,
    "createdAtMs": 1735689600000,
    "executedAtMs": 1735689660000,
    "settledAtMs": 1735689660000,
    "route": ["B_0001", "B_0002"]
  }
]
```

### POST /payments

Crea una intención de pago.

**Body:**
```json
{
  "fromClientId": "C_0001",
  "toClientId": "C_0002",
  "debitCurrency": "USD",
  "creditCurrency": "EUR",
  "debitAmount": 100
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| fromClientId | string | Si | Cliente que envía el pago |
| toClientId | string | Si | Cliente que recibe el pago |
| debitCurrency | string | Si | Divisa que se debita al emisor |
| creditCurrency | string | Si | Divisa que se acredita al receptor |
| debitAmount | number | Si | Cantidad a debitar (> 0) |

**Validaciones:**
- Solo clientes REGULAR pueden enviar pagos
- El cliente emisor debe tener balance > 0 en la divisa de débito
- La divisa de crédito debe estar disponible en el banco destino
- Debe existir una ruta válida entre los bancos

**Respuesta:**
```json
{
  "id": "P_0001",
  "state": "QUEUED",
  "route": ["B_0001", "B_0002"],
  "creditAmount": 85
}
```

### Estados de pago

| Estado | Descripción |
|--------|-------------|
| QUEUED | Pago creado, esperando a que se abra la ventana de clearing |
| EXECUTED | Pago procesado, cuentas ajustadas |
| SETTLED | Pago completado |
| FAILED | Pago fallido (fondos insuficientes, sin ruta, etc.) |

**Flujo:** `QUEUED` → `EXECUTED` → `SETTLED` (o `QUEUED` → `FAILED`)

---

## Tipos de cambio (FX)

### GET /fx

Devuelve los tipos de cambio actuales (USD como pivot).

**Respuesta:**
```json
[
  { "quoteCurrency": "EUR", "rate": "0.85" },
  { "quoteCurrency": "GBP", "rate": "0.77" },
  { "quoteCurrency": "CHF", "rate": "0.95" },
  { "quoteCurrency": "JPY", "rate": "150" },
  { "quoteCurrency": "HKD", "rate": "7.80" },
  { "quoteCurrency": "MXN", "rate": "20.00" }
]
```

El rate indica cuántas unidades de la quoteCurrency equivalen a 1 USD.

### GET /fx-history

Historial de conversiones FX realizadas.

**Respuesta:**
```json
[
  {
    "id": 1,
    "paymentId": "P_0001",
    "bankId": "B_0001",
    "bankName": "Bank of America",
    "fromCurrency": "USD",
    "toCurrency": "EUR",
    "fromAmount": 100,
    "toAmount": 85,
    "rate": 0.85,
    "createdAtMs": 1735689660000,
    "reason": "Payment origin FX"
  }
]
```

---

## Clearing

### GET /clearing-hours

Devuelve los horarios de clearing por divisa (CET).

**Respuesta:**
```json
[
  { "currency": "USD", "openHour": 13, "closeHour": 22 },
  { "currency": "EUR", "openHour": 8, "closeHour": 17 },
  { "currency": "GBP", "openHour": 7, "closeHour": 16 },
  { "currency": "CHF", "openHour": 8, "closeHour": 17 },
  { "currency": "JPY", "openHour": 0, "closeHour": 9 },
  { "currency": "HKD", "openHour": 0, "closeHour": 9 },
  { "currency": "MXN", "openHour": 14, "closeHour": 23 }
]
```

Los pagos solo se procesan cuando la ventana de clearing de la divisa de liquidación está abierta.

---

## Administración

### POST /admin/reset

Reinicia toda la simulación (borra bancos, clientes, pagos, reloj).

**Respuesta:**
```json
{ "ok": true }
```

### POST /admin/reset-clock

Reinicia solo el reloj de simulación al epoch inicial.

**Respuesta:**
```json
{ "ok": true }
```

---

## Errores

Todos los errores se devuelven con status HTTP 400 y body en texto plano:

```
Error: Only REGULAR clients can make payments
```

Errores comunes:
- `Only REGULAR clients can make payments` - Intento de pago desde cuenta VOSTRO
- `Client has no funds in {currency}` - Balance insuficiente
- `Currency {X} is not available at destination bank` - Divisa no soportada en destino
- `No route found` - No hay camino entre bancos en la divisa de liquidación
- `Bank {id} already has a correspondent for currency {X}` - Nostro duplicado

---

## Monedas soportadas

| Código | Moneda |
|--------|--------|
| USD | Dólar estadounidense |
| EUR | Euro |
| GBP | Libra esterlina |
| CHF | Franco suizo |
| JPY | Yen japonés |
| HKD | Dólar de Hong Kong |
| MXN | Peso mexicano |
