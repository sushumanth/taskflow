import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Bell, CheckCheck } from 'lucide-react';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/api';
import type { Notification } from '../types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );

  const fetchNotifications = async () => {
    try {
      const response = await getNotifications(20);
      if (response.success) {
        setNotifications(response.notifications || []);
      }
    } catch (error) {
      console.error('Failed to load notifications');
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item._id === id ? { ...item, isRead: true } : item))
      );
    } catch (error) {
      console.error('Failed to mark notification read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      console.error('Failed to mark notifications read');
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-gray-500">{unreadCount} unread</p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4" />
            Mark all
          </Button>
        </div>
        <ScrollArea className="h-[320px]">
          <div className="divide-y">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-gray-500">No notifications yet.</p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item._id}
                  className={`px-4 py-3 text-sm ${item.isRead ? 'bg-white' : 'bg-blue-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-600">{item.message}</p>
                      <p className="text-[11px] text-gray-400">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </p>
                      {item.taskId && (
                        <Link
                          to={`/tasks/${item.taskId}`}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          View task
                        </Link>
                      )}
                    </div>
                    {!item.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkRead(item._id)}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
