export const fmtInr = (n: number) => {
  if (!isFinite(n)) return "₹0";
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

export const riskColor = (r: string) =>
  r === "HIGH"
    ? "bg-destructive/15 text-destructive border-destructive/40"
    : r === "MED"
    ? "bg-[color:var(--amber-brand)]/15 text-[color:var(--amber-brand)] border-[color:var(--amber-brand)]/40"
    : "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/40";
