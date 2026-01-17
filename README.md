# Payment Simulator

Simulador educativo de pagos internacionales que modela el flujo de transferencias entre bancos, conversiones de divisas y liquidación a través de redes de corresponsalía.

## Características

- **Red de bancos corresponsales**: Visualización interactiva D3.js con grafo de bancos agrupados por moneda base
  - Nodos arrastrables con persistencia en localStorage
  - Zonas de divisas arrastrables desde el centro
  - Tamaño dinámico de zonas según número de bancos
  - Conexiones Nostro/Vostro visualizadas
- **Pagos transfronterizos**: Simulación completa del ciclo de vida de pagos internacionales
- **Conversión de divisas (FX)**: Sistema de tipos de cambio con pivot en USD (7 divisas)
- **Cuentas Nostro/Vostro**: Implementación del modelo de cuentas interbancarias
- **Horarios de clearing**: Simulación de ventanas de liquidación por moneda con zona horaria CET
- **Motor de enrutamiento**: Encuentra rutas óptimas entre bancos para liquidación
- **Reloj simulado**: Sistema tick-based con control de velocidad (pause/play/faster/slower)
  - Tiempo simulado independiente del tiempo real
  - Velocidad ajustable (x60, x120, x240, etc.)
  - Visualización en formato CET

## Estructura del proyecto

```
Payments Simulator/
├── server/
│   ├── domain/          # Lógica de negocio
│   │   ├── payments.js  # Gestión de pagos
│   │   ├── fx.js        # Conversión de divisas
│   │   ├── nostroVostro.js  # Cuentas corresponsales
│   │   ├── routing.js   # Enrutamiento interbancario
│   │   ├── clearing.js  # Horarios de liquidación
│   │   ├── balances.js  # Gestión de saldos
│   │   ├── accounts.js  # Bancos y clientes
│   │   ├── money.js     # Precisión decimal
│   │   ├── clock.js     # Tiempo simulado (tick-based)
│   │   ├── ids.js       # Generación de IDs
│   │   └── invariants.js # Validaciones
│   ├── app.js          # Express app
│   ├── api.js          # API endpoints
│   ├── engine.js       # Motor de procesamiento
│   ├── config.js       # Configuración (divisas, FX, horarios)
│   └── db.js           # Base de datos SQLite
├── web/
│   └── src/
│       ├── components/
│       │   └── BankNetworkGraph.jsx  # Grafo D3.js interactivo
│       ├── pages/
│       │   ├── Dashboard.jsx    # Red y pagos
│       │   ├── BankDetails.jsx  # Detalles de bancos
│       │   ├── Payments.jsx     # Crear pagos
│       │   └── FX.jsx           # Tipos de cambio
│       ├── layout/
│       │   └── RootLayout.jsx   # Layout principal con reloj
│       ├── App.jsx
│       └── api.js
└── data/                # Base de datos SQLite
```

## Tecnologías

### Backend
- **Node.js** + **Express**: API REST
- **better-sqlite3**: Base de datos embebida
- **decimal.js**: Cálculos monetarios de precisión
- **zod**: Validación de esquemas

### Frontend
- **React 18** + **Vite**: Interfaz de usuario
- **React Router**: Navegación
- **D3.js v7**: Visualización interactiva de red de bancos (grafo con drag & drop)
- **SVG**: Renderizado de gráficos

## Instalación

```bash
cd "Payments Simulator"
npm install
```

## Uso

### Modo desarrollo
```bash
npm run dev
```
Inicia el servidor en modo desarrollo con Vite HMR

### Modo producción
```bash
npm run build  # Construye el frontend
npm start      # Inicia el servidor de producción
```

La aplicación estará disponible en `http://localhost:10100`

## Conceptos clave

### Pagos transfronterizos
El sistema simula el flujo completo de un pago internacional:

1. **Iniciación**: Cliente origina pago con moneda de débito
2. **FX origen** (si aplica): Conversión a moneda de liquidación
3. **Enrutamiento**: Encuentra ruta entre bancos usando cuentas Nostro
4. **Liquidación interbancaria**: Ajuste de cuentas Nostro/Vostro
5. **FX destino** (si aplica): Conversión a moneda de crédito
6. **Abono**: Cliente beneficiario recibe fondos

### Cuentas Nostro/Vostro
- **Nostro** ("nuestro"): Cuenta que un banco mantiene en otro banco corresponsal
- **Vostro** ("vuestro"): Cuenta que un banco corresponsal mantiene para nosotros
- Son la misma cuenta vista desde perspectivas opuestas

### Enrutamiento
El sistema encuentra automáticamente rutas óptimas entre bancos:
- Minimiza saltos intermedios
- Verifica disponibilidad de Nostros en la moneda de liquidación
- Prefiere rutas directas cuando están disponibles

