/** Commercial money is integer minor units (paise). Never use IEEE floats. */
export function isMoneyMinor(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function rupeesToMinor(rupees: number): number {
  if (!Number.isInteger(rupees) || rupees < 0) {
    throw new Error('Rupee amounts must be non-negative integers');
  }
  return rupees * 100;
}
