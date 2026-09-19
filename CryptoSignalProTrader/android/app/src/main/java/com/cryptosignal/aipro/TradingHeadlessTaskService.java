package com.cryptosignal.aipro;

import android.content.Intent;

import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

import javax.annotation.Nullable;

public class TradingHeadlessTaskService extends HeadlessJsTaskService {

    @Override
    protected @Nullable HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        return new HeadlessJsTaskConfig(
                "TradingBackgroundTask",
                intent != null && intent.getExtras() != null
                    ? com.facebook.react.bridge.Arguments.fromBundle(intent.getExtras())
                    : com.facebook.react.bridge.Arguments.createMap(),
                0,
                true
        );
    }
}