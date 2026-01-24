# Payment Simulator

Simulador educativo de pagos internacionales que modela el flujo de transferencias entre bancos, conversiones de divisas y liquidación a través de redes de corresponsalía.

![Payment Simulator Dashboard](./Example.png)

## Características

- **Bancos agrupados por Banco central (Divisa**)
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
├── README.md              # Este fichero
├── API.md                 # Documentación de la API REST
├── LICENSE.txt            # Licencia MIT
├── Example.png            # Captura de pantalla
├── install-and-run.bat    # Script de instalación (CMD)
├── install-and-run.ps1    # Script de instalación (PowerShell)
├── .gitignore
└── simulator-project/     # Código fuente del simulador
    ├── package.json
    ├── vite.config.js
    ├── Dockerfile
    ├── server/
    │   ├── domain/        # Lógica de negocio
    │   │   ├── payments.js    # Gestión de pagos
    │   │   ├── fx.js          # Conversión de divisas
    │   │   ├── nostroVostro.js  # Cuentas corresponsales
    │   │   ├── routing.js     # Enrutamiento interbancario
    │   │   ├── clearing.js    # Horarios de liquidación
    │   │   ├── balances.js    # Gestión de saldos
    │   │   ├── accounts.js    # Bancos y clientes
    │   │   ├── money.js       # Precisión decimal
    │   │   ├── clock.js       # Tiempo simulado (tick-based)
    │   │   ├── ids.js         # Generación de IDs
    │   │   └── invariants.js  # Validaciones
    │   ├── app.js         # Express app
    │   ├── api.js         # API endpoints
    │   ├── engine.js      # Motor de procesamiento
    │   ├── config.js      # Configuración (divisas, FX, horarios)
    │   ├── db.js          # Base de datos SQLite
    │   ├── dev.js         # Servidor desarrollo
    │   └── prod.js        # Servidor producción
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
    └── data/              # Base de datos SQLite
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

### Con Node.js

```bash
cd simulator-project
npm install
```

### Con Docker

```bash
cd simulator-project

# Construir la imagen
docker build -t payment-simulator .

# Ejecutar el contenedor
docker run -d --name payment-sim -p 10100:10100 -v payment-data:/app/data payment-simulator

# Ver logs
docker logs payment-sim

# Detener el contenedor
docker stop payment-sim
```

**Nota**: El volumen `-v payment-data:/app/data` persiste la base de datos SQLite entre reinicios del contenedor.

### Script automático (Windows)

Descarga y ejecuta `install-and-run.bat` o `install-and-run.ps1` para clonar, instalar y arrancar automáticamente.

## Uso

### Modo desarrollo
```bash
cd simulator-project
npm run dev
```
Inicia el servidor en modo desarrollo con Vite HMR

### Modo producción
```bash
cd simulator-project
npm run build  # Construye el frontend
npm start      # Inicia el servidor de producción
```

La aplicación estará disponible en `http://localhost:10100`

## API

La documentación completa de la API REST está disponible en [API.md](./API.md).

Resumen de endpoints:

```
GET  /api/banks           # Lista todos los bancos
POST /api/banks           # Crea un nuevo banco
GET  /api/clients         # Lista todos los clientes
POST /api/banks/:id/clients  # Crea cliente en un banco
POST /api/clients/:id/deposit  # Depositar fondos
GET  /api/nostros         # Lista cuentas Nostro
POST /api/correspondents/nostro  # Crea cuenta Nostro + Vostro espejo
GET  /api/payments        # Lista todos los pagos
POST /api/payments        # Crea intención de pago
GET  /api/fx              # Tipos de cambio actuales
GET  /api/fx-history      # Historial de conversiones FX
GET  /api/clearing-hours  # Horarios de clearing
GET  /api/clock           # Tiempo de simulación actual
POST /api/admin/clock/*   # Control del reloj
POST /api/admin/reset     # Reinicia toda la simulación
```

## Conceptos clave

### Pagos transfronterizos
El sistema simula el flujo completo de un pago internacional:

1. **Iniciación**: Cliente origina pago con moneda de débito
2. **FX origen** (si aplica): Conversión a moneda de liquidación
3. **Enrutamiento**: Encuentra ruta entre bancos usando cuentas Nostro
4. **Liquidación interbancaria**: Ajuste de cuentas Nostro/Vostro
5. **FX destino** (si aplica): Conversión a moneda de crédito
6. **Abono**: Cliente beneficiario recibe fondos

