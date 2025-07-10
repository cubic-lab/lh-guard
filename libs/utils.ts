export function formatScore(score: number | undefined | null) {
  return parseFloat(((score || 0) * 100).toFixed(2));
}

export function utcnow() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
  const day = now.getUTCDate().toString().padStart(2, '0');
  const hours = now.getUTCHours().toString().padStart(2, '0');
  const minutes = now.getUTCMinutes().toString().padStart(2, '0');
  const seconds = now.getUTCSeconds().toString().padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}