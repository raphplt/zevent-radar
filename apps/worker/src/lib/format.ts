export function formatEuros(cents: number): string {
  const euros = cents / 100;
  const formatted = Number.isInteger(euros) ? euros.toLocaleString("fr-FR") : euros.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} €`;
}
