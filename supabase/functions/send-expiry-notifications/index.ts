import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

type ExpiryItem = {
  kind: "license" | "trial";
  id: string;
  code: string;
  expiryDate: string;
  room: string;
  details: string;
};

const corsHeaders = { "content-type": "application/json" };

function daysUntil(dateValue: string): number {
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const [year, month, day] = dateValue.split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - todayUtc) / 86400000);
}
function eventKey(days: number): string | null {
  if ([10, 5, 3, 1, 0].includes(days)) return `days-${days}`;
  if (days < 0) return `overdue-${new Date().toISOString().slice(0, 10)}`;
  return null;
}
function expiryText(days: number): string {
  if ([10, 5, 3].includes(days)) return `Scade tra ${days} giorni`;
  if (days === 1) return "Scade domani";
  if (days === 0) return "Scade oggi";
  return `Scaduta da ${Math.abs(days)} ${Math.abs(days) === 1 ? "giorno" : "giorni"}`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response(JSON.stringify({ error: "Metodo non consentito" }), { status: 405, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")?.trim();
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")?.trim();
    const vapidSubject = Deno.env.get("VAPID_SUBJECT")?.trim() || "mailto:admin@example.com";
    if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) return new Response(JSON.stringify({ error: "Secret mancanti" }), { status: 500, headers: corsHeaders });

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [licensesResult, subscriptionsResult, stationsResult, pluginsResult] = await Promise.all([
      supabase.from("licenses").select("id,code,category,avid_type,plugin_type,billing_cycle,expiry_date,archived_at").is("archived_at", null).not("expiry_date", "is", null),
      supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("enabled", true),
      supabase.from("stations").select("id,avid_license_id,avid_trial_status,avid_trial_expiry,room_id,rooms(name)"),
      supabase.from("station_plugins").select("license_id,station_id"),
    ]);
    const firstError = licensesResult.error || subscriptionsResult.error || stationsResult.error || pluginsResult.error;
    if (firstError) return new Response(JSON.stringify({ error: firstError.message }), { status: 500, headers: corsHeaders });

    const stations = stationsResult.data || [];
    const stationPlugins = pluginsResult.data || [];
    const roomByLicense = new Map<string, string>();
    for (const station of stations) {
      const roomName = (station.rooms as { name?: string } | null)?.name || "";
      if (station.avid_license_id) roomByLicense.set(station.avid_license_id, roomName);
      for (const relation of stationPlugins) if (relation.station_id === station.id) roomByLicense.set(relation.license_id, roomName);
    }

    const items: ExpiryItem[] = [];
    for (const license of licensesResult.data || []) {
      if (!license.expiry_date) continue;
      const room = roomByLicense.get(license.id) || "";
      const type = license.category === "avid" ? license.avid_type : license.plugin_type;
      items.push({ kind: "license", id: license.id, code: license.code, expiryDate: license.expiry_date, room, details: [room, type, license.billing_cycle === "monthly" ? "Mensile" : "Annuale"].filter(Boolean).join(" • ") });
    }
    for (const station of stations) {
      if (station.avid_trial_status !== "active" || !station.avid_trial_expiry) continue;
      const room = (station.rooms as { name?: string } | null)?.name || "Sala";
      items.push({ kind: "trial", id: station.id, code: `Trial Avid · ${room}`, expiryDate: station.avid_trial_expiry, room, details: `${room} • Trial attiva` });
    }

    let sent = 0, removed = 0;
    const errors: string[] = [];
    for (const item of items) {
      const days = daysUntil(item.expiryDate);
      const key = eventKey(days);
      if (!key) continue;
      for (const subscription of subscriptionsResult.data || []) {
        let deliveryQuery = supabase.from("notification_deliveries").select("id").eq("subscription_id", subscription.id).eq("event_key", key);
        deliveryQuery = item.kind === "license" ? deliveryQuery.eq("license_id", item.id) : deliveryQuery.eq("station_id", item.id);
        const { data: existing } = await deliveryQuery.maybeSingle();
        if (existing) continue;

        const payload = JSON.stringify({
          title: `${days <= 0 ? "🔴" : "🔔"} ${item.code}`,
          body: `${expiryText(days)}${item.details ? `\n${item.details}` : ""}`,
          tag: `${item.kind}-${item.id}-${key}`,
          licenseId: item.kind === "license" ? item.id : null,
          stationId: item.kind === "trial" ? item.id : null,
          url: "./",
        });
        try {
          await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
          await supabase.from("notification_deliveries").insert({
            subscription_id: subscription.id,
            license_id: item.kind === "license" ? item.id : null,
            station_id: item.kind === "trial" ? item.id : null,
            event_key: key,
          });
          sent++;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
            removed++;
          } else errors.push(`${item.code}: ${(error as Error).message}`);
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, checked: items.length, sent, removed, errors }), { status: 200, headers: corsHeaders });
  },
};
