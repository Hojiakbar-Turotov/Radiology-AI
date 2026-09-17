package uz.onco.uttbemor;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final String PREFS_NAME = "UttBemorSettings";
    private static final String KEY_TARGET_URL = "target_url";

    private static final String DEFAULT_LOCAL_IP = "10.34.17.210";
    private static final String DEFAULT_LOCAL_URL = "http://" + DEFAULT_LOCAL_IP + ":9877/bemor";
    private static final String DEFAULT_LOCAL_FALLBACK = "http://" + DEFAULT_LOCAL_IP + ":9880/bemor";
    private static final String OFFLINE_ASSET_URL = "file:///android_asset/bemor.html";

    private WebView webView;
    private LinearLayout errorOverlay;
    private TextView errorUrlText;
    private Button btnRetry;
    private Button btnOpenSettings;

    private SharedPreferences prefs;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable retryRunnable;
    private boolean isErrorShown = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        webView = (WebView) findViewById(R.id.webView);
        errorOverlay = (LinearLayout) findViewById(R.id.errorOverlay);
        errorUrlText = (TextView) findViewById(R.id.errorUrlText);
        btnRetry = (Button) findViewById(R.id.btnRetry);
        btnOpenSettings = (Button) findViewById(R.id.btnOpenSettings);

        setupWebView();

        btnRetry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                hideError();
                loadTargetUrl();
            }
        });

        btnOpenSettings.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showSettingsDialog();
            }
        });

        loadTargetUrl();
    }

    private void setupWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                isErrorShown = false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (!isErrorShown) {
                    hideError();
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                handlePageError(failingUrl, description);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && request.isForMainFrame()) {
                    handlePageError(request.getUrl().toString(), "Aloqa uzildi");
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                // Ichki tarmoqdagi o'z-o'zidan imzolangan SSL sertifikatlarni qabul qilish
                handler.proceed();
            }
        });
    }

    private void handlePageError(String failingUrl, String desc) {
        isErrorShown = true;
        showError(failingUrl);

        // Agar asosiy URL yuklanmasa, zaxira port (9880) yoki offline faylni sinab ko'rish
        String currentUrl = getTargetUrl();
        if (currentUrl.contains(":9877")) {
            final String fallbackUrl = currentUrl.replace(":9877", ":9880");
            mainHandler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (isErrorShown) {
                        webView.loadUrl(fallbackUrl);
                    }
                }
            }, 2500);
        } else if (!currentUrl.startsWith("file:")) {
            mainHandler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (isErrorShown) {
                        webView.loadUrl(OFFLINE_ASSET_URL);
                    }
                }
            }, 5000);
        }

        // 10 soniyadan so'ng yana asosiy serverga ulanishga urinish
        if (retryRunnable != null) mainHandler.removeCallbacks(retryRunnable);
        retryRunnable = new Runnable() {
            @Override
            public void run() {
                if (isErrorShown) {
                    loadTargetUrl();
                }
            }
        };
        mainHandler.postDelayed(retryRunnable, 10000);
    }

    private void showError(String url) {
        if (errorOverlay != null) {
            errorOverlay.setVisibility(View.VISIBLE);
            if (errorUrlText != null) {
                errorUrlText.setText("Manzil: " + (url != null ? url : getTargetUrl()));
            }
        }
    }

    private void hideError() {
        isErrorShown = false;
        if (errorOverlay != null) {
            errorOverlay.setVisibility(View.GONE);
        }
    }

    private String getTargetUrl() {
        return prefs.getString(KEY_TARGET_URL, DEFAULT_LOCAL_URL);
    }

    private void setTargetUrl(String url) {
        prefs.edit().putString(KEY_TARGET_URL, url).apply();
    }

    private void loadTargetUrl() {
        String url = getTargetUrl();
        webView.loadUrl(url);
    }

    private void showSettingsDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle(R.string.settings_title);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(40, 20, 40, 10);

        final EditText input = new EditText(this);
        input.setHint(R.string.server_ip_hint);
        input.setText(getTargetUrl());
        layout.addView(input);

        builder.setView(layout);

        builder.setPositiveButton(R.string.btn_save, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                String newUrl = input.getText().toString().trim();
                if (!newUrl.isEmpty()) {
                    if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://") && !newUrl.startsWith("file://")) {
                        newUrl = "http://" + newUrl;
                    }
                    if (!newUrl.contains("/bemor") && !newUrl.startsWith("file:")) {
                        newUrl = newUrl.replaceAll("/+$", "") + "/bemor";
                    }
                    setTargetUrl(newUrl);
                    hideError();
                    loadTargetUrl();
                    Toast.makeText(MainActivity.this, "Yangi manzil saqlandi", Toast.LENGTH_SHORT).show();
                }
            }
        });

        builder.setNeutralButton("Standart Manzil", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                setTargetUrl(DEFAULT_LOCAL_URL);
                hideError();
                loadTargetUrl();
                Toast.makeText(MainActivity.this, "Standart manzil o'rnatildi", Toast.LENGTH_SHORT).show();
            }
        });

        builder.setNegativeButton(R.string.btn_cancel, null);
        builder.show();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (retryRunnable != null) mainHandler.removeCallbacks(retryRunnable);
        super.onDestroy();
    }
}
