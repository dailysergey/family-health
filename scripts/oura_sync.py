#!/usr/bin/env python3
"""
Синхронизация данных Oura Ring → /opt/health/data/<member>/wearables/YYYY-MM-DD.json

Использование:
  oura_sync.py                    # последние 2 дня, member=primary
  oura_sync.py --member primary --days 7
  oura_sync.py --backfill 30      # история за 30 дней
"""

import sys
import json
import os
import argparse
import datetime
import urllib.request
import urllib.parse
import urllib.error

DATA_DIR   = os.environ.get("HEALTH_DATA_DIR", "/opt/health/data")
ENV_FILE   = "/opt/health/web/.env.local"

# ── env ───────────────────────────────────────────────────────────────────────
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
CLIENT_ID     = ENV.get("OURA_CLIENT_ID", "")
CLIENT_SECRET = ENV.get("OURA_CLIENT_SECRET", "")

# ── token management ──────────────────────────────────────────────────────────
def token_file(member_id: str) -> str:
    return os.path.join(DATA_DIR, member_id, "oura-tokens.json")

def load_tokens(member_id: str) -> dict:
    try:
        with open(token_file(member_id)) as f:
            return json.load(f)
    except Exception:
        return {}

def save_tokens(member_id: str, tokens: dict):
    path = token_file(member_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(tokens, f, indent=2)

def refresh_access_token(member_id: str) -> str:
    """Получаем новый access_token через refresh_token."""
    tokens = load_tokens(member_id)
    if not tokens.get("refresh_token"):
        raise RuntimeError(f"No tokens for {member_id}. Run OAuth first: {SITE_URL}/api/oura/authorize?member={member_id}")

    # Проверяем не истёк ли текущий (с запасом 5 мин)
    if tokens.get("expires_at", 0) > (datetime.datetime.now().timestamp() * 1000 + 300_000):
        return tokens["access_token"]

    print(f"[oura_sync] Refreshing token for {member_id}...")
    data = urllib.parse.urlencode({
        "grant_type":    "refresh_token",
        "refresh_token": tokens["refresh_token"],
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
    }).encode()
    req = urllib.request.Request(
        "https://api.ouraring.com/oauth/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        new_tokens = json.load(r)

    tokens.update({
        "access_token":  new_tokens["access_token"],
        "refresh_token": new_tokens.get("refresh_token", tokens["refresh_token"]),
        "expires_at":    int(datetime.datetime.now().timestamp() * 1000) + new_tokens["expires_in"] * 1000,
    })
    save_tokens(member_id, tokens)
    return tokens["access_token"]

# ── Oura API v2 ───────────────────────────────────────────────────────────────
OURA_BASE = "https://api.ouraring.com/v2/usercollection"

def oura_get(endpoint: str, access_token: str, params: dict) -> dict:
    url = f"{OURA_BASE}/{endpoint}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {access_token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"[oura_sync] HTTP {e.code} for {endpoint}: {body[:200]}")
        return {}
    except Exception as ex:
        print(f"[oura_sync] Error fetching {endpoint}: {ex}")
        return {}

# ── data normalization ────────────────────────────────────────────────────────
def fetch_day(date_str: str, access_token: str) -> dict:
    """Забираем все нужные данные за один день."""
    p = {"start_date": date_str, "end_date": date_str}

    daily_activity  = oura_get("daily_activity",  access_token, p)
    daily_sleep     = oura_get("daily_sleep",     access_token, p)
    daily_readiness = oura_get("daily_readiness", access_token, p)
    daily_spo2      = oura_get("daily_spo2",      access_token, p)
    heartrate       = oura_get("heartrate",       access_token, {
        "start_datetime": f"{date_str}T00:00:00+00:00",
        "end_datetime":   f"{date_str}T23:59:59+00:00",
    })
    hrv_data        = oura_get("heartrate",       access_token, {
        "start_datetime": f"{date_str}T00:00:00+00:00",
        "end_datetime":   f"{date_str}T23:59:59+00:00",
    })

    def first(resp: dict):
        data = resp.get("data") or resp.get("dataPoints") or []
        return data[0] if data else {}

    act  = first(daily_activity)
    slp  = first(daily_sleep)
    read = first(daily_readiness)
    spo2 = first(daily_spo2)

    # Heartrate array → вычисляем avg/min/resting
    hr_items = heartrate.get("data") or []
    hr_values = [item["bpm"] for item in hr_items if item.get("bpm") and item.get("source") != "sleep"]
    hr_sleep  = [item["bpm"] for item in hr_items if item.get("source") == "sleep"]

    def safe_avg(lst):
        return round(sum(lst) / len(lst), 1) if lst else None

    # Steps: Oura считает total_steps в daily_activity
    steps = act.get("steps") or act.get("total_steps")

    # Active calories
    active_kcal = act.get("active_calories") or act.get("high_activity_met_minutes")

    # Sleep
    sleep_contrib = slp.get("contributors", {})
    sleep_eff = slp.get("efficiency")  # 0-100 от Oura
    sleep_score = slp.get("score")
    total_sleep_sec = slp.get("total_sleep_duration")
    sleep_min = round(total_sleep_sec / 60) if total_sleep_sec else None

    # Readiness
    readiness_score = read.get("score")
    rhr_oura = read.get("lowest_resting_heart_rate") or act.get("lowest_heart_rate")
    hrv_oura = read.get("average_hrv") or slp.get("average_hrv")

    # Oura sub-contributor scores (0–100) from daily_readiness.contributors
    contribs = read.get("contributors", {})
    r_hrv_balance       = contribs.get("hrv_balance")
    r_rhr               = contribs.get("resting_heart_rate")
    r_recovery_index    = contribs.get("recovery_index")
    r_sleep_balance     = contribs.get("sleep_balance")
    r_sleep_regularity  = contribs.get("sleep_regularity")
    r_activity_balance  = contribs.get("activity_balance")
    r_prev_day_activity = contribs.get("previous_day_activity")

    # SpO2
    spo2_avg = spo2.get("spo2_percentage", {}).get("average") if isinstance(spo2.get("spo2_percentage"), dict) else spo2.get("average")

    # Resting HR: берём из readiness, fallback — мин за ночь
    resting_hr = rhr_oura or (min(hr_sleep) if hr_sleep else None)

    # Active zone minutes (Oura не считает AZM, но есть met_minutes)
    medium_met = act.get("medium_activity_met_minutes") or 0
    high_met   = act.get("high_activity_met_minutes") or 0
    azm_approx = (medium_met + high_met) if (medium_met or high_met) else None

    result = {
        "date":               date_str,
        "source":             "oura",
        # Steps & activity
        "steps":              int(steps) if steps else None,
        "activeEnergyKcal":   int(active_kcal) if active_kcal else None,
        "activeZoneMinutes":  int(azm_approx) if azm_approx else None,
        # Heart rate
        "heartRateAvg":       safe_avg(hr_values),
        "heartRateMin":       min(hr_values) if hr_values else None,
        "heartRateMax":       max(hr_values) if hr_values else None,
        "restingHeartRate":   int(resting_hr) if resting_hr else None,
        # HRV
        "hrvRmssd":           float(hrv_oura) if hrv_oura else None,
        # Sleep
        "sleepMinutes":       sleep_min,
        "sleepEfficiency":    int(sleep_eff) if sleep_eff else None,
        "sleepScore":         int(sleep_score) if sleep_score else None,
        # SpO2
        "spo2":               round(float(spo2_avg), 1) if spo2_avg else None,
        # Readiness
        "readinessScore":           int(readiness_score)    if readiness_score    else None,
        # Oura sub-contributor scores 0–100
        "ouraHrvBalance":           int(r_hrv_balance)      if r_hrv_balance      else None,
        "ouraRhrScore":             int(r_rhr)              if r_rhr              else None,
        "ouraRecoveryIndex":        int(r_recovery_index)   if r_recovery_index   else None,
        "ouraSleepBalance":         int(r_sleep_balance)    if r_sleep_balance    else None,
        "ouraSleepRegularity":      int(r_sleep_regularity) if r_sleep_regularity else None,
        "ouraActivityBalance":      int(r_activity_balance) if r_activity_balance else None,
        "ouraPrevDayActivity":      int(r_prev_day_activity) if r_prev_day_activity else None,
        # Raw Oura scores для дашборда
        "_oura": {
            "readiness":    read,
            "sleep":        slp,
            "activity":     act,
        },
    }
    return {k: v for k, v in result.items() if v is not None}

# ── main ──────────────────────────────────────────────────────────────────────
def sync_member(member_id: str, days: int):
    print(f"[oura_sync] Syncing {member_id} for last {days} days...")
    access_token = refresh_access_token(member_id)

    today = datetime.date.today()
    for i in range(days - 1, -1, -1):
        date = today - datetime.timedelta(days=i)
        date_str = date.isoformat()
        out_dir  = os.path.join(DATA_DIR, member_id, "wearables")
        out_file = os.path.join(out_dir, f"{date_str}.json")
        os.makedirs(out_dir, exist_ok=True)

        print(f"[oura_sync]   → {date_str}", end=" ")
        day_data = fetch_day(date_str, access_token)

        # Если файл уже есть от другого источника — мержим
        existing = {}
        if os.path.exists(out_file):
            try:
                with open(out_file) as f:
                    existing = json.load(f)
            except Exception:
                pass

        # Oura данные приоритетнее (перезаписываем)
        merged = {**existing, **day_data}
        with open(out_file, "w") as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)
        print(f"✓ (steps={day_data.get('steps','–')}, hrv={day_data.get('hrvRmssd','–')}, rhr={day_data.get('restingHeartRate','–')})")

    print(f"[oura_sync] Done. {days} days synced for {member_id}.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--member",   default="primary")
    parser.add_argument("--days",     type=int, default=2)
    parser.add_argument("--backfill", type=int, default=0, help="Синхронизировать N дней истории")
    args = parser.parse_args()

    days = args.backfill if args.backfill > 0 else args.days
    sync_member(args.member, days)
