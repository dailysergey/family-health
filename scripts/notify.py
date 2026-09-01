#!/usr/bin/env python3
"""
Скрипт уведомлений для Family Health Dashboard.

Режимы запуска:
  notify.py digest        — утренний дайджест здоровья
  notify.py anomaly       — проверка аномалий (после sync)
  notify.py sleep         — итог ночного сна
  notify.py wellbeing     — вечерний вопрос о самочувствии
  notify.py test          — тестовое уведомление
"""

import sys
import json
import os
import glob
import datetime
import urllib.request
import urllib.parse
import math

# ── конфиг ────────────────────────────────────────────────────────────────────
DATA_DIR    = os.environ.get("HEALTH_DATA_DIR", "/opt/health/data")
SUBS_FILE   = os.path.join(DATA_DIR, "push-subscriptions.json")
ENV_FILE    = "/opt/health/web/.env.local"

# Читаем .env.local
def load_env():
    env = {}
    try:
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip()
    except Exception:
        pass
    return env

ENV = load_env()
VAPID_PUBLIC  = ENV.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE = ENV.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = ENV.get("VAPID_SUBJECT", "mailto:you@example.com")
TG_TOKEN      = ENV.get("TELEGRAM_BOT_TOKEN", "")
TG_CHAT_ID    = ENV.get("TELEGRAM_CHAT_ID", "")
SITE_URL      = ENV.get("SITE_URL", "https://health.example.com")

# ── helpers ────────────────────────────────────────────────────────────────────
def send_telegram(text: str):
    if not TG_TOKEN:
        print("[notify] Telegram token not set, skip")
        return
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    payload = json.dumps({
        "chat_id": TG_CHAT_ID,
        "text": text,
        "disable_web_page_preview": True,
    }).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            print(f"[notify] Telegram sent: {r.status}")
    except Exception as e:
        print(f"[notify] Telegram error: {e}")

