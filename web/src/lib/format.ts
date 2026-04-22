export function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + Math.round(n).toLocaleString();
}

export function pct(n: number | null | undefined, digits = 2): string {
  if (n == null) return "—";
  return (n * 100).toFixed(digits) + "%";
}

export function timeago(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}
