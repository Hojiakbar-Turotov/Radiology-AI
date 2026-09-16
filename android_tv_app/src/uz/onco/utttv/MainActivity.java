package uz.onco.utttv;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.Uri;
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

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {

    private static final String PREFS_NAME = "UttTvSettings";
    private static final String KEY_TARGET_URL = "target_url";

    private static final String DEFAULT_LOCAL_IP = "10.34.17.210";
    private static final String DEFAULT_LOCAL_URL = "http://" + DEFAULT_LOCAL_IP + ":9877/tv";
    private static final String DEFAULT_LOCAL_FALLBACK = "http://" + DEFAULT_LOCAL_IP + ":9880/tv";
    private static final String DEFAULT_ONLINE_URL = "https://hazards-camera-output-transit.trycloudflare.com/tv";
    private static final String GITHUB_TUNNEL_CONFIG_URL = "https://raw.githubusercontent.com/Hojiakbar-Turotov/Radiology-AI/main/tunnel_config.json";
    private static final String OFFLINE_ASSET_URL = "file:///android_asset/tv.html";

    public static final int CURRENT_VERSION_CODE = 810;
    public static final String CURRENT_VERSION_NAME = "8.1.0";

    private static final long THIRTY_MINUTES_MS = 30 * 60 * 1000L;

    private WebView webView;
    private LinearLayout errorOverlay;
    private TextView errorUrlText;
    private Button btnRetry;
    private Button btnOpenSettings;

    private SharedPreferences prefs;
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable retryRunnable;
    private Runnable localProbeRunnable;
    private boolean isErrorShown = false;
    private boolean isCheckingUpdate = false;
    private boolean isRunningOnLocal = false;
    private boolean isSingleRoomModeActive = false;
    private String currentActiveRoom = "";

    public class AndroidTvBridge {
        @android.webkit.JavascriptInterface
        public void onModeChanged(final String mode, final String roomId) {
            mainHandler.post(new Runnable() {
                @Override
                public void run() {
                    isSingleRoomModeActive = "single-room".equals(mode);
                    currentActiveRoom = (roomId != null) ? roomId : "";
                }
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. TO'LIQ EKRAN (FULLSCREEN) VA DOIMIY YONIQ TURISH
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_main);
        applyImmersiveMode();

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        webView = (WebView) findViewById(R.id.webView);
        errorOverlay = (LinearLayout) findViewById(R.id.errorOverlay);
        errorUrlText = (TextView) findViewById(R.id.errorUrlText);
        btnRetry = (Button) findViewById(R.id.btnRetry);
        btnOpenSettings = (Button) findViewById(R.id.btnOpenSettings);

        initWebView();

        btnRetry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                connectWithSmartFallback();
            }
        });

        btnOpenSettings.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showSettingsDialog();
            }
        });

        // Aqlli ulanish (Birinchi lokal port -> keyin GitHub tunnel -> agar server o'chiq bo'lsa offline TV)
        connectWithSmartFallback();

        // Har 30 daqiqada lokal portni tekshirib turish
        startThirtyMinuteLocalProbe();

        sendApkTelemetry("APK_LAUNCH", "Ilova ishga tushdi (v" + CURRENT_VERSION_NAME + ", Android " + Build.VERSION.RELEASE + ")");

        // 2. ISHGA TUSHGANDA AVTOMATIK YANGILANISHLARNI TEKSHIRISH
        mainHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                checkForAppUpdate(false);
            }
        }, 5000);
    }

    private void applyImmersiveMode() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveMode();
        }
    }

    private void initWebView() {
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setUseWideViewPort(true);
        ws.setLoadWithOverviewMode(true);
        ws.setSupportZoom(false);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        if (Build.VERSION.SDK_INT >= 16) {
            ws.setAllowFileAccessFromFileURLs(true);
            ws.setAllowUniversalAccessFromFileURLs(true);
        }

        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus();

        webView.addJavascriptInterface(new AndroidTvBridge(), "AndroidTV");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
                if (consoleMessage.messageLevel() == android.webkit.ConsoleMessage.MessageLevel.ERROR) {
                    sendApkTelemetry("TV_JS_CONSOLE_ERR", consoleMessage.message() + " [" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + "]");
                }
                return super.onConsoleMessage(consoleMessage);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (!isErrorShown) {
                    errorOverlay.setVisibility(View.GONE);
                }
                sendApkTelemetry("APK_PAGE_LOADED", "Sahifa ochildi: " + url);
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.proceed();
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                handleConnectionError(failingUrl, description);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    handleConnectionError(request.getUrl().toString(), "Aloqa uzildi");
                }
            }
        });
    }

    // =========================================================================
    // AQLLI ULANISH TIZIMI (Lokal Port -> GitHub Tunnel -> Offline TV)
    // =========================================================================
    private void connectWithSmartFallback() {
        cancelRetryTimer();
        isErrorShown = false;
        errorOverlay.setVisibility(View.GONE);

        String customUrl = prefs.getString(KEY_TARGET_URL, "").trim();
        if (!customUrl.isEmpty() && !customUrl.contains("trycloudflare.com")) {
            webView.loadUrl(customUrl);
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                // 1. Birinchi navbatda Lokal Port tekshiriladi
                boolean localOk = pingUrl(DEFAULT_LOCAL_URL, 2000) || pingUrl(DEFAULT_LOCAL_FALLBACK, 2000);
                if (localOk) {
                    isRunningOnLocal = true;
                    final String chosenLocal = pingUrl(DEFAULT_LOCAL_URL, 1500) ? DEFAULT_LOCAL_URL : DEFAULT_LOCAL_FALLBACK;
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            webView.loadUrl(chosenLocal);
                            sendApkTelemetry("APK_LOCAL_CONNECT", "Lokal portga ulandi: " + chosenLocal);
                        }
                    });
                } else {
                    // 2. Lokal port bo'lmasa, GitHub dagi doimiy tunnel tekshiriladi
                    isRunningOnLocal = false;
                    final String onlineUrl = fetchOnlineTunnelFromGithub();
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            if (onlineUrl != null && !onlineUrl.isEmpty()) {
                                webView.loadUrl(onlineUrl);
                                sendApkTelemetry("APK_GITHUB_TUNNEL_CONNECT", "GitHub tunneliga ulandi: " + onlineUrl);
                            } else {
                                // 3. Agar server umuman o'chiq bo'lsa: qizil xato emas, toza TV ekrani
                                webView.loadUrl(OFFLINE_ASSET_URL);
                                sendApkTelemetry("APK_OFFLINE_FALLBACK", "Offline kesh sahifasi ochildi");
                            }
                        }
                    });
                }
            }
        }).start();
    }

    // Har 30 minutda lokal portni tekshirib turish
    private void startThirtyMinuteLocalProbe() {
        if (localProbeRunnable != null) {
            mainHandler.removeCallbacks(localProbeRunnable);
        }
        localProbeRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isRunningOnLocal) {
                    new Thread(new Runnable() {
                        @Override
                        public void run() {
                            boolean localOk = pingUrl(DEFAULT_LOCAL_URL, 2500) || pingUrl(DEFAULT_LOCAL_FALLBACK, 2500);
                            if (localOk) {
                                isRunningOnLocal = true;
                                final String chosenLocal = pingUrl(DEFAULT_LOCAL_URL, 1500) ? DEFAULT_LOCAL_URL : DEFAULT_LOCAL_FALLBACK;
                                mainHandler.post(new Runnable() {
                                    @Override
                                    public void run() {
                                        Toast.makeText(MainActivity.this, "Lokal server ishga tushdi! Lokal portga o'tildi.", Toast.LENGTH_LONG).show();
                                        webView.loadUrl(chosenLocal);
                                        sendApkTelemetry("APK_PROBE_LOCAL_RESTORED", "30 minutlik tekshiruvda lokal portga o'tildi: " + chosenLocal);
                                    }
                                });
                            }
                        }
                    }).start();
                }
                mainHandler.postDelayed(this, THIRTY_MINUTES_MS);
            }
        };
        mainHandler.postDelayed(localProbeRunnable, THIRTY_MINUTES_MS);
    }

    // GitHub repozitoriysidan oxirgi jonli tunnel manzilini olish
    private String fetchOnlineTunnelFromGithub() {
        try {
            URL url = new URL(GITHUB_TUNNEL_CONFIG_URL + "?t=" + System.currentTimeMillis());
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            if (conn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();
                conn.disconnect();

                JSONObject json = new JSONObject(sb.toString());
                if (json.has("utt")) {
                    JSONObject utt = json.getJSONObject("utt");
                    if (utt.has("onlineTvUrl")) {
                        return utt.getString("onlineTvUrl");
                    }
                }
            }
        } catch (Exception e) {}
        return DEFAULT_ONLINE_URL;
    }

    // Tezkor HTTP Ping tekshiruvi
    private boolean pingUrl(String urlStr, int timeoutMs) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("HEAD");
            conn.setConnectTimeout(timeoutMs);
            conn.setReadTimeout(timeoutMs);
            conn.setInstanceFollowRedirects(true);
            int code = conn.getResponseCode();
            conn.disconnect();
            return (code >= 200 && code < 400);
        } catch (Exception e) {
            return false;
        }
    }

    private void handleConnectionError(String url, String desc) {
        sendApkTelemetry("APK_CONN_ERROR", "Ulanish uzildi (" + desc + "): " + url);

        // Foydalanuvchi talabi: Agar server o'chiq bo'lsa faqat navbat yo'qligini ko'rsatib tursin (qizil xato yo'q)
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                errorOverlay.setVisibility(View.GONE);
                webView.loadUrl(OFFLINE_ASSET_URL);
            }
        });

        // 15 soniyadan so'ng yana sokin tarzda qayta ulanishni tekshirish
        cancelRetryTimer();
        retryRunnable = new Runnable() {
            @Override
            public void run() {
                connectWithSmartFallback();
            }
        };
        mainHandler.postDelayed(retryRunnable, 15000);
    }

    private void sendApkTelemetry(final String type, final String detail) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String[] testUrls = new String[] {
                        DEFAULT_LOCAL_URL.replace("/tv", "/api/tv-telemetry"),
                        DEFAULT_LOCAL_FALLBACK.replace("/tv", "/api/tv-telemetry"),
                        DEFAULT_ONLINE_URL.replace("/tv", "/api/tv-telemetry")
                    };
                    for (String tUrl : testUrls) {
                        try {
                            URL url = new URL(tUrl);
                            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                            conn.setRequestMethod("POST");
                            conn.setConnectTimeout(2000);
                            conn.setReadTimeout(2000);
                            conn.setDoOutput(true);
                            conn.setRequestProperty("Content-Type", "application/json");

                            JSONObject json = new JSONObject();
                            json.put("type", type);
                            json.put("detail", detail);
                            json.put("userAgent", "AndroidTV-APK v" + CURRENT_VERSION_NAME + " (Android " + Build.VERSION.RELEASE + ", SDK " + Build.VERSION.SDK_INT + ")");
                            json.put("path", "/apk");

                            byte[] out = json.toString().getBytes("UTF-8");
                            conn.getOutputStream().write(out);
                            conn.getResponseCode();
                            conn.disconnect();
                            break;
                        } catch (Exception inner) {}
                    }
                } catch (Exception ignored) {}
            }
        }).start();
    }

    private void cancelRetryTimer() {
        if (retryRunnable != null) {
            mainHandler.removeCallbacks(retryRunnable);
            retryRunnable = null;
        }
    }

    // =========================================================================
    // SOZLAMALAR VA REJIMLAR MULOQOTI
    // =========================================================================
    private void showSettingsDialog() {
        cancelRetryTimer();

        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Sozlamalar (v" + CURRENT_VERSION_NAME + ")");

        Context context = this;
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(30, 20, 30, 10);

        TextView lblUrl = new TextView(context);
        lblUrl.setText("TV Manzili (Lokal yoki Online Tunnel):");
        lblUrl.setTextSize(16);
        layout.addView(lblUrl);

        final EditText inputUrl = new EditText(context);
        inputUrl.setText(prefs.getString(KEY_TARGET_URL, DEFAULT_LOCAL_URL));
        inputUrl.setTextSize(16);
        layout.addView(inputUrl);

        Button btnSetAuto = new Button(context);
        btnSetAuto.setText("⚡ Aqlli Avto-Ulanish (Lokal -> Git Tunnel)");
        btnSetAuto.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                prefs.edit().remove(KEY_TARGET_URL).apply();
                connectWithSmartFallback();
                Toast.makeText(MainActivity.this, "Avto-ulanish faollashtirildi!", Toast.LENGTH_SHORT).show();
            }
        });
        layout.addView(btnSetAuto);

        Button btnSetLocal = new Button(context);
        btnSetLocal.setText("Lokal Wi-Fi (10.34.17.210:9877/tv)");
        btnSetLocal.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                inputUrl.setText(DEFAULT_LOCAL_URL);
            }
        });
        layout.addView(btnSetLocal);

        Button btnCheckUpdateNow = new Button(context);
        btnCheckUpdateNow.setText("Yangilanishlarni tekshirish");
        btnCheckUpdateNow.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                checkForAppUpdate(true);
            }
        });
        layout.addView(btnCheckUpdateNow);

        builder.setView(layout);

        builder.setPositiveButton("Saqlash va Ochish", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                String newUrl = inputUrl.getText().toString().trim();
                if (newUrl.isEmpty()) newUrl = DEFAULT_LOCAL_URL;
                prefs.edit().putString(KEY_TARGET_URL, newUrl).apply();
                webView.loadUrl(newUrl);
                Toast.makeText(MainActivity.this, "Manzil saqlandi!", Toast.LENGTH_SHORT).show();
            }
        });

        builder.setNegativeButton("Bekor qilish", null);
        builder.show();
    }

    // =========================================================================
    // AVTOMATIK YANGILANISHLAR TIZIMI
    // =========================================================================
    private void checkForAppUpdate(final boolean isUserInitiated) {
        if (isCheckingUpdate) return;
        isCheckingUpdate = true;

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String[] updateEndpoints = new String[] {
                        DEFAULT_LOCAL_URL.replace("/tv", "/api/app-version"),
                        DEFAULT_LOCAL_FALLBACK.replace("/tv", "/api/app-version"),
                        DEFAULT_ONLINE_URL.replace("/tv", "/api/app-version")
                    };

                    JSONObject updateData = null;
                    String baseUrl = "";

                    for (String endpoint : updateEndpoints) {
                        try {
                            URL url = new URL(endpoint);
                            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                            conn.setRequestMethod("GET");
                            conn.setConnectTimeout(3000);
                            conn.setReadTimeout(3000);

                            if (conn.getResponseCode() == 200) {
                                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                                StringBuilder sb = new StringBuilder();
                                String line;
                                while ((line = reader.readLine()) != null) sb.append(line);
                                reader.close();
                                conn.disconnect();

                                JSONObject json = new JSONObject(sb.toString());
                                if (json.optBoolean("success", false)) {
                                    updateData = json;
                                    baseUrl = endpoint.substring(0, endpoint.indexOf("/api/app-version"));
                                    break;
                                }
                            }
                        } catch (Exception ignored) {}
                    }

                    if (updateData != null) {
                        final int remoteVersionCode = updateData.optInt("versionCode", CURRENT_VERSION_CODE);
                        final String remoteVersionName = updateData.optString("latestVersion", CURRENT_VERSION_NAME);
                        final String releaseNotes = updateData.optString("releaseNotes", "");
                        String rawDownload = updateData.optString("downloadUrl", "/download/UTT_TV_Navbat.apk");
                        final String fullDownloadUrl = rawDownload.startsWith("http") ? rawDownload : (baseUrl + rawDownload);

                        if (remoteVersionCode > CURRENT_VERSION_CODE) {
                            mainHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    promptUpdateDialog(remoteVersionName, releaseNotes, fullDownloadUrl);
                                }
                            });
                        } else if (isUserInitiated) {
                            mainHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(MainActivity.this, "Sizda eng so'nggi versiya o'rnatilgan (v" + CURRENT_VERSION_NAME + ")", Toast.LENGTH_SHORT).show();
                                }
                            });
                        }
                    } else if (isUserInitiated) {
                        mainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(MainActivity.this, "Server bilan aloqa mavjud emas", Toast.LENGTH_SHORT).show();
                            }
                        });
                    }
                } catch (Exception e) {
                } finally {
                    isCheckingUpdate = false;
                }
            }
        }).start();
    }

    private void promptUpdateDialog(final String newVersion, final String releaseNotes, final String downloadUrl) {
        new AlertDialog.Builder(this)
            .setTitle("Yangi versiya mavjud! (v" + newVersion + ")")
            .setMessage("O'zgarishlar:\n" + releaseNotes + "\n\nIlovani hoziroq yangilashni xohlaysizmi?")
            .setCancelable(false)
            .setPositiveButton("Yuklab Olish", new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface dialog, int which) {
                    downloadAndInstallUpdate(newVersion, downloadUrl);
                }
            })
            .setNegativeButton("Keyinroq", null)
            .show();
    }

    private void downloadAndInstallUpdate(final String newVersion, final String downloadUrl) {
        final ProgressDialog pd = new ProgressDialog(this);
        pd.setTitle("Yangilanish yuklanmoqda");
        pd.setMessage("v" + newVersion + " yuklab olinmoqda...");
        pd.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);
        pd.setMax(100);
        pd.setProgress(0);
        pd.setCancelable(false);
        pd.show();

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(downloadUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(15000);
                    conn.connect();

                    int fileLength = conn.getContentLength();
                    File outputDir = getExternalFilesDir(null);
                    if (outputDir == null) outputDir = getCacheDir();
                    final File apkFile = new File(outputDir, "UTT_TV_Navbat_v" + newVersion + ".apk");

                    InputStream input = new BufferedInputStream(conn.getInputStream());
                    FileOutputStream output = new FileOutputStream(apkFile);

                    byte[] data = new byte[4096];
                    long total = 0;
                    int count;
                    while ((count = input.read(data)) != -1) {
                        total += count;
                        if (fileLength > 0) {
                            final int progress = (int) (total * 100 / fileLength);
                            mainHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    pd.setProgress(progress);
                                }
                            });
                        }
                        output.write(data, 0, count);
                    }

                    output.flush();
                    output.close();
                    input.close();

                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            pd.dismiss();
                            installDownloadedApk(apkFile);
                        }
                    });
                } catch (final Exception ex) {
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            pd.dismiss();
                            Toast.makeText(MainActivity.this, "Yuklab olishda xatolik: " + ex.getMessage(), Toast.LENGTH_LONG).show();
                        }
                    });
                }
            }
        }).start();
    }

    private void installDownloadedApk(File apkFile) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            if (Build.VERSION.SDK_INT >= 24) {
                Uri contentUri = Uri.parse("content://" + ApkProvider.AUTHORITY + "/" + apkFile.getName());
                intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                intent.setDataAndType(Uri.fromFile(apkFile), "application/vnd.android.package-archive");
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "O'rnatishda xatolik: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            int keyCode = event.getKeyCode();

            // 1. TV Pulti Raqamlari (0..9 va Numpad 0..9)
            // Foydalanuvchi talabi: 0 -> UTT 10, 1 -> UTT 1, ..., 9 -> UTT 9
            Integer targetRoomNum = null;
            if (keyCode == KeyEvent.KEYCODE_0 || keyCode == KeyEvent.KEYCODE_NUMPAD_0) targetRoomNum = 0;
            else if (keyCode == KeyEvent.KEYCODE_1 || keyCode == KeyEvent.KEYCODE_NUMPAD_1) targetRoomNum = 1;
            else if (keyCode == KeyEvent.KEYCODE_2 || keyCode == KeyEvent.KEYCODE_NUMPAD_2) targetRoomNum = 2;
            else if (keyCode == KeyEvent.KEYCODE_3 || keyCode == KeyEvent.KEYCODE_NUMPAD_3) targetRoomNum = 3;
            else if (keyCode == KeyEvent.KEYCODE_4 || keyCode == KeyEvent.KEYCODE_NUMPAD_4) targetRoomNum = 4;
            else if (keyCode == KeyEvent.KEYCODE_5 || keyCode == KeyEvent.KEYCODE_NUMPAD_5) targetRoomNum = 5;
            else if (keyCode == KeyEvent.KEYCODE_6 || keyCode == KeyEvent.KEYCODE_NUMPAD_6) targetRoomNum = 6;
            else if (keyCode == KeyEvent.KEYCODE_7 || keyCode == KeyEvent.KEYCODE_NUMPAD_7) targetRoomNum = 7;
            else if (keyCode == KeyEvent.KEYCODE_8 || keyCode == KeyEvent.KEYCODE_NUMPAD_8) targetRoomNum = 8;
            else if (keyCode == KeyEvent.KEYCODE_9 || keyCode == KeyEvent.KEYCODE_NUMPAD_9) targetRoomNum = 9;

            if (targetRoomNum != null) {
                switchRoomByNumber(targetRoomNum);
                return true;
            }

            // 2. BACK (Orqaga) tugmasi: agar yagona xona ekrani ochiq bo'lsa, barcha xonalarga qaytish
            if (keyCode == KeyEvent.KEYCODE_BACK) {
                if (isSingleRoomModeActive) {
                    backToAllRooms();
                    return true;
                }
                if (isErrorShown) {
                    showSettingsDialog();
                    return true;
                }
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return true;
                }
                showSettingsDialog();
                return true;
            }

            if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_SETTINGS) {
                showSettingsDialog();
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void switchRoomByNumber(final int num) {
        if (webView == null) return;
        final String js = "if (window.uttSwitchRoomByNumber) { window.uttSwitchRoomByNumber(" + num + "); }";
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    webView.evaluateJavascript(js, null);
                } else {
                    webView.loadUrl("javascript:" + js);
                }
            }
        });
    }

    private void backToAllRooms() {
        if (webView == null) return;
        final String js = "if (window.uttBackToAllRooms) { window.uttBackToAllRooms(); }";
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    webView.evaluateJavascript(js, null);
                } else {
                    webView.loadUrl("javascript:" + js);
                }
            }
        });
    }
}