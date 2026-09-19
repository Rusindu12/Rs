package com.cryptosignal.aipro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class ServiceRestartReceiver extends BroadcastReceiver {

    private static final String TAG = "ServiceRestartReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.i(TAG, "Service restart requested");
        try {
            Intent serviceIntent = new Intent(context, TradingForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            Log.i(TAG, "Service restarted successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to restart service", e);
        }
    }
}