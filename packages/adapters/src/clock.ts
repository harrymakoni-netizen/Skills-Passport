export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Controllable clock for tests and demos. */
export class ControllableClock implements Clock {
  private t: number;
  constructor(start: Date = new Date('2026-10-09T08:00:00Z')) {
    this.t = start.getTime();
  }
  now(): Date {
    return new Date(this.t);
  }
  set(d: Date): void {
    this.t = d.getTime();
  }
  advance(ms: number): void {
    this.t += ms;
  }
}
