package com.cryptosignal.aipro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

import javax.annotation.Nullable;

public class TradingForegroundService extends Service {

    private static final String TAG = "TradingFgService";
    private static final String CHANNEL_ID = "crypto_trading_channel";
    private static final String CHANNEL_NAME = "AI Trading Engine";
    private static final int NOTIFICATION_ID = 1001;

    private PowerManager.WakeLock wakeLock;
    private static TradingForegroundService instance;
    private boolean isRunning = false;
    private long startTime;
    private int activePairs = 5;
    private int activeTrades = 0;
    private String lastSignal = "Waiting...";
    private String pnlStatus = "$0.00 (0%)";

    public static TradingForegroundService getInstance() {
        return instance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();
        acquireWakeLock();
        startTime = System.currentTimeMillis();
        isRunning = true;
        Log.i(TAG, "Trading foreground service created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "onStartCommand flags=" + flags + " startId=" + startId);

        String action = intent != null ? intent.getAction() : null;
        if ("STOP_SERVICE".equals(action)) {
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if ("UPDATE_STATUS".equals(action)) {
            if (intent != null) {
                if (intent.hasExtra("activePairs")) activePairs = intent.getIntExtra("activePairs", activePairs);
                if (intent.hasExtra("activeTrades")) activeTrades = intent.getIntExtra("activeTrades", activeTrades);
                if (intent.hasExtra("lastSignal")) lastSignal = intent.getStringExtra("lastSignal");
                if (intent.hasExtra("pnlStatus")) pnlStatus = intent.getStringExtra("pnlStatus");
            }
            updateNotification();
            return START_STICKY;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIFICATION_ID, buildNotification());
        }

        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Persistent AI trading engine notification");
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.enableVibration(false);
            channel.setSound(null, null);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent notificationIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stopIntent = new Intent(this, TradingForegroundService.class);
        stopIntent.setAction("STOP_SERVICE");
        PendingIntent stopPending = PendingIntent.getService(this, 1, stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        long uptimeMs = System.currentTimeMillis() - startTime;
        long uptimeMin = uptimeMs / 60000;
        long uptimeHrs = uptimeMin / 60;
        String uptime = uptimeHrs > 0 ? uptimeHrs + "h " + (uptimeMin % 60) + "m" : uptimeMin + "m";

        String contentText = String.format("🤖 AI Trader Active | %d pairs | %d trades | %s", activePairs, activeTrades, lastSignal);
        String subText = String.format("PnL: %s | Uptime: %s", pnlStatus, uptime);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("CryptoSignal AI Pro Trader")
                .setContentText(contentText)
                .setSubText(subText)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setAutoCancel(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .addAction(android.R.drawable.ic_delete, "Stop Trading", stopPending)
                .build();
    }

    public void updateNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification());
    }

    public void updateTradingStatus(int pairs, int trades, String signal, String pnl) {
        activePairs = pairs; activeTrades = trades; lastSignal = signal; pnlStatus = pnl;
        updateNotification();
    }

    private void acquireWakeLock() {
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CryptoSignal::TradingWakeLock");
            wakeLock.acquire();
            Log.i(TAG, "Wake lock acquired");
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) { wakeLock.release(); }
    }

    public boolean isServiceRunning() { return isRunning; }
    public long getUptime() { return System.currentTimeMillis() - startTime; }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        instance = null;
        releaseWakeLock();
        Log.i(TAG, "Service destroyed, scheduling restart...");
        Intent restartIntent = new Intent("com.cryptosignal.aipro.RESTART_SERVICE");
        sendBroadcast(restartIntent);
        try {
            Intent alarmIntent = new Intent(this, ServiceRestartReceiver.class);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(this, 0, alarmIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            android.app.AlarmManager alarmManager = (android.app.AlarmManager) getSystemService(ALARM_SERVICE);
            if (alarmManager != null) {
                alarmManager.set(android.app.AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 3000, pendingIntent);
            }
        } catch (Exception e) { Log.e(TAG, "Failed to schedule restart", e); }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}