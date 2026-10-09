import React, { useState } from 'react';
import {
  X,
  CheckCheck,
  Trash2,
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  Server,
  Clock,
  Filter
} from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onClearAll,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'issues'>('all');

  if (!isOpen) return null;

  const filtered = notifications.filter((item) => {
    if (filter === 'unread') return !item.isRead;
    if (filter === 'issues') return item.severity === 'warning' || item.severity === 'error';
    return true;
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-carbon-900 border-l border-carbon-700 h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-carbon-700 flex items-center justify-between bg-carbon-850/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-carbon-800 border border-carbon-700 text-dorito-500">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Notification Center</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-rose-500 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-carbon-400">Alerts, benchmarks & system events</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-carbon-400 hover:text-white hover:bg-carbon-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills & Bulk Actions */}
        <div className="px-5 py-3 border-b border-carbon-700/80 flex items-center justify-between text-xs gap-2 bg-carbon-900">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                filter === 'all'
                  ? 'bg-carbon-800 text-dorito-400 font-semibold border border-dorito-500/30'
                  : 'text-carbon-400 hover:text-carbon-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                filter === 'unread'
                  ? 'bg-carbon-800 text-rose-400 font-semibold border border-rose-500/30'
                  : 'text-carbon-400 hover:text-carbon-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('issues')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                filter === 'issues'
                  ? 'bg-carbon-800 text-amber-400 font-semibold border border-amber-500/30'
                  : 'text-carbon-400 hover:text-carbon-200'
              }`}
            >
              Issues
            </button>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="flex items-center gap-1 text-[11px] font-mono text-carbon-400 hover:text-dorito-400 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Read All</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1 text-[11px] font-mono text-carbon-500 hover:text-rose-400 transition-colors"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-carbon-800 p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-carbon-500">
              <Bell className="w-8 h-8 mb-2 opacity-30 text-carbon-400" />
              <p className="text-xs font-mono text-carbon-400">No notifications found</p>
              <p className="text-[11px] text-carbon-500 mt-1">
                {filter === 'unread' ? 'All caught up!' : 'System is running quietly and healthy'}
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => !item.isRead && onMarkAsRead(item.id)}
                className={`group p-3 rounded-lg transition-all cursor-pointer relative border ${
                  item.isRead
                    ? 'bg-carbon-900/60 border-transparent hover:bg-carbon-850 text-carbon-300'
                    : 'bg-carbon-850/80 border-carbon-700/80 hover:border-dorito-500/40 text-carbon-100 shadow-sm'
                }`}
              >
                {!item.isRead && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-dorito-500" />
                )}

                <div className="flex items-start gap-2.5">
                  {getSeverityIcon(item.severity)}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className={`text-xs font-semibold truncate ${item.isRead ? 'text-carbon-200' : 'text-white'}`}>
                        {item.title}
                      </h4>
                    </div>

                    <p className="text-xs text-carbon-400 leading-relaxed break-words font-sans">
                      {item.message}
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-carbon-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(item.createdAt)}
                      </span>

                      {item.hostId && (
                        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-carbon-800 text-carbon-400 border border-carbon-700">
                          <Server className="w-2.5 h-2.5" />
                          Host Event
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                        className="ml-auto opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-opacity p-0.5"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
