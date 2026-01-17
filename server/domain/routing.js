export function buildGraph(db, settlementCurrency) {
  const banks = db.prepare('SELECT id, name, baseCurrency FROM banks').all();
  const bankById = new Map(banks.map((b) => [b.id, b]));

  const nostros = db
    .prepare('SELECT ownerBankId, correspondentBankId, currency FROM nostros WHERE currency = ?')
    .all(settlementCurrency);

  const neighbors = new Map();
  for (const b of banks) neighbors.set(b.id, []);

  for (const n of nostros) {
    const to = bankById.get(n.correspondentBankId);
    if (!to) continue;
    if (to.baseCurrency !== settlementCurrency) continue;

    // Bidirectional connectivity for settlement routing.
    neighbors.get(n.ownerBankId).push(n.correspondentBankId);
    neighbors.get(n.correspondentBankId).push(n.ownerBankId);
  }

  // Direct settlement among banks sharing the same base currency (no Nostro needed)
  const inCurrency = banks.filter((b) => b.baseCurrency === settlementCurrency);
  for (const a of inCurrency) {
    for (const b of inCurrency) {
      if (a.id === b.id) continue;
      neighbors.get(a.id).push(b.id);
    }
  }

  // Deterministic neighbor order
  for (const [id, arr] of neighbors.entries()) {
    arr.sort((x, y) => {
      const bx = bankById.get(x);
      const by = bankById.get(y);
      return (bx?.name ?? x).localeCompare(by?.name ?? y);
    });
  }

  return { bankById, neighbors };
}

export function findMinimumHopRoute(db, fromBankId, toBankId, settlementCurrency) {
  if (fromBankId === toBankId) return [fromBankId];

  const { neighbors } = buildGraph(db, settlementCurrency);

  const q = [fromBankId];
  const prev = new Map();
  prev.set(fromBankId, null);

  while (q.length) {
    const cur = q.shift();
    const ns = neighbors.get(cur) ?? [];
    for (const nxt of ns) {
      if (prev.has(nxt)) continue;
      prev.set(nxt, cur);
      if (nxt === toBankId) {
        const path = [];
        let p = toBankId;
        while (p) {
          path.push(p);
          p = prev.get(p);
        }
        path.reverse();
        return path;
      }
      q.push(nxt);
    }
  }

  return null;
}
