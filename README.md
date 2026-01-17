# Payment Simulator

Simulador educativo de pagos internacionales que modela el flujo de transferencias entre bancos, conversiones de divisas y liquidación a través de redes de corresponsalía.

## Características

- **Red de bancos corresponsales**: Visualización interactiva de la red de bancos agrupados por moneda base
- **Pagos transfronterizos**: Simulación completa del ciclo de vida de pagos internacionales
- **Conversión de divisas (FX)**: Sistema de tipos de cambio con pivot en USD
- **Cuentas Nostro/Vostro**: Implementación del modelo de cuentas interbancarias
- **Horarios de clearing**: Simulación de ventanas de liquidación por moneda
- **Motor de enrutamiento**: Encuentra rutas óptimas entre bancos para liquidación
- **Reloj simulado**: Control del tiempo de simulación independiente del tiempo real

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
│   │   ├── clock.js     # Tiempo simulado
│   │   ├── ids.js       # Generación de IDs
│   │   └── invariants.js # Validaciones
│   ├── app.js          # Express app
│   ├── engine.js       # Motor de procesamiento
│   └── db.js           # Base de datos SQLite
├── web/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx    # Red y pagos
│       │   ├── BankDetails.jsx  # Detalles de bancos
│       │   ├── Payments.jsx     # Crear pagos
│       │   └── FX.jsx           # Tipos de cambio
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
- **SVG**: Visualización de red de bancos

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

La aplicación estará disponible en `http://localhost:3000`

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

## API Endpoints

```
GET  /api/banks           # Lista todos los bancos
POST /api/banks           # Crea un nuevo banco
GET  /api/clients         # Lista todos los clientes
POST /api/clients         # Crea un nuevo cliente
GET  /api/nostros         # Lista cuentas Nostro
POST /api/nostros         # Crea cuenta Nostro
GET  /api/payments        # Lista todos los pagos
POST /api/payments        # Crea intención de pago
GET  /api/fx              # Tipos de cambio actuales
GET  /api/clearing-hours  # Horarios de clearing
GET  /api/clock           # Tiempo de simulación actual
POST /api/clock/advance   # Avanza el tiempo simulado
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
- MXN (Peso mexicano)

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
