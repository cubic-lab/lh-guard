export function formatScore(score: number | null | undefined) {
  return parseFloat(((score || 0) * 100).toFixed(2));
}