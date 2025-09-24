import React, { useState } from "react";
import "../css/NotificationPopup.css";

type Alert = {
  id: string;
  channelName: string;
  message: string;
  created: string;
  ts?: string;
  type?: 'error' | 'delayed';
};

interface NotificationPopupProps {
  alerts: Alert[];
  onConfirm: () => void;
  onMarkAsRead?: (channelCode: string, messageTs: string) => void;
}

export default function NotificationPopup({ 
  alerts, 
  onConfirm,
  onMarkAsRead 
}: NotificationPopupProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!alerts.length) return null;

  const handleToggle = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMarkAsRead = (alert: Alert) => {
    if (onMarkAsRead && alert.ts) {
      onMarkAsRead(alert.id, alert.ts);
    }
  };

  const handleMarkAllAsRead = () => {
    if (onMarkAsRead) {
      alerts.forEach(alert => {
        if (alert.ts) {
          onMarkAsRead(alert.id, alert.ts);
        }
      });
    }
    onConfirm();
  };

  const errorAlerts = alerts.filter(alert => alert.type !== 'delayed');
  const delayedAlerts = alerts.filter(alert => alert.type === 'delayed');

  return (
    <div className="notification-overlay">
      <div className="notification-popup">
        <div className="popup-header">
          <span className="alert-icon">🚨</span>
          <h2 className="popup-title">Check Error</h2>
        </div>

        {/* Summary badges */}
        <div className="alerts-summary">
          {errorAlerts.length > 0 && (
            <div className="summary-badge error-summary">
              <span>⚠️</span>
              <span>{errorAlerts.length} Errors</span>
            </div>
          )}
          {delayedAlerts.length > 0 && (
            <div className="summary-badge delayed-summary">
              <span>⏰</span>
              <span>{delayedAlerts.length} Delayed Processes</span>
            </div>
          )}
        </div>

        <div className="alerts-container">
          {/* Error alerts section */}
          {errorAlerts.length > 0 && (
            <div className="alert-section">
              <div className="section-title">
                <span>⚠️</span>
                <span>System Errors</span>
              </div>
              {errorAlerts.map(alert => {
                const key = alert.id + ":" + alert.created;
                const limit = 120;
                const tooLong = alert.message.length > limit;
                const isExpanded = !!expanded[key];
                return (
                  <div
                    key={key}
                    className="alert-item error"
                    onClick={tooLong ? () => handleToggle(key) : undefined}
                  >
                    <div className="alert-header">
                      <span className="channel-badge">{alert.channelName}</span>
                      {alert.ts && onMarkAsRead && (
                        <button
                          className="read-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(alert);
                          }}
                          title="Mark this alert as read"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                    <div className={`alert-message ${isExpanded ? 'expanded' : ''}`}>
                      {tooLong
                        ? (isExpanded ? alert.message : alert.message.slice(0, limit) + "...")
                        : alert.message}
                    </div>
                    {tooLong && (
                      <div className="expand-hint">
                        Click to {isExpanded ? 'collapse' : 'expand'} message
                      </div>
                    )}
                    <div className="alert-timestamp">
                      {new Date(Number(alert.created) * 1000).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Delayed alerts section */}
          {delayedAlerts.length > 0 && (
            <div className="alert-section">
              <div className="section-title">
                <span>⏰</span>
                <span>Delayed Processes</span>
              </div>
              {delayedAlerts.map(alert => {
                const key = alert.id + ":" + alert.created;
                const limit = 120;
                const tooLong = alert.message.length > limit;
                const isExpanded = !!expanded[key];
                return (
                  <div
                    key={key}
                    className="alert-item delayed"
                    onClick={tooLong ? () => handleToggle(key) : undefined}
                  >
                    <div className="alert-header">
                      <span className="channel-badge delayed-channel-badge">{alert.channelName}</span>
                      {alert.ts && onMarkAsRead && (
                        <button
                          className="read-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(alert);
                          }}
                          title="Mark this alert as read"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                    <div className={`alert-message ${isExpanded ? 'expanded' : ''}`}>
                      {tooLong
                        ? (isExpanded ? alert.message : alert.message.slice(0, limit) + "...")
                        : alert.message}
                    </div>
                    {tooLong && (
                      <div className="expand-hint">
                        Click to {isExpanded ? 'collapse' : 'expand'} message
                      </div>
                    )}
                    <div className="alert-timestamp">
                      Process started: {new Date(Number(alert.created) * 1000).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="actions-container">
          {onMarkAsRead && (
            <button
              className="action-button mark-all-button"
              onClick={handleMarkAllAsRead}
            >
              Mark All Read
            </button>
          )}
          <button
            className="action-button confirm-button"
            onClick={onConfirm}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
