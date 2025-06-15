export function splitBigIntToLimbs(value: bigint, limbSize: number, numLimbs: number): bigint[] {
  const limbs: bigint[] = [];
  const mask = (1n << BigInt(limbSize)) - 1n;
  
  for (let i = 0; i < numLimbs; i++) {
    limbs.push(value & mask);
    value = value >> BigInt(limbSize);
  }
  
  return limbs;
} 
