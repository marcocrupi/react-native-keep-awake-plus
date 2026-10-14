package com.sayem.keepawake;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;

public class KCKeepAwake extends NativeKCKeepAwakeSpec {

    private final KCKeepAwakeImpl delegate;

    public KCKeepAwake(ReactApplicationContext reactContext) {
        super(reactContext);
        delegate = new KCKeepAwakeImpl(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return KCKeepAwakeImpl.NAME;
    }

    @Override
    public void initialize() {
        super.initialize();
        delegate.initialize();
    }

    @Override
    public void invalidate() {
        try {
            delegate.invalidate();
        } finally {
            super.invalidate();
        }
    }
    
    @Override
    public void activate() {
        delegate.activate();
    }
    
    @Override
    public void deactivate() {
        delegate.deactivate();
    }
}
