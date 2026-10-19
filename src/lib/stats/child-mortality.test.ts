import { describe, it, expect } from 'vitest';
import { computeChildMortality } from './child-mortality';

describe('computeChildMortality', () => {
  it('1. computes basic U5MR correctly for standard input', () => {
    const res = computeChildMortality({ liveBirths: 10000, deathsUnder5: 50 });
    expect(res.u5mr).toBe(5);
    expect(res.probabilityOfDying).toBe(0.005);
  });

  it('2. computes U5MR with zero deaths', () => {
    const res = computeChildMortality({ liveBirths: 5000, deathsUnder5: 0 });
    expect(res.u5mr).toBe(0);
    expect(res.probabilityOfDying).toBe(0);
  });

  it('3. handles fractional or decimal precision correctly', () => {
    const res = computeChildMortality({ liveBirths: 3333, deathsUnder5: 45 });
    expect(res.u5mr).toBe(13.5014);
  });

  it('4. computes infant mortality rate when provided', () => {
    const res = computeChildMortality({ liveBirths: 10000, deathsUnder5: 60, infantDeaths: 40 });
    expect(res.u5mr).toBe(6);
    expect(res.infantMortalityRate).toBe(4);
  });

  it('5. computes neonatal mortality rate when provided', () => {
    const res = computeChildMortality({ liveBirths: 10000, deathsUnder5: 60, infantDeaths: 40, neonatalDeaths: 25 });
    expect(res.u5mr).toBe(6);
    expect(res.infantMortalityRate).toBe(4);
    expect(res.neonatalMortalityRate).toBe(2.5);
  });

  it('6. throws error on zero live births', () => {
    expect(() => computeChildMortality({ liveBirths: 0, deathsUnder5: 10 })).toThrowError(
      /live births must be greater than zero/i
    );
  });

  it('7. throws error on negative live births', () => {
    expect(() => computeChildMortality({ liveBirths: -100, deathsUnder5: 5 })).toThrowError(
      /live births must be greater than zero/i
    );
  });

  it('8. throws error on negative deaths under 5', () => {
    expect(() => computeChildMortality({ liveBirths: 1000, deathsUnder5: -2 })).toThrowError(
      /deaths under 5 cannot be negative/i
    );
  });

  it('9. throws error on negative infant deaths', () => {
    expect(() => computeChildMortality({ liveBirths: 1000, deathsUnder5: 10, infantDeaths: -1 })).toThrowError(
      /infant deaths cannot be negative/i
    );
  });

  it('10. throws error on negative neonatal deaths', () => {
    expect(() => computeChildMortality({ liveBirths: 1000, deathsUnder5: 10, neonatalDeaths: -5 })).toThrowError(
      /neonatal deaths cannot be negative/i
    );
  });

  it('11. computes correctly with large population numbers', () => {
    const res = computeChildMortality({ liveBirths: 1250000, deathsUnder5: 18500 });
    expect(res.u5mr).toBe(14.8);
  });

  it('12. handles optional parameters omission cleanly', () => {
    const res = computeChildMortality({ liveBirths: 2000, deathsUnder5: 20 });
    expect(res.infantMortalityRate).toBeUndefined();
    expect(res.neonatalMortalityRate).toBeUndefined();
  });
});
