import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

type License = {
  id: string;
  code: string;
  category: "avid" | "plugin";
  avid_type: string | null;
  plugin_type: string | null;
  billing_cycle: "monthly" | "annual";
  expiry_date: string | null;
  archived_at: string | null;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  app_url: string | null;
};

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (days === 10 || days === 5 || days === 3) return `Scade tra ${days} giorni`;
  if (days === 1) return "Scade domani";
  if (days === 0) return "Scade oggi";
  return `Scaduta da ${Math.abs(days)} ${Math.abs(days) === 1 ? "giorno" : "giorni"}`;
}

function romeHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    hour12: false,
  }).format(new Date()));
}

function pushPayload(title: string, body: string, appUrl: string | null, tag: string, licenseId: string | null) {
  if (!appUrl) return JSON.stringify({ title, body, tag, licenseId, url: "./" });
  const baseUrl = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;
  return JSON.stringify({
    web_push: 8030,
    notification: {
      title,
      lang: "it-IT",
      dir: "ltr",
      body,
      navigate: baseUrl,
      tag,
      silent: false,
      icon: new URL("assets/workspace-icon-192.png", baseUrl).href,
      data: { url: baseUrl, licenseId },
    },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Metodo non consentito" }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    let requestBody: { scheduled?: boolean; cron?: boolean; dryRun?: boolean; test?: boolean; endpoint?: string } = {};
    try { requestBody = await request.json(); } catch { /* body facoltativo */ }

    if (requestBody.scheduled && romeHour() !== 9) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "Fuori dalla finestra delle 09:00 Europe/Rome" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const authorization = request.headers.get("authorization") || "";
    const cronBearer = authorization.replace(/^Bearer\s+/i, "").trim();
    const serviceRoleKey = requestBody.cron && cronBearer
      ? cronBearer
      : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")?.trim();
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")?.trim();
    const vapidSubject = Deno.env.get("VAPID_SUBJECT")?.trim() || "mailto:admin@example.com";

    if (!supabaseUrl || !serviceRoleKey || !vapidPublic || !vapidPrivate) {
      return new Response(JSON.stringify({ error: "Secret mancanti" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [{ data: licenses, error: licenseError }, { data: subscriptions, error: subscriptionError }] =
      await Promise.all([
        supabase.from("licenses")
          .select("id,code,category,avid_type,plugin_type,billing_cycle,expiry_date,archived_at")
          .is("archived_at", null)
          .not("expiry_date", "is", null),
        supabase.from("push_subscriptions")
          .select("id,endpoint,p256dh,auth,app_url")
          .eq("enabled", true),
      ]);

    if (licenseError || subscriptionError) {
      return new Response(JSON.stringify({
        error: licenseError?.message || subscriptionError?.message,
      }), { status: 500, headers: corsHeaders });
    }

    const activeSubscriptions = (subscriptions || []) as PushSubscriptionRow[];

    if (requestBody.dryRun) {
      return new Response(JSON.stringify({
        ok: true,
        dryRun: true,
        licenses: (licenses || []).length,
        subscriptions: activeSubscriptions.length,
      }), { status: 200, headers: corsHeaders });
    }

    if (requestBody.test) {
      const subscription = activeSubscriptions.find(item => item.endpoint === requestBody.endpoint);
      if (!subscription) {
        return new Response(JSON.stringify({ error: "Sottoscrizione non trovata o non attiva" }), { status: 404, headers: corsHeaders });
      }
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, pushPayload("DVS Workspace", "Test server completato: il Web Push funziona anche senza app in primo piano.", subscription.app_url, "dvs-server-test", null), {
          TTL: 172800,
          urgency: "high",
        });
        return new Response(JSON.stringify({ ok: true, sent: 1, declarative: !!subscription.app_url }), { status: 200, headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), { status: 502, headers: corsHeaders });
      }
    }

    const { data: stations } = await supabase.from("stations")
      .select("id,avid_license_id,room_id,rooms(name)");
    const { data: stationPlugins } = await supabase.from("station_plugins")
      .select("license_id,station_id");

    const roomByLicense = new Map<string, string>();
    for (const station of stations || []) {
      const roomName = (station.rooms as { name?: string } | null)?.name || "";
      if (station.avid_license_id) roomByLicense.set(station.avid_license_id, roomName);
      for (const relation of stationPlugins || []) {
        if (relation.station_id === station.id) roomByLicense.set(relation.license_id, roomName);
      }
    }

    let sent = 0;
    let removed = 0;
    const errors: string[] = [];

    for (const license of (licenses || []) as License[]) {
      if (!license.expiry_date) continue;
      const days = daysUntil(license.expiry_date);
      const key = eventKey(days);
      if (!key) continue;

      for (const subscription of activeSubscriptions) {
        const { data: existing } = await supabase.from("notification_deliveries")
          .select("id")
          .eq("subscription_id", subscription.id)
          .eq("license_id", license.id)
          .eq("event_key", key)
          .maybeSingle();

        if (existing) continue;

        const room = roomByLicense.get(license.id);
        const type = license.category === "avid" ? license.avid_type : license.plugin_type;
        const details = [room, type, license.billing_cycle === "monthly" ? "Mensile" : "Annuale"]
          .filter(Boolean)
          .join(" • ");

        const payload = pushPayload(
          `${days <= 0 ? "🔴" : "🔔"} ${license.code}`,
          `${expiryText(days)}${details ? `\n${details}` : ""}`,
          subscription.app_url,
          `license-${license.id}-${key}`,
          license.id,
        );

        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          }, payload, {
            TTL: 172800,
            urgency: "high",
          });

          await supabase.from("notification_deliveries").insert({
            subscription_id: subscription.id,
            license_id: license.id,
            event_key: key,
          });
          sent++;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
            removed++;
          } else {
            errors.push(`${license.code}: ${(error as Error).message}`);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, removed, errors }), {
      status: 200,
      headers: corsHeaders,
    });
  },
};
