import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

type Subscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type License = {
  id: string;
  code: string;
  category: "avid" | "plugin";
  avid_type: string | null;
  plugin_type: string | null;
  billing_cycle: "monthly" | "annual";
  expiry_date: string | null;
};

type Station = {
  id: string;
  avid_license_id: string | null;
  avid_trial_status: "none" | "pending" | "active";
  avid_trial_expiry: string | null;
  rooms: { name?: string } | null;
};

const headers = {"content-type":"application/json"};

function daysUntil(dateValue:string):number{
  const now=new Date();
  const todayUtc=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  const [year,month,day]=dateValue.split("-").map(Number);
  return Math.round((Date.UTC(year,month-1,day)-todayUtc)/86400000);
}

function eventKey(days:number):string|null{
  if([10,5,3,1,0].includes(days))return `days-${days}`;
  if(days<0)return `overdue-${new Date().toISOString().slice(0,10)}`;
  return null;
}

function expiryText(days:number):string{
  if(days===10||days===5||days===3)return `Scade tra ${days} giorni`;
  if(days===1)return "Scade domani";
  if(days===0)return "Scade oggi";
  return `Scaduta da ${Math.abs(days)} ${Math.abs(days)===1?"giorno":"giorni"}`;
}

export default {
  async fetch(request:Request):Promise<Response>{
    if(request.method!=="POST"){
      return new Response(JSON.stringify({error:"Metodo non consentito"}),{status:405,headers});
    }

    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublic=Deno.env.get("VAPID_PUBLIC_KEY")?.trim();
    const vapidPrivate=Deno.env.get("VAPID_PRIVATE_KEY")?.trim();
    const vapidSubject=Deno.env.get("VAPID_SUBJECT")?.trim()||"mailto:admin@example.com";

    if(!supabaseUrl||!serviceRoleKey||!vapidPublic||!vapidPrivate){
      return new Response(JSON.stringify({error:"Secret mancanti"}),{status:500,headers});
    }

    webpush.setVapidDetails(vapidSubject,vapidPublic,vapidPrivate);
    const supabase=createClient(supabaseUrl,serviceRoleKey);

    const [
      {data:licenses,error:licenseError},
      {data:subscriptions,error:subscriptionError},
      {data:stations,error:stationError},
      {data:stationPlugins,error:pluginError},
    ]=await Promise.all([
      supabase.from("licenses")
        .select("id,code,category,avid_type,plugin_type,billing_cycle,expiry_date")
        .is("archived_at",null)
        .not("expiry_date","is",null),
      supabase.from("push_subscriptions")
        .select("id,endpoint,p256dh,auth")
        .eq("enabled",true),
      supabase.from("stations")
        .select("id,avid_license_id,avid_trial_status,avid_trial_expiry,rooms(name)"),
      supabase.from("station_plugins")
        .select("license_id,station_id"),
    ]);

    const firstError=licenseError||subscriptionError||stationError||pluginError;
    if(firstError){
      return new Response(JSON.stringify({error:firstError.message}),{status:500,headers});
    }

    const roomByLicense=new Map<string,string>();
    for(const station of (stations||[]) as Station[]){
      const roomName=station.rooms?.name||"";
      if(station.avid_license_id)roomByLicense.set(station.avid_license_id,roomName);
      for(const relation of stationPlugins||[]){
        if(relation.station_id===station.id)roomByLicense.set(relation.license_id,roomName);
      }
    }

    let sent=0;
    let removed=0;
    const errors:string[]=[];

    async function alreadySent(subscriptionId:string,target:"license"|"station",targetId:string,key:string){
      let query=supabase.from("notification_deliveries")
        .select("id")
        .eq("subscription_id",subscriptionId)
        .eq("event_key",key);
      query=target==="license"?query.eq("license_id",targetId):query.eq("station_id",targetId);
      const {data}=await query.maybeSingle();
      return !!data;
    }

    async function recordSent(subscriptionId:string,target:"license"|"station",targetId:string,key:string){
      await supabase.from("notification_deliveries").insert({
        subscription_id:subscriptionId,
        license_id:target==="license"?targetId:null,
        station_id:target==="station"?targetId:null,
        event_key:key,
      });
    }

    async function sendToAll(args:{
      target:"license"|"station";
      targetId:string;
      key:string;
      title:string;
      body:string;
      tag:string;
    }){
      for(const subscription of (subscriptions||[]) as Subscription[]){
        if(await alreadySent(subscription.id,args.target,args.targetId,args.key))continue;
        try{
          await webpush.sendNotification({
            endpoint:subscription.endpoint,
            keys:{p256dh:subscription.p256dh,auth:subscription.auth},
          },JSON.stringify({
            title:args.title,
            body:args.body,
            tag:args.tag,
            url:"./",
          }));
          await recordSent(subscription.id,args.target,args.targetId,args.key);
          sent++;
        }catch(error){
          const statusCode=(error as {statusCode?:number}).statusCode;
          if(statusCode===404||statusCode===410){
            await supabase.from("push_subscriptions").delete().eq("id",subscription.id);
            removed++;
          }else{
            errors.push(`${args.title}: ${(error as Error).message}`);
          }
        }
      }
    }

    for(const license of (licenses||[]) as License[]){
      if(!license.expiry_date)continue;
      const days=daysUntil(license.expiry_date);
      const key=eventKey(days);
      if(!key)continue;
      const room=roomByLicense.get(license.id);
      const type=license.category==="avid"?license.avid_type:license.plugin_type;
      const details=[
        room,
        type,
        license.billing_cycle==="monthly"?"Mensile":"Annuale",
      ].filter(Boolean).join(" • ");

      await sendToAll({
        target:"license",
        targetId:license.id,
        key,
        title:`${days<=0?"🔴":"🔔"} ${license.code}`,
        body:`${expiryText(days)}${details?`\n${details}`:""}`,
        tag:`license-${license.id}-${key}`,
      });
    }

    for(const station of (stations||[]) as Station[]){
      if(station.avid_trial_status!=="active"||!station.avid_trial_expiry)continue;
      const days=daysUntil(station.avid_trial_expiry);
      const key=eventKey(days);
      if(!key)continue;
      const room=station.rooms?.name||"Postazione";

      await sendToAll({
        target:"station",
        targetId:station.id,
        key,
        title:`${days<=0?"🔴":"🔔"} Trial Avid`,
        body:`${expiryText(days)}\n${room} • Trial attiva`,
        tag:`trial-${station.id}-${key}`,
      });
    }

    return new Response(JSON.stringify({ok:true,sent,removed,errors}),{status:200,headers});
  },
};
