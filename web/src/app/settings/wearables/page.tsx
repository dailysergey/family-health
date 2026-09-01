import { listMembers } from "@/lib/store";
import Link from "next/link";
import path from "path";
import fs from "fs";
import { ChevronLeft, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { SettingsNav } from "./SettingsNav";
import { MemberPicker } from "./MemberPicker";
import { DeviceCard } from "@/components/DeviceCard";

export const dynamic = "force-dynamic";

const DATA_DIR = process.env.HEALTH_DATA_DIR ?? "/opt/health/data";

function hasOuraTokens(memberId: string): boolean {
  try {
    return fs.existsSync(path.join(DATA_DIR, memberId, "oura-tokens.json"));
  } catch {
    return false;
  }
}

function getOuraTokenInfo(memberId: string): { connected: boolean; connectedAt?: string } {
  try {
    const file = path.join(DATA_DIR, memberId, "oura-tokens.json");
    if (!fs.existsSync(file)) return { connected: false };
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      connected: true,
      connectedAt: data.connected_at,
    };
  } catch {
    return { connected: false };
  }
}

export default async function WearablesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member: memberParam } = await searchParams;
  const members = await listMembers();
  const activeMember = members.find((m) => m.id === memberParam) ?? members[0];
  const activeMemberId = activeMember?.id ?? "";

  const ouraInfo = activeMember ? getOuraTokenInfo(activeMember.id) : { connected: false };
  const gfitConnected = !!(activeMember?.wearables?.ghealth_config_dir);
  const wearablesEnabled = !!(activeMember?.wearables?.enabled);
  const wearableDevice = activeMember?.wearables?.device ?? null;
  const wearableAccount = activeMember?.wearables?.account ?? null;

  // Any connection source counts as "has devices"
  const hasAnyDevice = ouraInfo.connected || wearablesEnabled;

  const connectedDate = ouraInfo.connectedAt
    ? new Date(ouraInfo.connectedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <main className="flex-1 min-w-0 md:h-screen md:overflow-y-auto">
      <SettingsNav members={members} />
      <div className="max-w-2xl mx-auto px-6 py-8 pb-28 md:pb-8">

        <Link
          href="/"
          className="inline-flex items-center gap-1 text-subheadline mb-6"
          style={{ color: "var(--color-brand)" }}
        >
          <ChevronLeft size={16} />
          Назад
        </Link>

        <header className="mb-6">
          <h1 className="text-large-title font-bold text-text-primary">Носимые устройства</h1>
          <p className="text-callout text-text-secondary mt-2">
            Подключите фитнес-трекер для отслеживания восстановления, нагрузки и сна. Каждый член семьи настраивает своё устройство.
          </p>
        </header>

        {/* Member selector */}
        <div className="mb-6">
          <div className="text-footnote font-semibold text-text-tertiary uppercase tracking-wide mb-3">
            Для кого настраиваем
          </div>
          <MemberPicker members={members} activeMemberId={activeMemberId} />
        </div>

        {/* Current status for selected member */}
        {activeMember && (
          <div
            className="mb-6 rounded-card p-5 border"
            style={{
              background: hasAnyDevice ? "rgba(48,209,88,0.06)" : "var(--color-bg-secondary)",
              borderColor: hasAnyDevice ? "rgba(48,209,88,0.2)" : "var(--color-separator)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-headline font-semibold text-text-primary mb-2">
                  {activeMember.name.split(" ").slice(0, 2).join(" ")}
                </div>

                {/* Connected devices list */}
                {hasAnyDevice ? (
                  <div className="space-y-1.5">
                    {wearablesEnabled && wearableDevice && (
                      <div className="flex items-center gap-2">
                        <span className="text-subheadline text-green-400">✓</span>
                        <span className="text-subheadline text-text-primary font-medium">{wearableDevice}</span>
                        {gfitConnected && (
                          <span className="text-caption-1 text-text-tertiary">via Google Fit</span>
                        )}
                        {wearableAccount && (
                          <span className="text-caption-1 text-text-tertiary truncate">· {wearableAccount}</span>
                        )}
                      </div>
                    )}
                    {ouraInfo.connected && (
                      <div className="flex items-center gap-2">
                        <span className="text-subheadline text-green-400">✓</span>
                        <span className="text-subheadline text-text-primary font-medium">Oura Ring</span>
                        {connectedDate && (
                          <span className="text-caption-1 text-text-tertiary">· подключён {connectedDate}</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-subheadline text-text-tertiary">Нет подключённых устройств</div>
                )}
              </div>

              <span
                className="inline-flex items-center gap-1.5 text-caption-1 font-semibold px-3 py-1.5 rounded-full shrink-0"
                style={{
                  background: hasAnyDevice ? "rgba(48,209,88,0.12)" : "var(--color-fill-quaternary)",
                  color: hasAnyDevice ? "var(--color-status-normal)" : "var(--color-text-tertiary)",
                }}
              >
                {hasAnyDevice ? <Wifi size={12} /> : <WifiOff size={12} />}
                {hasAnyDevice ? "Активно" : "Не подключено"}
              </span>
            </div>
          </div>
        )}

        {/* Device cards */}
        <div className="space-y-6">

          {/* Oura Ring — with per-member OAuth */}
          <div className="bg-bg-secondary rounded-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-inner bg-bg-tertiary flex items-center justify-center text-xl shrink-0">
                  🔴
                </div>
                <div>
                  <div className="text-headline font-semibold text-text-primary">Oura Ring</div>
                  <div className="text-subheadline text-text-tertiary">Oura Ring 3, Oura Ring 4</div>
                </div>
              </div>
              <span
                className="text-caption-1 font-semibold px-2.5 py-1 rounded-chip shrink-0"
                style={{
                  background: ouraInfo.connected ? "rgba(48,209,88,0.12)" : "var(--color-bg-tertiary)",
                  color: ouraInfo.connected ? "var(--color-status-normal)" : "var(--color-text-tertiary)",
                }}
              >
                {ouraInfo.connected ? "Подключено" : "Не подключено"}
              </span>
            </div>

            {!ouraInfo.connected ? (
              <>
                <ol className="space-y-3 mb-5">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-caption-2 font-bold mt-0.5" style={{ background: "var(--color-brand)", color: "#fff" }}>1</span>
                    <div>
                      <div className="text-subheadline font-medium text-text-primary">Синхронизируйте кольцо через приложение</div>
                      <div className="text-subheadline text-text-tertiary mt-0.5">Откройте приложение Oura на телефоне и дождитесь синхронизации. Без этого данных в облаке не будет.</div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-caption-2 font-bold mt-0.5" style={{ background: "var(--color-brand)", color: "#fff" }}>2</span>
                    <div>
                      <div className="text-subheadline font-medium text-text-primary">Нажмите «Подключить» и войдите в аккаунт Oura</div>
                      <div className="text-subheadline text-text-tertiary mt-0.5">Откроется cloud.ouraring.com. Войдите в тот же аккаунт, что использует кольцо.</div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-caption-2 font-bold mt-0.5" style={{ background: "var(--color-brand)", color: "#fff" }}>3</span>
                    <div>
                      <div className="text-subheadline font-medium text-text-primary">Разрешите доступ</div>
                      <div className="text-subheadline text-text-tertiary mt-0.5">Отметьте все запрошенные разрешения: Activity, Sleep, Heart rate, Readiness — и нажмите Allow.</div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-caption-2 font-bold mt-0.5" style={{ background: "var(--color-brand)", color: "#fff" }}>4</span>
                    <div>
                      <div className="text-subheadline font-medium text-text-primary">Данные появятся автоматически</div>
                      <div className="text-subheadline text-text-tertiary mt-0.5">После авторизации дашборд подтянет историю за 30 дней: HRV, пульс покоя, сон, readiness-score.</div>
                    </div>
                  </li>
                </ol>
                <a
                  href={`/api/oura/authorize?member=${activeMemberId}`}
                  className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-inner font-semibold text-subheadline transition-opacity hover:opacity-90"
                  style={{ background: "#ff3a5c", color: "#fff" }}
                >
                  🔴 Подключить Oura Ring
                </a>
              </>
            ) : (
              <div className="space-y-3">
                <div className="text-subheadline text-text-secondary">
                  Кольцо подключено. HRV, пульс покоя, сон и readiness-score синхронизируются ежедневно.
                  Для актуальных данных открывайте приложение Oura на телефоне — оно загружает данные с кольца в облако.
                </div>
                <div className="flex gap-3">
                  <a
                    href={`/api/oura/authorize?member=${activeMemberId}`}
                    className="inline-flex items-center gap-1.5 text-subheadline font-medium px-4 py-2 rounded-inner transition-colors"
                    style={{ background: "var(--color-fill-quaternary)", color: "var(--color-text-secondary)" }}
                  >
                    <RefreshCw size={14} />
                    Переподключить
                  </a>
                  <a
                    href="https://cloud.ouraring.com/oauth/applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-subheadline font-medium px-4 py-2 rounded-inner transition-colors"
                    style={{ background: "var(--color-fill-quaternary)", color: "var(--color-brand)" }}
                  >
                    Управление доступом →
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Google Fit / Health Connect */}
          <DeviceCard
            icon="🏥"
            name="Google Fit / Health Connect"
            description="Android, Wear OS, Fitbit (через Google)"
            connected={gfitConnected || (wearablesEnabled && !!wearableDevice && !ouraInfo.connected)}
            deviceLabel={wearableDevice ?? undefined}
            steps={[
              {
                title: "Установите ghealth на сервере",
                body: "Запустите скрипт wearables/install-ghealth.sh. Он установит CLI-клиент Google Health.",
              },
              {
                title: "Авторизуйтесь",
                body: `ghealth auth --member ${activeMemberId} — откроет браузер для OAuth 2.0 под аккаунтом этого пользователя.`,
              },
              {
                title: "Настройте cron-синхронизацию",
                body: "Добавьте в crontab строку из wearables/crontab.example с флагом --member " + activeMemberId + ".",
              },
              {
                title: "Обновите family.json",
                body: `В профиле "${activeMember?.name ?? activeMemberId}" добавьте: wearables: { enabled: true, device: "Pixel Watch", ghealth_config_dir: "~/.config/ghealth/${activeMemberId}" }`,
              },
            ]}
            docsUrl="https://developers.google.com/fit"
          />

          {/* WHOOP */}
          <DeviceCard
            icon="⬛"
            name="WHOOP"
            description="WHOOP 4.0, WHOOP 5"
            steps={[
              {
                title: "Получите доступ к WHOOP API",
                body: "Зайдите на developer.whoop.com → Register. API в beta, нужна заявка. Получите Client ID и Secret.",
              },
              {
                title: "OAuth авторизация",
                body: `Endpoint: https://api.prod.whoop.com/oauth/oauth2/auth. State: ${activeMemberId}. Scope: read:recovery read:sleep read:workout.`,
              },
              {
                title: "Забирайте данные",
                body: "GET /developer/v1/recovery → hrv_rmssd, resting_heart_rate. GET /developer/v1/sleep → score.sleep_efficiency.",
              },
              {
                title: "Сохраните в data/" + activeMemberId + "/wearables/",
                body: "Файлы YYYY-MM-DD.json в папке члена семьи. Поля: hrvRmssd, restingHeartRate, sleepEfficiency.",
              },
            ]}
            docsUrl="https://developer.whoop.com"
          />

          {/* Fitbit */}
          <DeviceCard
            icon="🟦"
            name="Fitbit"
            description="Charge, Versa, Sense, Inspire"
            steps={[
              {
                title: "Создайте приложение Fitbit",
                body: "dev.fitbit.com → Register an App. Тип: Personal. Скопируйте Client ID и Client Secret.",
              },
              {
                title: "OAuth 2.0 авторизация",
                body: `Scope: activity, heartrate, sleep, profile. После auth — сохраните токены для "${activeMember?.name ?? activeMemberId}" в data/${activeMemberId}/.`,
              },
              {
                title: "Синхронизируйте данные",
                body: "GET https://api.fitbit.com/1/user/-/activities/date/today.json. Маппинг: steps, heart.restingHeartRate, sleep.efficiency → WearablesDaily.",
              },
              {
                title: "Включите в family.json",
                body: `В профиле "${activeMember?.name ?? activeMemberId}": wearables: { enabled: true, device: "Fitbit Charge 6" }`,
              },
            ]}
            docsUrl="https://dev.fitbit.com/build/reference/web-api/"
          />
        </div>
      </div>
    </main>
  );
}
