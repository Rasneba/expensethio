export const fmtBirr = (n: number): string =>
  `Br ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
