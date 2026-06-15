import { acquireSlot, capacityStatus } from '../../../src/services/capacity/capacity.service';

// MAX_CONCURRENT_ANALYSES par défaut = 2 (non défini dans l'environnement de test).
describe('capacity.service (sémaphore + file prioritaire)', () => {
  it('borne la concurrence et met les requêtes excédentaires en file', async () => {
    const r1 = await acquireSlot(0);
    const r2 = await acquireSlot(0);
    expect(capacityStatus().active).toBe(2);
    expect(capacityStatus().busy).toBe(true);

    let acquired = false;
    const pending = acquireSlot(0).then((r) => {
      acquired = true;
      return r;
    });
    await Promise.resolve();
    expect(acquired).toBe(false);
    expect(capacityStatus().queued).toBe(1);

    // Libérer un créneau réveille l'attendant.
    r1();
    const r3 = await pending;
    expect(acquired).toBe(true);

    r2();
    r3();
    expect(capacityStatus().active).toBe(0);
    expect(capacityStatus().queued).toBe(0);
  });

  it('sert la priorité la plus élevée en premier', async () => {
    const r1 = await acquireSlot(0);
    const r2 = await acquireSlot(0);

    const order: string[] = [];
    const low = acquireSlot(0).then((r) => {
      order.push('low');
      return r;
    });
    const high = acquireSlot(2).then((r) => {
      order.push('high');
      return r;
    });

    r1();
    const rHigh = await high;
    r2();
    const rLow = await low;

    expect(order[0]).toBe('high');
    rHigh();
    rLow();
    expect(capacityStatus().active).toBe(0);
  });

  it('annule une attente en file via AbortSignal et libère la place', async () => {
    const r1 = await acquireSlot(0);
    const r2 = await acquireSlot(0);

    const ac = new AbortController();
    const pending = acquireSlot(0, ac.signal);
    expect(capacityStatus().queued).toBe(1);

    ac.abort();
    await expect(pending).rejects.toThrow();
    expect(capacityStatus().queued).toBe(0);

    r1();
    r2();
    expect(capacityStatus().active).toBe(0);
  });
});