### Motor de procesamiento
Un motor automático procesa pagos en cola cada 500ms:
- Solo procesa durante horarios de clearing abiertos
- Ejecuta transacciones de forma atómica
- Registra mensajes de auditoría en cada paso

## Configuración

La configuración principal está en `server/config.js`:

```javascript
// Puerto del servidor
export const SERVER_PORT = 10100;

// Archivo de base de datos
export const DB_FILE_PATH = '../data/payment-simulator.sqlite';

// Divisas soportadas
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'MXN', 'HKD'];

// Tipos de cambio con USD como pivot
export const FX_USD_PIVOT_RATES = {
  EUR: '0.85',
  GBP: '0.77',
  CHF: '0.95',
  JPY: '150',
  HKD: '7.80',
  MXN: '20.00'
};

// Horarios de clearing en CET
export const CLEARING_HOURS = {
  USD: { openHour: 13, closeHour: 22 },
  EUR: { openHour: 8, closeHour: 17 },
  GBP: { openHour: 7, closeHour: 16 },
  CHF: { openHour: 8, closeHour: 17 },
  JPY: { openHour: 0, closeHour: 9 },
  HKD: { openHour: 0, closeHour: 9 },
  MXN: { openHour: 14, closeHour: 23 }
};

// Época de simulación (1 enero 2026, 09:00 UTC)
export const SIM_EPOCH_MS = Date.UTC(2026, 0, 1, 9, 0, 0);
```

## API Endpoints

```
GET  /api/banks           # Lista todos los bancos
POST /api/banks           # Crea un nuevo banco
GET  /api/clients         # Lista todos los clientes
POST /api/banks/:id/clients  # Crea cliente en un banco
GET  /api/nostros         # Lista cuentas Nostro
POST /api/correspondents/nostro  # Crea cuenta Nostro + Vostro espejo
GET  /api/payments        # Lista todos los pagos
POST /api/payments        # Crea intención de pago
GET  /api/fx              # Tipos de cambio actuales
GET  /api/fx-history      # Historial de conversiones FX
GET  /api/clearing-hours  # Horarios de clearing
GET  /api/clock           # Tiempo de simulación actual
POST /api/admin/clock/pause   # Pausa el reloj
POST /api/admin/clock/play    # Reanuda el reloj
POST /api/admin/clock/faster  # Acelera el reloj (x2)
POST /api/admin/clock/slower  # Desacelera el reloj (/2)
POST /api/admin/reset         # Reinicia toda la simulación
POST /api/admin/reset-clock   # Reinicia solo el reloj
```

## Estados de pago

- **QUEUED**: Pago creado, esperando horario de clearing
- **EXECUTED**: Pago procesado y liquidado
- **SETTLED**: Pago completado
- **FAILED**: Pago falló (ej. fondos insuficientes, sin ruta)

## Monedas soportadas

- USD (Dólar estadounidense)
- EUR (Euro)
- GBP (Libra esterlina)
- CHF (Franco suizo)
- JPY (Yen japonés)
- HKD (Dólar de Hong Kong)
- MXN (Peso mexicano)

### Tipos de cambio (USD como pivot)

Los tipos de cambio están configurados en `server/config.js`:

```javascript
FX_USD_PIVOT_RATES = {
  EUR: '0.85',
  GBP: '0.77',
  CHF: '0.95',
  JPY: '150',
  HKD: '7.80',
  MXN: '20.00'
}
```

### Horarios de clearing (CET)

Cada divisa tiene horarios de liquidación específicos configurados en `server/config.js`:

```javascript
CLEARING_HOURS = {
  USD: { openHour: 13, closeHour: 22 },  // 13:00-22:00 CET
  EUR: { openHour: 8, closeHour: 17 },   // 08:00-17:00 CET
  GBP: { openHour: 7, closeHour: 16 },   // 07:00-16:00 CET
  CHF: { openHour: 8, closeHour: 17 },   // 08:00-17:00 CET
  JPY: { openHour: 0, closeHour: 9 },    // 00:00-09:00 CET
  HKD: { openHour: 0, closeHour: 9 },    // 00:00-09:00 CET
  MXN: { openHour: 14, closeHour: 23 }   // 14:00-23:00 CET
}
```

## Casos de uso educativos

Este simulador es ideal para:
- Entender el flujo de pagos SWIFT
- Visualizar redes de corresponsalía bancaria
- Aprender sobre liquidación interbancaria
- Comprender el rol de las cuentas Nostro/Vostro
- Estudiar conversiones FX en pagos internacionales
- Experimentar con horarios de clearing y zonas horarias

## Notas

- Los datos se almacenan en SQLite (`data/payment-simulator.sqlite`)
- El motor de procesamiento simula latencia y asincronía real
- Todas las operaciones monetarias usan precisión decimal para evitar errores de redondeo
- El sistema es educativo y simplifica ciertos aspectos del clearing real (ej. no hay banco central)

## Licencia

Este proyecto es de uso educativo.
