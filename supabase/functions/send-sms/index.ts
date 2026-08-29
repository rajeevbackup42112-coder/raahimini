// @ts-nocheck
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type HookPayload = {
  user?: { phone?: string };
  sms?: { otp?: string };
};

class ProviderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function normalizeIndianMobile(input: string): string {
  const digits = input.replace(/\D/g, "");
  const mobile = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9][0-9]{9}$/.test(mobile)) {
    throw new Error("Raahi OTP delivery currently supports Indian mobile numbers only");
  }
  return mobile;
}
function verifySupabaseHook(payload: string, headers: Record<string, string>): HookPayload {
  const configured = requiredEnv("SEND_SMS_HOOK_SECRETS")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const candidate of configured) {
    const secret = candidate.replace(/^v1,whsec_/, "");
    try {
      return new Webhook(secret).verify(payload, headers) as HookPayload;
    } catch {
      // Try the next configured rotation secret.
    }
  }

  throw new Error("Invalid Supabase Send SMS hook signature");
}

function jsonResponse(status: number, body: Record<string, unknown>, retryable = false) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (retryable) headers.set("retry-after", "true");
  return new Response(JSON.stringify(body), { status, headers });
}

function safeProviderMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "Fast2SMS rejected the OTP request";
  const value = (data as Record<string, unknown>).message;
  return typeof value === "string" ? value.slice(0, 180) : "Fast2SMS rejected the OTP request";
}
async function sendWithFast2Sms(mobile: string, otp: string): Promise<void> {
  const apiKey = requiredEnv("FAST2SMS_API_KEY");
  const otpId = requiredEnv("FAST2SMS_OTP_ID");

  const response = await fetch("https://www.fast2sms.com/dev/otp/send", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mobile,
      otp_id: otpId,
      otp,
      otp_length: 6,
    }),
    signal: AbortSignal.timeout(3500),
  });

  let data: unknown = null;
  try { data = await response.json(); } catch { /* Provider returned non-JSON. */ }
  const accepted = response.ok && Boolean((data as Record<string, unknown> | null)?.return);
  if (!accepted) throw new ProviderError(response.status, safeProviderMessage(data));
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  try {
    const event = verifySupabaseHook(payload, headers);
    const phone = event.user?.phone || "";
    const otp = event.sms?.otp || "";
    if (!/^[0-9]{6}$/.test(otp)) throw new Error("Supabase hook did not provide a six-digit OTP");

    const mobile = normalizeIndianMobile(phone);
    await sendWithFast2Sms(mobile, otp);
    return jsonResponse(200, {});
  } catch (error) {
    if (error instanceof ProviderError) {
      const retryable = error.status === 429 || error.status >= 500;
      return jsonResponse(retryable ? 503 : 500, {
        error: { http_code: error.status, message: error.message },
      }, retryable);
    }

    const message = error instanceof Error ? error.message : "OTP delivery failed";
    const signatureError = message.includes("hook signature");
    return jsonResponse(signatureError ? 401 : 500, {
      error: { http_code: signatureError ? 401 : 500, message },
    });
  }
});
