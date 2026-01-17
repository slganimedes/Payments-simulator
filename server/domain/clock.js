import { SIM_EPOCH_MS } from '../config.js';

export function getClock(db) {
  const row = db.prepare('SELECT simTimeMs, tick, pausedTick, lastUpdateMs FROM sim_clock WHERE id = 1').get();
  if (!row) throw new Error('Clock not initialized');
  return {
    simTimeMs: row.simTimeMs,
    tick: row.tick,
    pausedTick: row.pausedTick,
    lastUpdateMs: row.lastUpdateMs
  };
}

export function getSimTimeMs(db) {
  const c = getClock(db);

  // Si tick es 0, el reloj está pausado, no avanzar
  if (c.tick === 0) {
    return c.simTimeMs;
  }

  // Calcular cuántos segundos reales han pasado desde la última actualización
  const now = Date.now();
  const realSecondsPassed = Math.floor((now - c.lastUpdateMs) / 1000);

  // Cada segundo real, sumamos 'tick' segundos al tiempo simulado
  return c.simTimeMs + (realSecondsPassed * c.tick * 1000);
}

export function updateClock(db) {
  // Actualizar el tiempo simulado en la base de datos
  const currentSimTime = getSimTimeMs(db);
  const now = Date.now();

  db.prepare('UPDATE sim_clock SET simTimeMs = ?, lastUpdateMs = ? WHERE id = 1')
    .run(currentSimTime, now);
}

export function resetClock(db) {
  db.prepare('UPDATE sim_clock SET simTimeMs = ?, tick = ?, pausedTick = ?, lastUpdateMs = ? WHERE id = 1')
    .run(SIM_EPOCH_MS, 60, 60, Date.now());
}

export function setTick(db, newTick) {
  // Primero actualizar el tiempo simulado hasta ahora
  updateClock(db);

  // Luego cambiar el tick
  db.prepare('UPDATE sim_clock SET tick = ?, lastUpdateMs = ? WHERE id = 1')
    .run(newTick, Date.now());

  console.log('[Clock] setTick:', { newTick, time: new Date(getSimTimeMs(db)).toISOString() });
}

export function pause(db) {
  const c = getClock(db);

  // Guardar el tick actual (si no es 0)
  const pausedTick = c.tick > 0 ? c.tick : c.pausedTick;

  // Actualizar tiempo y pausar
  updateClock(db);

  db.prepare('UPDATE sim_clock SET tick = ?, pausedTick = ?, lastUpdateMs = ? WHERE id = 1')
    .run(0, pausedTick, Date.now());

  console.log('[Clock] pause:', { pausedTick });
}

export function play(db) {
  const c = getClock(db);

  // Restaurar el tick guardado
  const newTick = c.pausedTick > 0 ? c.pausedTick : 60;

  db.prepare('UPDATE sim_clock SET tick = ?, lastUpdateMs = ? WHERE id = 1')
    .run(newTick, Date.now());

  console.log('[Clock] play:', { newTick });
}

export function faster(db) {
  const c = getClock(db);

  // Solo funciona si no está pausado
  if (c.tick === 0) return;

  const newTick = c.tick * 2;
  setTick(db, newTick);
}

export function slower(db) {
  const c = getClock(db);

  // Solo funciona si no está pausado
  if (c.tick === 0) return;

  const newTick = Math.max(60, Math.floor(c.tick / 2));
  setTick(db, newTick);
}