### Tipos de cuenta
- **REGULAR**: Clientes normales del banco que pueden enviar y recibir pagos
- **HOUSE**: Cuenta propia del banco para gestionar su saldo (divisa base + divisas Nostro)
- **VOSTRO**: Cuenta espejo que refleja el saldo de un banco corresponsal

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
- Solo procesa durante horarios de clearing abiertos (excepto pagos intrabancarios)
- Los pagos entre clientes del mismo banco se procesan inmediatamente
- Ejecuta transacciones de forma atómica
- Registra mensajes de auditoría en cada paso

## Configuración

La configuración principal está en `simulator-project/server/config.js`:

```javascript
// Puerto del servidor
export const SERVER_PORT = 10100;

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

## Casos de uso educativos

Este simulador es ideal para:
- Entender el flujo de pagos con corresponsalía
- Visualizar redes de corresponsalía bancaria
- Aprender sobre liquidación interbancaria
- Comprender el rol de las cuentas Nostro/Vostro
- Estudiar conversiones FX en pagos internacionales
- Experimentar con horarios de clearing y zonas horarias

## Notas

- Los datos se almacenan en SQLite (`simulator-project/data/payment-simulator.sqlite`)
- El motor de procesamiento simula latencia y asincronía real
- Todas las operaciones monetarias usan precisión decimal para evitar errores de redondeo
- El sistema es educativo y simplifica ciertos aspectos del clearing real (ej. no hay banco central)

## Licencia

MIT License

Copyright (c) 2026 Payment Simulator

Este proyecto es de uso educativo.

## Versión

**Versión 1.5** - Enero 2026

### Características de la versión 1.5
- **Nombres de clientes en historial de pagos**: Cada pago muestra `ClienteOrigen (Banco) → ClienteDestino (Banco)`
- **Botón Reset Payments**: Borra el historial de pagos sin afectar bancos, clientes ni saldos
- **Auto-exchange toggles**: Dos botones para generar pagos automáticos cada 5 segundos:
  - Domestic: pagos entre clientes de bancos con la misma divisa base
  - Cross-FX: pagos cross-currency con un salto internacional directo
- **Paginación de pagos**: 10 pagos por página con navegación prev/next por columna de divisa
- **Layout mejorado en Payments**: Clientes 25%, Payments 75%
- **Tarjetas de pago mejoradas**: Credit, Debit y Settlement en la misma línea; fecha dd/mm HH:MM sin segundos
- **Paginación de clientes**: Lista de clientes con 10 por página, cuentas HOUSE al final
- **Manual de usuario**: Documento MANUAL.md con guía paso a paso y placeholders para capturas
- **Debug logging**: Registro detallado en consola de cada paso de ejecución de pagos

### Características de la versión 1.2
- **Indicador FX en rutas de pago**: La ruta de cada pago muestra con etiqueta `(FX)` en qué banco se realizó la conversión de divisas
- **Cuentas HOUSE (saldo propio del banco)**: Cada banco tiene una cuenta propia (tipo HOUSE) que gestiona su saldo en divisa base y en divisas de sus Nostros
  - Se crea automáticamente al crear un banco
  - Soporta depósitos y pagos como cualquier cliente regular
  - Sigue las mismas reglas de balance e invariantes que clientes REGULAR
- **Pagos intrabancarios sin horario de cámara**: Los pagos entre clientes del mismo banco se procesan inmediatamente, sin esperar a la ventana de clearing de la divisa de liquidación

### Características de la versión 1.1
- **Reorganización del proyecto**: Código fuente movido a `simulator-project/`
- **Documentación de API**: Nuevo fichero `API.md` con documentación completa
- **Validaciones mejoradas de pagos**:
  - Clientes REGULAR y HOUSE pueden hacer pagos
  - Validación de balance > 0 en la divisa de débito
  - Validación de disponibilidad de divisa en banco destino
- **Mensajes de error mejorados** para restricciones de Nostro

### Características de la versión 1.0
- Sistema completo de pagos internacionales con red de corresponsalía
- Visualización interactiva de red bancaria con D3.js
- Motor de enrutamiento y liquidación interbancaria
- Sistema de conversión de divisas (FX) con 7 monedas
- Horarios de clearing por divisa con zona horaria CET
- Reloj simulado con control de velocidad
- Gestión completa de cuentas Nostro/Vostro
- Validaciones de negocio y contabilidad de precisión decimal
