"use client";

import { Bell, Check, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { NotificationItem } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Props = {
  notifications: NotificationItem[];
  onMarkRead: (notificationIds: string[]) => Promise<void>;
};

export function NotificationMenu({ notifications, onMarkRead }: Props) {
  const [open, setOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const unread = useMemo(() => notifications.filter((notification) => !notification.readAt), [notifications]);

  async function markAllRead() {
    if (!unread.length || markingRead) return;
    setMarkingRead(true);
    try {
      await onMarkRead(unread.map((notification) => notification.id));
    } finally {
      setMarkingRead(false);
    }
  }

  return (
    <div className="relative">
      <Button type="button" variant="outline" size="icon" aria-label="Open notifications" onClick={() => setOpen((current) => !current)}>
        <Bell className="h-4 w-4" />
        {unread.length ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-600 px-1 text-[10px] font-semibold text-white">
            {unread.length}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">{unread.length ? `${unread.length} unread` : "All caught up"}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" disabled={!unread.length || markingRead} onClick={markAllRead}>
              <Check className="h-4 w-4" />
              Mark read
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length ? (
              notifications.map((notification) => (
                <a
                  key={notification.id}
                  href={notification.ctaHref ?? "#"}
                  className={cn(
                    "block border-b px-4 py-3 transition-colors last:border-0 hover:bg-muted/60",
                    !notification.readAt && "bg-cyan-50/60"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{notification.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{notification.message}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">{formatRelativeTime(notification.createdAt)}</p>
                    </div>
                    {notification.ctaHref ? <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                  </div>
                </a>
              ))
            ) : (
              <div className="px-4 py-10 text-center">
                <p className="font-medium">No notifications yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Workflow updates will appear here.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}
