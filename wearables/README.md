# wearables

Опциональный слой: тянет данные с носимых устройств через [Google Health API v4](https://developers.google.com/health) — Fitbit Air, Pixel Watch, Wear OS-часы и что ещё умеет писать в Google Health. Синхронизированные метрики (шаги, ЧСС, сон, VO₂max, активные калории, HRV, SpO₂) складываются на диск рядом с остальными данными члена семьи — их видит и дашборд, и агент.

Собственных серверов и хранилища не добавляется: всё те же папки на диске.

## Что подключается

- **Устройства.** Всё, что публикует данные в Google Health: Fitbit Air, Fitbit Sense/Charge/Versa/Inspire, Pixel Watch, любые сторонние трекеры с интеграцией через Google Fit.
- **Инструмент.** [`ghealth`](https://github.com/Google-Health-API/google-health-cli) — единственный бинарь на Go, `--json`-first, дружественный к агентам.
- **Данные.** До 40 типов из Health API (steps, heart-rate, sleep, exercise, weight, body-fat, vo2-max, oxygen-saturation, hrv, active-zone-minutes, active-energy-burned, blood-glucose, hydration-log, nutrition-log — см. `ghealth schema types`).

## Как это устроено

```
Google Health API ──ghealth pull──▶ data/<memberId>/wearables/<YYYY-MM-DD>.json
                                    data/<memberId>/wearables/latest.json
```

- Один `ghealth`-профиль на члена семьи (`~/.config/ghealth/<memberId>/`) — потому что каждый пользуется своим Google-аккаунтом; у OAuth-токенов свои refresh-таймеры.
- `wearables/sync.sh` — фронт-эндж для `ghealth`: читает `family.json`, для каждого члена с флагом `wearables.enabled` вытягивает daily-rollup за последние N дней и пишет по одному JSON-файлу на день.
- Дневной rollup консолидирует все метрики в один документ, чтобы дашборд/агент не жонглировали десятком файлов:

  ```json
  {
    "date": "2026-07-14",
    "member": "parent1",
    "source": "ghealth",
    "steps": {"total": 8942, "goal": 10000, "hourly": [...]},
    "heart_rate": {"avg": 68, "min": 52, "max": 128, "resting": 58},
    "sleep":       {"minutesAsleep": 428, "minutesAwake": 34, "stages": {"deep": 84, "rem": 96, "light": 248}},
    "active_energy_kcal": 512,
    "active_zone_minutes": 41,
    "vo2max": 42.1,
    "spo2_avg": 96.5,
    "hrv_rmssd": 47
  }
  ```

- Файл `latest.json` — символическая ссылка на самый свежий rollup (для быстрого доступа из UI).

## Быстрый старт

Один раз на хосте:

```bash
# 1. Собрать бинарь (нужен Go).
bash wearables/install-ghealth.sh

# 2. Google Cloud project + OAuth (см. вывод команды — пошагово, всё через браузер).
GHEALTH_CONFIG_DIR=~/.config/ghealth/parent1 ghealth setup

# 3. Разрешить в data/family.json — добавить блок `wearables` этому члену:
#    { "id": "parent1", ..., "wearables": { "enabled": true, "device": "Fitbit Air" } }

# 4. Первый прогон синхронизации:
bash wearables/sync.sh --member parent1 --days 30
```

Дальше — по расписанию (см. `crontab.example`):

```
15 6 * * *  cd /opt/family-health && bash wearables/sync.sh --days 2 >> /var/log/health-sync.log 2>&1
```

## Схема `family.json` — расширение

Опциональный блок, включается для тех членов семьи, у кого есть носимое устройство:

```json
{
  "id": "parent1",
  "name": "Иван Иванович",
  "relation": "Папа",
  ...
  "wearables": {
    "enabled": true,
    "device": "Fitbit Air",
    "ghealth_config_dir": "~/.config/ghealth/parent1",
    "sync_days": 3
  }
}
```

Поля:

| Поле | Обязательно | Дефолт | Описание |
|---|---|---|---|
| `enabled` | да | — | флаг «синхронизировать» |
| `device` | нет | — | человеческое имя устройства (для UI/логов) |
| `ghealth_config_dir` | нет | `~/.config/ghealth/<memberId>` | куда `ghealth` кладёт credentials этого профиля |
| `sync_days` | нет | 2 | сколько последних дней тянуть при каждом прогоне |

## Развязка с data/

Wearables пишут в `data/<memberId>/wearables/` — та же папка, что и остальные медданные, тот же `.gitignore`. Ничего не попадает в репозиторий: секрет `client_secret.json` живёт в `~/.config/ghealth/` (mode 0600), rollup JSON — в `data/`.

## Docker

При деплое через `deploy/deploy.sh` тома монтируются автоматически:

- `~/.config/ghealth` → `/root/.config/ghealth` в контейнере (RO — контейнер только читает).
- `data/` — как обычно.

Первый `ghealth setup` делается на хосте (потому что OAuth требует браузер), потом токены доезжают в контейнер через bind-mount и обновляются самим `ghealth`-ом на хосте (refresh — cron-задача, не в контейнере).

## Ограничения

- **Один Google-аккаунт на один профиль.** Если муж и жена ходят под одним аккаунтом — используйте один `ghealth_config_dir`, но заведите двух членов семьи и синхронизируйте разные подмножества метрик вручную.
- **Health API v4 — только чтение исторических данных.** «Живой» стриминг ЧСС во время тренировки — не поддерживается; retention API определяет провайдер.
- **OAuth в статусе Testing.** Пока приложение не прошло верификацию Google, `refresh_token` живёт 7 дней и потом требует повторного consent. Для домашнего инстанса это ок — раз в неделю пройти OAuth-флоу заново. Для публичного deploy надо проходить полную верификацию Google (недели, аудит).

## Что реально приходит с Fitbit Air

Актуально на 15.07.2026 (проверено на боевом устройстве):

| Метрика | Fitbit Air (Health API v4) | Комментарий |
|---|---|---|
| `steps` | ✅ | daily-rollup с `countSum` |
| `heart-rate` (avg/min/max) | ✅ | daily-rollup, интервальные точки |
| `active-energy-burned` | ✅ | `kcalSum` за день |
| `sleep` (list) | 🟡 | приходит **после** 7-дневной калибровки устройства; в первую неделю пустой массив |
| `daily-resting-heart-rate` | 🟡 | появляется после калибровки |
| `daily-heart-rate-variability` | ⛔ | не публикуется через Health API v4 (только в Fitbit-приложении) |
| `daily-oxygen-saturation` | ⛔ | требует активного мониторинга ночью, включается вручную |
| `vo2-max` | 🟡 | ждёт GPS-тренировок + калибровку |
| `active-zone-minutes` | ⛔ | пока нет в Health API v4 для Fitbit Air |
| `electrocardiogram` / `irregular-rhythm-notification` | ⛔ | требуют отдельного scope и активации ECG-режима |

Первую неделю после активации Fitbit Air — «калибровка». Приложение Fitbit показывает готовность как «Калибровка · ещё N дней», кардионагрузка = 0%. За это время в Health API v4 приходят только базовые метрики: шаги, ЧСС, активные калории. Начиная с 8-го дня подтягиваются сон, resting HR, VO₂max.

Периодически Google Health API возвращает **500 Internal Server Error** для отдельных типов (пример: `sleep` для конкретного дня, при том что `steps` за этот же день выдаётся нормально). `sync.sh` устойчив к этому — падение одного вызова не ломает остальные, пустой блок просто попадает в rollup как `null`. При следующем прогоне cron'а данные подтягиваются.

Подробнее по `ghealth`: [github.com/Google-Health-API/google-health-cli](https://github.com/Google-Health-API/google-health-cli).
