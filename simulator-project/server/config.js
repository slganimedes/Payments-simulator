import { fileURLToPath } from 'url';

export const SERVER_PORT = 10100;

export const DB_FILE_PATH = fileURLToPath(new URL('../data/payment-simulator.sqlite', import.meta.url));

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'MXN', 'HKD'];

export const FX_USD_PIVOT_RATES = {
  EUR: '0.85',
  GBP: '0.77',
  CHF: '0.95',
  JPY: '150',
  HKD: '7.80',
  MXN: '20.00'
};

export const CLEARING_HOURS = {
  USD: { openHour: 13, closeHour: 22 },
  EUR: { openHour: 8, closeHour: 17 },
  GBP: { openHour: 7, closeHour: 16 },
  CHF: { openHour: 8, closeHour: 17 },
  JPY: { openHour: 0, closeHour: 9 },
  HKD: { openHour: 0, closeHour: 9 },
  MXN: { openHour: 14, closeHour: 23 }
};

export const SIM_EPOCH_MS = Date.UTC(2026, 0, 1, 9, 0, 0);
