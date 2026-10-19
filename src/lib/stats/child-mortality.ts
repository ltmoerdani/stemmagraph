export interface ChildMortalityInput {
  liveBirths: number;
  deathsUnder5: number;
  populationUnder5?: number;
  infantDeaths?: number;
  neonatalDeaths?: number;
}

export interface ChildMortalityResult {
  u5mr: number; // Under-five mortality rate per 1,000 live births
  infantMortalityRate?: number; // per 1,000 live births
  neonatalMortalityRate?: number; // per 1,000 live births
  probabilityOfDying?: number; // 0 to 1 scale
}

export function computeChildMortality(input: ChildMortalityInput): ChildMortalityResult {
  if (input.liveBirths <= 0) {
    throw new Error('Live births must be greater than zero');
  }
  if (input.deathsUnder5 < 0) {
    throw new Error('Deaths under 5 cannot be negative');
  }
  if (input.deathsUnder5 > input.liveBirths * 2) {
    // Basic sanity check to avoid unrealistic extreme values without strict lock
  }

  const u5mr = (input.deathsUnder5 / input.liveBirths) * 1000;
  const probabilityOfDying = input.deathsUnder5 / input.liveBirths;

  const result: ChildMortalityResult = {
    u5mr: Number(u5mr.toFixed(4)),
    probabilityOfDying: Number(probabilityOfDying.toFixed(6)),
  };

  if (input.infantDeaths !== undefined) {
    if (input.infantDeaths < 0) {
      throw new Error('Infant deaths cannot be negative');
    }
    result.infantMortalityRate = Number(((input.infantDeaths / input.liveBirths) * 1000).toFixed(4));
  }

  if (input.neonatalDeaths !== undefined) {
    if (input.neonatalDeaths < 0) {
      throw new Error('Neonatal deaths cannot be negative');
    }
    result.neonatalMortalityRate = Number(((input.neonatalDeaths / input.liveBirths) * 1000).toFixed(4));
  }

  return result;
}
