import { supabaseAdmin } from "@/lib/supabase/admin";

export type SecurityEventType =
  | "auth_failed"
  | "auth_account_needs_migration"
  | "auth_rate_limited"
  | "webhook_auth_failed"
  | "webhook_contact_mismatch"
  | "rpc_unauthorized"
  | "chat_flagged"
  | "rate_limited"
  | "suspicious_pattern"
  | "miniapp_signin"
  | "miniapp_initdata_invalid"
  | "miniapp_binding"
  | "miniapp_binding_mismatch"
  | "app_webhook_auth_failed";

export async function logSecurityEvent(params: {
  event_type: SecurityEventType;
  user_id?: string | null;
  phone?: string | null;
  ip?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseAdmin.from("security_events").insert({
      event_type: params.event_type,
      user_id: params.user_id ?? null,
      phone: params.phone ?? null,
      ip: params.ip ?? null,
      detail: params.detail ?? null,
    });
  } catch (err) {
    console.error("security_events insert failed", err);
  }
}
