package com.cryptosignal.aipro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";
    private static final String PREFS_NAME = "CryptoSignalPrefs";
    private static final String KEY_AUTO_START = "auto_start_trading";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.i(TAG, "Received: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean autoStart = prefs.getBoolean(KEY_AUTO_START, true);

            if (autoStart) {
                Log.i(TAG, "Auto-starting trading service after boot");
                try {
                    Intent serviceIntent = new Intent(context, TradingForegroundService.class);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent);
                    } else {
                        context.startService(serviceIntent);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Failed to start service after boot", e);
                    try {
                        Intent retryIntent = new Intent(context, ServiceRestartReceiver.class);
                        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getBroadcast(
                                context, 0, retryIntent,
                                android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
                        android.app.AlarmManager alarmManager = (android.app.AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                        if (alarmManager != null) {
                            alarmManager.set(android.app.AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 10000, pendingIntent);
                        }
                    } catch (Exception ex) { Log.e(TAG, "Retry failed", ex); }
                }
            }
        }
    }
}