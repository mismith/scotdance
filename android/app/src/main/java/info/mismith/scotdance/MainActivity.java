package info.mismith.scotdance;

import android.os.Bundle;

import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Until the page paints, the app's own background (light or dark),
        // not the WebView's white.
        getBridge().getWebView().setBackgroundColor(ContextCompat.getColor(this, R.color.app_background));
    }
}
