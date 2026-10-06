export const money = (c) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(c / 100);
export const parseSpecs = (s) => (s || "").split("·").map((x) => x.trim()).filter(Boolean);

export async function fetchApi(path, opts = {}, token) {
  const r = await fetch("/api/" + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...opts.headers },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j;
}
