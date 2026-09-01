#!/usr/bin/env node
/**
 * Отправляет Web Push уведомление подписчикам.
 * Использование: node send-push.js '{"title":"...", "body":"...", "tag":"...", "url":"/"}'
 *
 * Зависимости: web-push (npm install web-push в /opt/health/web/)
 */
"use strict";

const fs   = require("fs");
const path = require("path");

// Загружаем web-push из node_modules приложения
let webpush;
try {
  webpush = require("/opt/health/web/node_modules/web-push");
} catch (e) {
  console.error("[send-push] web-push not found:", e.message);
  process.exit(1);
}

// Читаем .env.local
function loadEnv(file) {
  const env = {};
  try {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  } catch {}
  return env;
}

const ENV = loadEnv("/opt/health/web/.env.local");

const VAPID_PUBLIC  = ENV["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] || "";
const VAPID_PRIVATE = ENV["VAPID_PRIVATE_KEY"] || "";
const VAPID_SUBJECT = ENV["VAPID_SUBJECT"]     || "mailto:you@example.com";
const DATA_DIR      = process.env.HEALTH_DATA_DIR || "/opt/health/data";
const SUBS_FILE     = path.join(DATA_DIR, "push-subscriptions.json");

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error("[send-push] VAPID keys missing");
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

// Payload — первый аргумент или stdin
let payload;
if (process.argv[2]) {
  try { payload = JSON.parse(process.argv[2]); }
  catch { payload = { title: process.argv[2] }; }
} else {
  console.error("[send-push] Usage: node send-push.js '<json>'");
  process.exit(1);
}

// Загрузка подписчиков
let subs = [];
try { subs = JSON.parse(fs.readFileSync(SUBS_FILE, "utf8")); }
catch { console.log("[send-push] No subscriptions file"); process.exit(0); }

if (!subs.length) { console.log("[send-push] No subscribers"); process.exit(0); }

const expiredEndpoints = [];

Promise.allSettled(
  subs.map((sub) =>
    webpush.sendNotification(sub, JSON.stringify(payload))
      .then(() => console.log("[send-push] Sent to", String(sub.endpoint).slice(0, 50)))
      .catch((err) => {
        if (err.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
          console.log("[send-push] Expired subscription removed:", String(sub.endpoint).slice(0, 50));
        } else {
          console.error("[send-push] Error:", err.statusCode, err.body);
        }
      })
  )
).then(() => {
  if (expiredEndpoints.length) {
    const fresh = subs.filter((s) => !expiredEndpoints.includes(s.endpoint));
    fs.writeFileSync(SUBS_FILE, JSON.stringify(fresh, null, 2));
  }
});