def send_webpush(payload: dict):
    """Отправить push через pywebpush если установлен, иначе через node."""
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        # Фолбэк через node-скрипт
        _send_webpush_node(payload)
        return

    subs = load_subscriptions()
    if not subs:
        print("[notify] No push subscriptions")
        return

    for sub in subs:
        try:
            webpush(
                subscription_info=sub,
                data=json.dumps(payload),
                vapid_private_key=VAPID_PRIVATE,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
            print(f"[notify] Push sent to {str(sub.get('endpoint',''))[:50]}...")
        except WebPushException as e:
            print(f"[notify] Push error: {e}")
            if e.response and e.response.status_code == 410:
                # subscription expired — удалим
                remove_subscription(sub.get("endpoint", ""))

def _send_webpush_node(payload: dict):
    """Отправить push через node скрипт (если pywebpush недоступен)."""
    node_script = "/opt/health/scripts/send-push.js"
    if not os.path.exists(node_script):
        print("[notify] node push script not found, skip")
        return
    import subprocess
    subprocess.run(
        ["node", node_script, json.dumps(payload)],
        capture_output=True, text=True, timeout=30
    )

def load_subscriptions():
    try:
        with open(SUBS_FILE) as f:
            return json.load(f)
    except Exception:
        return []

def remove_subscription(endpoint: str):
    subs = [s for s in load_subscriptions() if s.get("endpoint") != endpoint]
    with open(SUBS_FILE, "w") as f:
        json.dump(subs, f)

def notify(title: str, body: str, tag: str, url: str = "/", require_interaction: bool = False):
    """Отправить уведомление во все доступные каналы."""
    payload = {"title": title, "body": body, "tag": tag, "url": url,
               "requireInteraction": require_interaction}
    send_webpush(payload)
    send_telegram(f"🏥 {title}\n\n{body}\n\n{SITE_URL}{url}")

# ── данные ─────────────────────────────────────────────────────────────────────
def latest_wearables(member_id: str, days: int = 3) -> list[dict]:
    """Последние N дней wearables для member."""
    wdir = os.path.join(DATA_DIR, member_id, "wearables")
    files = sorted(glob.glob(os.path.join(wdir, "20??-??-??.json")), reverse=True)
    result = []
    for f in files[:days]:
        try:
            with open(f) as fp:
                result.append(json.load(fp))
        except Exception:
            pass
    return result

def parse_day(raw: dict) -> dict:
    """Парсим сырой wearables JSON в нормализованный dict."""
    def num(v):
        try: return float(v) if v is not None else None
        except Exception: return None

    def first_dp(key):
        dp = (raw.get(key) or {}).get("dataPoints") or []
        return dp[0] if dp else {}

    hr = first_dp("heart_rate")
    rhr_dp = first_dp("resting_heart_rate")
    hrv_dp = first_dp("hrv")
    sleep_list = (raw.get("sleep") or {}).get("dataPoints") or []
    azm = (raw.get("active_zone_minutes") or {}).get("dataPoints") or []
    azm = azm[0] if azm else {}
    steps_dp = ((raw.get("steps") or {}).get("dataPoints") or [{}])[0]

    # sleep efficiency — берём одну запись (наибольший totalMinutes), иначе суммируем два источника
    sleep_eff = None
    if sleep_list:
        s = max(sleep_list, key=lambda x: num(x.get("totalMinutes")) or 0)
        sleep_eff = num(s.get("efficiency"))
        if sleep_eff is None:
            asleep = num(s.get("minutesAsleep")) or 0
            awake  = num(s.get("minutesAwake")) or 0
            total  = num(s.get("totalMinutes")) or (asleep + awake)
            if total > 0:
                sleep_eff = round(asleep / total * 100)

    azm_total = (
        (num(azm.get("activeZoneMinutesSum")) or 0) +
        (num(azm.get("sumInFatBurnHeartZone")) or 0) +
        (num(azm.get("sumInCardioHeartZone"))  or 0) +
        (num(azm.get("sumInPeakHeartZone"))    or 0)
    ) or None
    # dedupe (если activeZoneMinutesSum уже включает остальные — нет, это отдельные поля)
    if num(azm.get("activeZoneMinutesSum")) is not None:
        azm_total = num(azm.get("activeZoneMinutesSum"))

    return {
        "date":              raw.get("date", ""),
        "rhr":               num(rhr_dp.get("beatsPerMinute")) or num(hr.get("beatsPerMinuteAvg")),
        "hrv":               num(hrv_dp.get("rmssd")),
        "sleep_efficiency":  sleep_eff,
        "sleep_minutes":     (lambda s: num(s.get("minutesAsleep")) or 0)(max(sleep_list, key=lambda x: num(x.get("totalMinutes")) or 0)) if sleep_list else 0,
        "azm":               azm_total,
        "steps":             num(steps_dp.get("countSum")),
    }

# ── режимы ─────────────────────────────────────────────────────────────────────
def mode_digest():
    """Утренний дайджест: краткая сводка за вчера."""
    raws = latest_wearables("primary", 2)
    if not raws:
        print("[notify] No data for digest")
        return

    day = parse_day(raws[0])
    lines = []

    if day["sleep_efficiency"] is not None:
        emoji = "😴✅" if day["sleep_efficiency"] >= 85 else ("😴⚠️" if day["sleep_efficiency"] >= 70 else "😴❌")
        dur = f", {int(day['sleep_minutes'] // 60)}ч {int(day['sleep_minutes'] % 60)}м" if day["sleep_minutes"] else ""
        lines.append(f"{emoji} Сон: {day['sleep_efficiency']}%{dur}")

    if day["rhr"] is not None:
        emoji = "❤️" if day["rhr"] < 65 else ("❤️⚠️" if day["rhr"] < 80 else "❤️❌")
        lines.append(f"{emoji} ЧСС покоя: {int(day['rhr'])} bpm")

    if day["hrv"] is not None:
        lines.append(f"📡 HRV: {int(day['hrv'])} мс")

    if day["azm"] is not None:
        lines.append(f"🏃 Активные зоны: {int(day['azm'])} мин")

    if day["steps"] is not None:
        emoji = "👟✅" if day["steps"] >= 8000 else "👟"
        lines.append(f"{emoji} Шаги: {int(day['steps'])}")

    if not lines:
        print("[notify] Digest: nothing to report")
        return

    body = "\n".join(lines)
    notify("Дайджест здоровья", body, tag="health-digest", url="/")

def mode_anomaly():
    """Проверка аномалий после синхронизации."""
    raws = latest_wearables("primary", 3)
    if not raws:
        return

    day = parse_day(raws[0])
    alerts = []

    # ЧСС покоя > 85 bpm — высокая
    if day["rhr"] is not None and day["rhr"] > 85:
        alerts.append(f"ЧСС покоя высокая: {int(day['rhr'])} bpm (норма < 65)")

    # Сон < 70%
    if day["sleep_efficiency"] is not None and day["sleep_efficiency"] < 70:
        alerts.append(f"Плохой сон: {day['sleep_efficiency']}% (норма > 85%)")

    # HRV сильно упал относительно предыдущих дней
    if len(raws) >= 3:
        prev_days = [parse_day(r) for r in raws[1:3]]
        hrv_prev = [d["hrv"] for d in prev_days if d["hrv"] is not None]
        if hrv_prev and day["hrv"] is not None:
            avg_prev = sum(hrv_prev) / len(hrv_prev)
            if day["hrv"] < avg_prev * 0.7:
                alerts.append(f"HRV упал: {int(day['hrv'])} мс (среднее за 2 дня: {int(avg_prev)} мс)")

    if not alerts:
        print("[notify] No anomalies")
        return

    body = "\n".join(f"• {a}" for a in alerts)
    notify("⚠️ Аномалия в данных", body, tag="health-anomaly",
           url="/", require_interaction=True)

def mode_sleep():
    """Уведомление о качестве ночного сна (утром)."""
    raws = latest_wearables("primary", 1)
    if not raws:
        return

    day = parse_day(raws[0])
    if day["sleep_efficiency"] is None:
        return

    eff = day["sleep_efficiency"]
    dur_str = ""
    if day["sleep_minutes"]:
        h, m = int(day["sleep_minutes"] // 60), int(day["sleep_minutes"] % 60)
        dur_str = f"{h}ч {m}м"

    if eff >= 90:
        title, emoji = "Отличный сон!", "😴✨"
    elif eff >= 80:
        title, emoji = "Хороший сон", "😴✅"
    elif eff >= 70:
        title, emoji = "Сон средний", "😴⚠️"
    else:
        title, emoji = "Плохой сон", "😴❌"

    body = f"{emoji} Эффективность: {eff}%"
    if dur_str:
        body += f"\nПродолжительность: {dur_str}"

    notify(title, body, tag="health-sleep", url="/")

def mode_wellbeing():
    """Вечерний вопрос о самочувствии."""
    notify(
        "Как самочувствие?",
        "Оцени своё состояние сегодня — это поможет отследить динамику 🌟",
        tag="health-wellbeing",
        url="/?wellbeing=1",
        require_interaction=True,
    )
    # Дополнительно в Telegram с кнопками-подсказками
    if TG_TOKEN:
        url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
        payload = json.dumps({
            "chat_id": TG_CHAT_ID,
            "text": "Как самочувствие сегодня? Открой дашборд или ответь одним словом 👇",
            "reply_markup": json.dumps({
                "inline_keyboard": [[
                    {"text": "😀 Отлично", "callback_data": "wellbeing_5"},
                    {"text": "🙂 Хорошо", "callback_data": "wellbeing_4"},
                    {"text": "😐 Средне", "callback_data": "wellbeing_3"},
                    {"text": "😟 Плохо", "callback_data": "wellbeing_2"},
                ]]
            }),
        }).encode()
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=10):
                pass
        except Exception as e:
            print(f"[notify] Wellbeing Telegram error: {e}")

def mode_test():
    notify(
        "Тест уведомлений",
        "Если видишь это — Web Push и Telegram работают ✅",
        tag="health-test",
        url="/",
    )

# ── main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "test"
    print(f"[notify] mode={mode} at {datetime.datetime.now().isoformat()}")
    {
        "digest":    mode_digest,
        "anomaly":   mode_anomaly,
        "sleep":     mode_sleep,
        "wellbeing": mode_wellbeing,
        "test":      mode_test,
    }.get(mode, mode_test)()
