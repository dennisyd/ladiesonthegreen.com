// JSON fetch helper for the admin dashboard and member portal. Throws an Error
// carrying the server's message (and HTTP status) when a request fails.
export async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatMoney(amount) {
  return `$${Number(amount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export const statusLabels = {
  registered: "Not paid yet",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled"
};
