import { getConfig } from "@/lib/config";
import { verifySharedSecret } from "@/lib/services/sharedSecretAuth";

// Verifies the legacy `x-vapi-secret` shared-secret header (spec §18). Vapi
// also supports a newer configurable HMAC signature (x-vapi-signature) via
// Custom Credentials in the dashboard — worth upgrading to before production,
// but the shared-secret header is simpler to wire up first and is what
// VAPI_WEBHOOK_SECRET in .env.example is shaped for.
export function verifyVapiWebhookSecret(headerValue: string | null): boolean {
  return verifySharedSecret(headerValue, getConfig().vapiWebhookSecret);
}
