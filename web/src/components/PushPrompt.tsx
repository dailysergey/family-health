"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

type Status = "idle" | "loading" | "subscribed" | "denied" | "unsupported";

export function PushPrompt({ memberId = "sergey" }: { memberId?: string }) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") { setStatus("denied"); return; }

    // Проверяем есть ли уже подписка
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setStatus("subscribed");
      })
    );
  }, []);

  const subscribe = async () => {
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setStatus("denied"); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), memberId }),
      });

      if (res.ok) setStatus("subscribed");
      else setStatus("idle");
    } catch (e) {
      console.error("push subscribe error", e);
      setStatus("idle");
    }
  };

  const unsubscribe = async () => {
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON(), action: "unsubscribe" }),
        });
        await sub.unsubscribe();
      }
      setStatus("idle");
    } catch {
      setStatus("subscribed");
    }
  };

  if (status === "unsupported") return null;

  return (
    <button
      type="button"
      onClick={status === "subscribed" ? unsubscribe : subscribe}
      disabled={status === "loading" || status === "denied"}
      className="btn btn-ghost justify-start gap-2.5 text-[13px] w-full"
    >
      {status === "loading" ? (
        <Loader2 size={16} className="animate-spin" />
      ) : status === "subscribed" ? (
        <Bell size={16} strokeWidth={2.5} />
      ) : (
        <BellOff size={16} strokeWidth={2.5} />
      )}
      <span>
        {status === "subscribed" ? "Уведомления вкл." :
         status === "denied"     ? "Уведомления заблок." :
         "Включить уведомления"}
      </span>
    </button>
  );
}
