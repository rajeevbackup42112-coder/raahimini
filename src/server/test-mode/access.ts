const HARD_BLOCKED_HOSTS = new Set([
  "ride.myraahi.co.in",
  "www.ride.myraahi.co.in",
]);

function normalizeHost(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function isTestModeAllowed(hostHeader: string | null | undefined) {
  if (process.env.RAAHI_TEST_MODE_ENABLED !== "true") return false;

  const host = normalizeHost(hostHeader);
  const hostname = host.split(":")[0];
  if (!host || HARD_BLOCKED_HOSTS.has(hostname)) return false;

  const allowed = (process.env.RAAHI_TEST_MODE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map(normalizeHost)
    .filter(Boolean);

  return allowed.includes(host) || allowed.includes(hostname);
}

export function testModeServerConfigured() {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}
