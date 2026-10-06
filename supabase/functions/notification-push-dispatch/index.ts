import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const presentedSecret = req.headers.get("x-dispatch-secret");
  // Reject internet scans before creating a privileged client or touching the database.
  if (!presentedSecret || presentedSecret.length < 32 || presentedSecret.length > 256) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration missing" }, 500);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: config, error: configError } = await supabase
    .from("notification_dispatch_config")
    .select("dispatch_secret,vapid_public_key,vapid_private_key,vapid_subject")
    .eq("singleton", true)
    .single();

  if (configError || !config) return json({ error: "Push config unavailable" }, 500);
  if (!constantTimeEqual(presentedSecret, config.dispatch_secret)) return json({ error: "Unauthorized" }, 401);
  if (!config.vapid_public_key || !config.vapid_private_key) return json({ error: "VAPID is not configured" }, 503);

  webpush.setVapidDetails(config.vapid_subject, config.vapid_public_key, config.vapid_private_key);

  const { data: notifications, error: notificationError } = await supabase
    .from("notifications")
    .select("id,user_id,title,body,href,priority,push_attempts")
    .is("push_sent_at", null)
    .lt("push_attempts", 5)
    .order("created_at", { ascending: true })
    .limit(100);
  if (notificationError) return json({ error: notificationError.message }, 500);
  if (!notifications?.length) return json({ sent: 0, skipped: 0 });

  const userIds = [...new Set(notifications.map((note: any) => note.user_id))];
  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .in("user_id", userIds)
    .eq("active", true);
  if (subscriptionError) return json({ error: subscriptionError.message }, 500);

  const byUser = new Map<string, any[]>();
  for (const sub of subscriptions ?? []) {
    const current = byUser.get(sub.user_id) ?? [];
    current.push(sub);
    byUser.set(sub.user_id, current);
  }

  let sent = 0;
  let skipped = 0;
  for (const note of notifications) {
    const userSubscriptions = byUser.get(note.user_id) ?? [];
    if (!userSubscriptions.length) {
      skipped += 1;
      await supabase.from("notifications").update({
        push_attempts: Number(note.push_attempts || 0) + 1,
        push_error: "No active push subscription",
      }).eq("id", note.id);
      continue;
    }

    let success = false;
    const errors: string[] = [];
    for (const sub of userSubscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: note.title,
            body: note.body,
            href: note.href || "/notifications",
            notificationId: note.id,
            priority: note.priority,
          }),
          { TTL: 86400, urgency: note.priority === "high" ? "high" : "normal" },
        );
        success = true;
      } catch (error: any) {
        const status = Number(error?.statusCode ?? 0);
        errors.push(`${status || "error"}:${String(error?.message ?? error).slice(0, 160)}`);
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").update({ active: false, updated_at: new Date().toISOString() }).eq("id", sub.id);
        }
      }
    }

    if (success) {
      sent += 1;
      await supabase.from("notifications").update({
        push_sent_at: new Date().toISOString(),
        push_attempts: Number(note.push_attempts || 0) + 1,
        push_error: errors.length ? errors.join(" | ") : null,
      }).eq("id", note.id);
    } else {
      await supabase.from("notifications").update({
        push_attempts: Number(note.push_attempts || 0) + 1,
        push_error: errors.join(" | ") || "No active push delivery succeeded",
      }).eq("id", note.id);
    }
  }

  return json({ sent, skipped, processed: notifications.length });
});
