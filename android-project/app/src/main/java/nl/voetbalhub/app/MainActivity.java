package nl.voetbalhub.app;

import android.annotation.SuppressLint;
import android.animation.ValueAnimator;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.app.Dialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Html;
import android.text.TextUtils;
import android.util.Xml;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.LinearInterpolator;
import android.widget.FrameLayout;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.*;

import android.util.Log;

import androidx.appcompat.app.AlertDialog;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.xmlpull.v1.XmlPullParser;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    private AdController veldioAds;
    private AdController ads(){if(veldioAds==null)veldioAds=new AdController(this);return veldioAds;}

    private HomeFeatureView homeFeature;
    private VideoShelf40 videoShelf40;
    private NewsNotifications39 newsNotifications39;
    private final ScreenHistory screenHistory = new ScreenHistory();
    private EredivisieStatsView statisticsView;
    private boolean statisticsFeature;
    private String personalMode = "favorites", personalQuery = "";
    private ContactView contactView;
    private String contactDraft = "{}";
    private android.app.Dialog exitDialog;
    private Runnable cancelScrollRestore;


    private boolean eredivisieStatisticsVisible = false;
    private boolean weeklyPreviewVisible = false;
    private boolean personalHubVisible = false;
    private PersonalHubView personalHub;

    private String currentBottomTab = "Nieuws";

    private static class Article {
        final String title, link, source, date, imageUrl;

        Article(String title, String link, String source, String date, String imageUrl) {
            this.title = title;
            this.link = link;
            this.source = source;
            this.date = date;
            this.imageUrl = imageUrl == null ? "" : imageUrl;
        }
    }

    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Article> articles = new ArrayList<>();
    private final List<Article> shown = new ArrayList<>();
    private final String[] feedNames = {};
    // Alleen rechtstreekse feeds van de drie voetbaluitgevers; geen Google Nieuws.
    private final String[] feedUrls = {};
    private String active = "Voor jou";
    private boolean loading = false;
    private int articleDisplayLimit = 20;
    private boolean articleOpen = false;
    private WebView activeWebView;
    private Dialog articleDialog;
    private FrameLayout content;
    private LinearLayout chips, nav;
    private SharedPreferences prefs;

    private final Runnable periodicRefresh = new Runnable() {
        @Override public void run() {
            refreshNews();
            main.postDelayed(this, 10 * 60 * 1000L);
        }
    };
    private long lastRefresh = 0L;
    private String newsStatusMessage = "";
    private boolean scoresPageVisible = false;
    private Runnable dailyScoresReset;
    private Runnable liveScoresRefresh;
    private int scoresScrollY = 0;
    private ScrollView scoresScrollView;

    private void initializeAds() {
        // Advertising remains unavailable until a certified CMP and SDK audit are complete.
        android.view.View container=findViewById(R.id.adContainer);
        if(container!=null)container.setVisibility(android.view.View.GONE);
    }

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this,new androidx.activity.OnBackPressedCallback(true){@Override public void handleOnBackPressed(){MainActivity.this.onBackPressed();}});
        // Behoud de normale Android-balken en reserveer expliciet hun ruimte.
        // Zo vallen de app-header en onderste navigatie niet onder systeemiconen.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(5, 8, 7));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(5, 8, 7));
        WindowInsetsControllerCompat bars = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        bars.show(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
        setContentView(R.layout.activity_main);
        View root = findViewById(R.id.root);
        root.setBackgroundColor(C.BG);
        final int initialLeft = root.getPaddingLeft();
        final int initialTop = root.getPaddingTop();
        final int initialRight = root.getPaddingRight();
        final int initialBottom = root.getPaddingBottom();
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            androidx.core.graphics.Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(initialLeft + systemBars.left, initialTop + systemBars.top,
                    initialRight + systemBars.right, initialBottom + systemBars.bottom);
            return insets;
        });
        ViewCompat.requestApplyInsets(root);
        // Google-banner tijdelijk verborgen op verzoek; advertentiecode blijft beschikbaar.
        View adContainer = findViewById(R.id.adContainer);
        if (adContainer != null) adContainer.setVisibility(View.GONE);
        content = findViewById(R.id.content);
        chips = findViewById(R.id.chips);
        nav = findViewById(R.id.nav);
        View header = findViewById(R.id.header);
        VeldioChrome.install(this);
        prefs = getSharedPreferences("voethub", MODE_PRIVATE);
        lastRefresh = prefs.getLong("lastRefresh", 0L);
        loadCachedArticles();
        findViewById(R.id.logo).setOnClickListener(v -> { articleDisplayLimit = 20; showHome39(); });
        findViewById(R.id.title).setOnClickListener(v -> { articleDisplayLimit = 20; showHome39(); });
        findViewById(R.id.search).setOnClickListener(v -> showSearch());
        findViewById(R.id.settings).setOnClickListener(v -> showSettings());
        ImageRegistry39.load(this);
        showHome39();
        newsNotifications39=new NewsNotifications39(this);
        refreshNews();
        main.postDelayed(periodicRefresh, 10 * 60 * 1000L);
        showIntro();
    }

    private int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density + 0.5f); }

    private TextView tv(String text, float size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextSize(size);
        t.setTextColor(color);
        t.setIncludeFontPadding(false);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return t;
    }

    private void buildChips() {
        chips.removeAllViews();
        String[] labels = {"Voor jou", "Laatste nieuws", "Transfers", "Eredivisie", "Buitenland", "Video"};
        for (String label : labels) {
            TextView b = tv(label, 13, label.equals(active) ? C.BG : C.TEXT, false);
            b.setGravity(Gravity.CENTER);
            b.setPadding(dp(13), 0, dp(13), 0);
            b.setBackground(ContextCompat.getDrawable(this, label.equals(active) ? R.drawable.rounded_active : R.drawable.rounded_chip));
            VeldioChrome.chip(this,b,label,label.equals(active));
            b.setOnClickListener(v -> {
                active = label;
                articleDisplayLimit = 20;
                buildChips();
                if (label.equals("Voor jou")) showHome39();
                else if (label.equals("Video")) showVideos();
                else showNews();
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, dp(38));
            lp.setMargins(0, 0, dp(8), 0);
            chips.addView(b, lp);
        }
    }

    private void buildNav() {
        nav.removeAllViews();
        String[] items = {"Nieuws", "Wedstrijden", "Voorspellen", "Mijn Clubs", "Meer"};
        for (String page : items) {
            LinearLayout box = new LinearLayout(this);
            box.setOrientation(LinearLayout.VERTICAL);
            box.setGravity(Gravity.CENTER);
            box.setClickable(true);
            box.setMinimumHeight(dp(48));
            box.addView(new NavIconView(this, page, page.equals(currentBottomTab)), new LinearLayout.LayoutParams(-1, dp(26)));
            TextView navLabel = tv(page, 10, page.equals(currentBottomTab) ? C.GREEN : C.MUTED, page.equals(currentBottomTab)); navLabel.setGravity(Gravity.CENTER); box.addView(navLabel, new LinearLayout.LayoutParams(-1, dp(18)));
            box.setOnClickListener(v -> {
                switch (page) {
                    case "Wedstrijden": showDestination39("fixtures"); break;
                    case "Voorspellen": showDestination39("predictions"); break;
                    case "Nieuws": showHome39(); break;
                    case "Mijn Clubs": showFavorites(); break;
                    default: showMore();
                }
            });
            VeldioChrome.navigation(this,box,page.equals(currentBottomTab));
            nav.addView(box, new LinearLayout.LayoutParams(0, -1, 1));
        }
    }

    private LinearLayout sectionHeader(String title, String action, final Runnable click) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(16), dp(10), dp(16), dp(10));
        row.addView(tv(title, 22, C.TEXT, true), new LinearLayout.LayoutParams(0, -2, 1));
        if (action != null) {
            TextView a = tv(action, 12, C.GREEN, true);
            a.setGravity(Gravity.CENTER);
            a.setOnClickListener(v -> { if (click != null) click.run(); });
            row.addView(a, new LinearLayout.LayoutParams(dp(90), dp(36)));
        }
        return row;
    }

    private LinearLayout sectionHeader(String title) { return sectionHeader(title, null, null); }

    
    private ScrollView pageScroll(android.view.View view) {
        if(view instanceof ScrollView)return (ScrollView)view;
        if(view instanceof android.view.ViewGroup){android.view.ViewGroup group=(android.view.ViewGroup)view;for(int i=0;i<group.getChildCount();i++){ScrollView found=pageScroll(group.getChildAt(i));if(found!=null)return found;}}
        return null;
    }
    private void rememberScreen() {
        ScreenHistory.Entry entry=screenHistory.current();if(entry==null)return;
        ScrollView scroll=pageScroll(content);if(scroll!=null)entry.scrollY=scroll.getScrollY();
        if(entry.key.startsWith("personal:")&&personalHub!=null){final String mode=personalMode,query=personalQuery,snapshot=personalHub.navigationState();entry.restore=()->showPersonalHub(mode,query,snapshot);}
        if(entry.key.startsWith("statistics:")&&statisticsView!=null){final boolean feature=statisticsFeature;final String snapshot=statisticsView.navigationState();entry.restore=()->showEredivisieStatistics(feature,snapshot);}
        if(entry.key.equals("contact")&&contactView!=null)contactDraft=contactView.draft();
    }
    private void enterScreen(String key,Runnable restore) {
        if(cancelScrollRestore!=null){cancelScrollRestore.run();cancelScrollRestore=null;}
        if(!screenHistory.isRestoring()) {rememberScreen();screenHistory.enter(key,restore);}
        if (!"clubquiz".equals(key) && !"destination39:predictions".equals(key)) clubQuizView = null;
    }
    private boolean previousScreen() {
        rememberScreen();
        if(!screenHistory.canGoBack())return false;
        screenHistory.back();
        final int y=screenHistory.current().scrollY;
        final String route=screenHistory.current().key;
        main.post(()->{
            ScrollView scroll=pageScroll(content);if(scroll==null)return;
            android.view.ViewTreeObserver.OnGlobalLayoutListener[] listener=new android.view.ViewTreeObserver.OnGlobalLayoutListener[1];
            cancelScrollRestore=()->{if(content.getViewTreeObserver().isAlive())content.getViewTreeObserver().removeOnGlobalLayoutListener(listener[0]);scroll.setOnTouchListener(null);};
            listener[0]=()->{if(!screenHistory.current().key.equals(route)){if(cancelScrollRestore!=null)cancelScrollRestore.run();return;}int range=scroll.getChildCount()==0?0:Math.max(0,scroll.getChildAt(0).getHeight()-scroll.getHeight());scroll.scrollTo(0,y);if(range>=y&&cancelScrollRestore!=null){cancelScrollRestore.run();cancelScrollRestore=null;}};
            scroll.setOnTouchListener((v,event)->{if(event.getAction()==android.view.MotionEvent.ACTION_DOWN&&cancelScrollRestore!=null){cancelScrollRestore.run();cancelScrollRestore=null;}return false;});
            content.getViewTreeObserver().addOnGlobalLayoutListener(listener[0]);listener[0].onGlobalLayout();
        });
        return true;
    }
    private void showContact() {
        enterScreen("contact",this::showContact);
        if(homeFeature!=null)homeFeature.closeVideo();
        personalHubVisible=false;weeklyPreviewVisible=false;eredivisieStatisticsVisible=false;scoresPageVisible=false;
        currentBottomTab="Meer";buildNav();findViewById(R.id.header).setVisibility(android.view.View.GONE);findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        content.removeAllViews();contactView=new ContactView(this,contactDraft,this::onBackPressed,EDITORIAL_API_URL);content.addView(contactView,new android.widget.FrameLayout.LayoutParams(-1,-1));
    }

    private void showNews() {
        final String category=active;enterScreen("news:"+category,()->{active=category;buildChips();showNews();});
        personalHubVisible = false; personalHub = null;
        eredivisieStatisticsVisible = false; weeklyPreviewVisible = false;
        findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.chipsScroll).setVisibility(android.view.View.VISIBLE);
        currentBottomTab = "Nieuws";
        buildNav();
        articleOpen = false;
        activeWebView = null;
        content.removeAllViews();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        if (!"Voor jou".equals(active)) root.addView(sectionHeader(active, "VERVERS", this::refreshNews));
        TextView status = tv(loading ? "Nieuws wordt bijgewerkt…" : (!newsStatusMessage.isEmpty() ? newsStatusMessage : "Nieuws, achtergronden en jouw clubs" + (lastRefresh > 0 ? "  •  " + formatLastRefresh() : "")), 11, C.MUTED, false);
        status.setPadding(dp(16), 0, dp(16), dp(10));
        if (loading || !newsStatusMessage.isEmpty()) root.addView(status);
        ScrollView scroll = new RefreshScrollView(this,()->FeedRepository.refresh(true));
        LinearLayout list = new LinearLayout(this);
        addEditorialNewsSection(list, false);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(0, 0, 0, dp(18));
        if (active.equals("Voor jou") || active.equals("Eredivisie")) {
            addEredivisieLiveBlock(list);
        }
        List<Article> filtered = filterArticles(active);
        shown.clear(); shown.addAll(filtered);
        if (filtered.isEmpty()) {
            /* The editorial section owns loading and empty states. */
        } else {
            int visibleCount = Math.min(articleDisplayLimit, filtered.size());
            for (int i = 0; i < visibleCount; i++) addArticleCard(list, filtered.get(i), i == 0 && active.equals("Voor jou"));
            if (visibleCount < filtered.size()) {
                TextView more = tv("MEER LADEN  ·  " + Math.min(20, filtered.size() - visibleCount) + " BERICHTEN", 13, C.GREEN, true);
                more.setGravity(Gravity.CENTER);
                more.setPadding(dp(12), dp(16), dp(12), dp(16));
                more.setBackground(cardBackground());
                LinearLayout.LayoutParams moreLp = new LinearLayout.LayoutParams(-1, -2);
                moreLp.setMargins(0, dp(8), 0, dp(12));
                list.addView(more, moreLp);
                more.setOnClickListener(v -> {
                    int previousScrollY = scroll.getScrollY();
                    articleDisplayLimit += 20;
                    showNews();
                    main.post(() -> {
                        if (content != null && content.getChildCount() > 0 && content.getChildAt(0) instanceof LinearLayout) {
                            LinearLayout page = (LinearLayout) content.getChildAt(0);
                            for (int child = 0; child < page.getChildCount(); child++) {
                                if (page.getChildAt(child) instanceof ScrollView) {
                                    ((ScrollView) page.getChildAt(child)).scrollTo(0, previousScrollY);
                                    break;
                                }
                            }
                        }
                    });
                });
            } else if (filtered.size() > 20) {
                list.addView(tv("Alle beschikbare berichten geladen", 11, C.MUTED, false));
            }
        }
        scroll.addView(list);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        content.addView(root);PremiumDesign40.polish(root);
    }


    /** Live Eredivisieblok met aftraptijd, status en wedstrijdminuut uit de scoreboardfeed. */
    private void addEredivisieLiveBlock(LinearLayout parent) { /* disabled pending rights confirmation */ }


    private void loadTeamLogo(ImageView target, String logoUrl, View fallback) {
        if (logoUrl == null || logoUrl.trim().isEmpty()) return;
        target.setVisibility(View.INVISIBLE);
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(logoUrl).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setRequestProperty("User-Agent", "Veldio/2.9 Android");
                try (InputStream input = connection.getInputStream()) {
                    Bitmap bitmap = BitmapFactory.decodeStream(input);
                    if (bitmap != null) main.post(() -> {
                        if (target.getContext() != null) {
                            target.setImageBitmap(bitmap);
                            target.setVisibility(View.VISIBLE);
                            fallback.setVisibility(View.GONE);
                        }
                    });
                }
            } catch (Exception ignored) {
                // Bij een ontbrekend logo blijft de nette initialenbadge zichtbaar.
            } finally { if (connection != null) connection.disconnect(); }
        });
    }

    private String teamInitials(String team) {
        if (team == null || team.trim().isEmpty()) return "FC";
        String[] parts = team.trim().split("\\s+");
        if (parts.length == 1) return parts[0].substring(0, Math.min(3, parts[0].length())).toUpperCase(java.util.Locale.ROOT);
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase(java.util.Locale.ROOT);
    }

    private String formatKickoff(String isoDate) {
        if (isoDate == null || isoDate.trim().isEmpty()) return "";
        java.time.ZoneId zone = java.time.ZoneId.of("Europe/Amsterdam");
        java.time.format.DateTimeFormatter timeFormat = java.time.format.DateTimeFormatter.ofPattern("HH:mm");
        try {
            return timeFormat.withZone(zone).format(java.time.Instant.parse(isoDate));
        } catch (Exception ignored) { }
        try {
            return timeFormat.withZone(zone).format(java.time.OffsetDateTime.parse(isoDate).toInstant());
        } catch (Exception ignored) { }
        try {
            return java.time.LocalDateTime.parse(isoDate).atZone(zone).format(timeFormat);
        } catch (Exception ignored) { }
        return "";
    }

    private int safeInt(String value) { try { return Integer.parseInt(value); } catch (Exception e) { return 0; } }

    /** Open the exact ESPN match page using the event ID from the scoreboard feed. */
    private void openEspnMatch(String eventId, String home, String away) {
        try {
            if (eventId != null && eventId.matches("[0-9]+")) {
                Uri uri = Uri.parse("https://www.espn.com/soccer/match/_/gameId/" + eventId);
                openArticle(uri.toString(), "ESPN wedstrijd");
            } else {
                // The feed did not provide an event ID, so open ESPN soccer scores rather than a misleading Google search.
                openArticle("https://www.espn.com/soccer/scoreboard", "ESPN uitslagen");
                Toast.makeText(this, "De directe wedstrijdlink is niet beschikbaar; ESPN-scores zijn geopend.", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            Toast.makeText(this, "De wedstrijd kan niet worden geopend. Probeer het later opnieuw.", Toast.LENGTH_LONG).show();
        }
    }

    private GradientDrawable cardBackground() {
        GradientDrawable g = new GradientDrawable();
        g.setColor(C.CARD);
        g.setCornerRadius(dp(18));
        g.setStroke(dp(1), C.BORDER);
        return g;
    }

    private void addArticleCard(LinearLayout list, Article a, boolean hero) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(10), dp(10), dp(10), dp(12));
        card.setClickable(true);
        card.setBackground(cardBackground());
        card.setOnClickListener(v -> openArticle(a.link, a.title));

        ImageView image = new ImageView(this);
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        image.setBackgroundColor(C.IMAGE_PLACEHOLDER);
        image.setTag(a.imageUrl);
        int imageHeight = hero ? dp(190) : dp(125);
        // Never reserve a large blank image block when the feed has no usable image.
        image.setVisibility(View.GONE);
        card.addView(image, new LinearLayout.LayoutParams(-1, imageHeight));
        loadArticleImage(image, a.imageUrl);

        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(4), dp(9), dp(4), 0);

        LinearLayout sourceRow = new LinearLayout(this);
        sourceRow.setGravity(Gravity.CENTER_VERTICAL);
        TextView source = tv(a.source.toUpperCase(Locale.getDefault()), 9, C.GREEN, true);
        sourceRow.addView(source, new LinearLayout.LayoutParams(0, dp(20), 1));
        TextView date = tv(formatDate(a.date), 9, C.MUTED, false);
        sourceRow.addView(date, new LinearLayout.LayoutParams(-2, dp(20)));
        TextView bookmark = tv(isArticleSaved(a.link) ? "★" : "☆", 20, isArticleSaved(a.link) ? C.GREEN : C.MUTED, true);
        bookmark.setGravity(Gravity.CENTER);
        bookmark.setContentDescription(isArticleSaved(a.link) ? "Verwijder uit bewaarde artikelen" : "Bewaar artikel");
        bookmark.setOnClickListener(v -> {
            toggleSavedArticle(a.link);
            bookmark.setText(isArticleSaved(a.link) ? "★" : "☆");
            bookmark.setTextColor(isArticleSaved(a.link) ? C.GREEN : C.MUTED);
            bookmark.setContentDescription(isArticleSaved(a.link) ? "Verwijder uit bewaarde artikelen" : "Bewaar artikel");
            Toast.makeText(this, isArticleSaved(a.link) ? "Artikel bewaard" : "Artikel verwijderd uit bewaard", Toast.LENGTH_SHORT).show();
        });
        LinearLayout.LayoutParams bookmarkLp = new LinearLayout.LayoutParams(dp(32), dp(28));
        bookmarkLp.setMargins(dp(6), 0, 0, 0);
        sourceRow.addView(bookmark, bookmarkLp);
        body.addView(sourceRow);

        TextView title = tv(a.title, hero ? 18 : 15, C.TEXT, true);
        title.setMaxLines(hero ? 4 : 3);
        title.setEllipsize(TextUtils.TruncateAt.END);
        title.setPadding(0, dp(5), 0, dp(6));
        body.addView(title);
        body.addView(tv("Lees bij de oorspronkelijke uitgever  ›", 10, C.MUTED, false));
        card.addView(body);

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(0, 0, 0, dp(10));
        list.addView(card, lp);
    }

    private void loadArticleImage(ImageView target, String imageUrl) {
        if (imageUrl == null || imageUrl.trim().isEmpty()) return;
        executor.execute(() -> {
            Bitmap bitmap = null;
            try {
                URL u = new URL(imageUrl);
                HttpURLConnection c = (HttpURLConnection) u.openConnection();
                c.setConnectTimeout(7000);
                c.setReadTimeout(7000);
                c.setInstanceFollowRedirects(true);
                c.setRequestProperty("User-Agent", "Veldio/2.3");
                c.connect();
                if (c.getResponseCode() >= 200 && c.getResponseCode() < 400) {
                    bitmap = BitmapFactory.decodeStream(c.getInputStream());
                }
                c.disconnect();
            } catch (Exception ignored) { }
            final Bitmap result = bitmap;
            if (result != null) {
                main.post(() -> {
                    Object tag = target.getTag();
                    if (imageUrl.equals(tag)) {
                        target.setImageBitmap(result);
                        target.setVisibility(View.VISIBLE);
                    }
                });
            }
        });
    }

    private String formatDate(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "";
        long timestamp = articleTimestamp(raw);
        if (timestamp > 0L) return android.text.format.DateFormat.format("EEE, dd MMM HH:mm", new Date(timestamp)).toString();
        String x = raw.trim();
        return x.length() > 24 ? x.substring(0, 24) : x;
    }

    private List<Article> filterArticles(String category) {
        List<Article> base = new ArrayList<>(articles);
        Collections.sort(base, (a, b) -> Long.compare(articleTimestamp(b.date), articleTimestamp(a.date)));
        if (category.equals("Transfers")) return filter(base, "transfer|transferv|deal|akkoord|vertrekt|tekent|contract");
        if (category.equals("Eredivisie")) return filter(base, "Ajax|PSV|Feyenoord|Groningen|AZ|Twente|Utrecht|Heerenveen|NEC|Sparta|Eredivisie|RKC|Go Ahead|Fortuna|PEC|NAC|Volendam|Heracles");
        if (category.equals("Buitenland")) return filter(base, "Premier League|La Liga|Barcelona|Real Madrid|Liverpool|Arsenal|Manchester|Bayern|Dortmund|Serie A|Milan|Inter|PSG|Champions League");
        return base;
    }

    private List<Article> filter(List<Article> base, String regex) {
        List<Article> r = new ArrayList<>();
        for (Article a : base) if (a.title.matches("(?i).*?(" + regex + ").*")) r.add(a);
        return r;
    }

    private void refreshNews() { FeedRepository.configure(this,EDITORIAL_API_URL);FeedRepository.refresh(true); }
    private String newestArticleDate(List<Article> items) {
        if (items == null || items.isEmpty()) return "onbekend";
        long timestamp = articleTimestamp(items.get(0).date);
        if (timestamp > 0L) return android.text.format.DateFormat.format("dd-MM HH:mm", new Date(timestamp)).toString();
        String date = items.get(0).date == null ? "" : items.get(0).date.trim();
        return date.isEmpty() ? "datum onbekend" : (date.length() > 22 ? date.substring(0, 22) : date);
    }

    private long articleTimestamp(String raw) {
        if (raw == null || raw.trim().isEmpty()) return 0L;
        String value = raw.trim();
        String[] patterns = {
                "EEE, dd MMM yyyy HH:mm:ss Z", "EEE, dd MMM yyyy HH:mm:ss zzz",
                "EEE, dd MMM yyyy HH:mm Z", "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd'T'HH:mm:ss'Z'", "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
                "yyyy-MM-dd'T'HH:mm:ssZ", "yyyy-MM-dd HH:mm:ss"
        };
        for (String pattern : patterns) {
            try {
                java.text.SimpleDateFormat format = new java.text.SimpleDateFormat(pattern, Locale.ENGLISH);
                format.setLenient(true);
                format.setTimeZone(TimeZone.getDefault());
                Date parsed = format.parse(value);
                if (parsed != null) return parsed.getTime();
            } catch (Exception ignored) { }
        }
        return 0L;
    }

    private String joinNames(List<String> names) {
        StringBuilder out = new StringBuilder();
        for (String name : names) { if (out.length() > 0) out.append(", "); out.append(name); }
        return out.toString();
    }

    private void loadCachedArticles() {
        String raw = prefs.getString("articleCache", "");
        if (raw.isEmpty()) return;
        try {
            JSONArray arr = new JSONArray(raw);
            articles.clear();
            boolean removedOldGoogleItems = false;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                String source = o.optString("source", "");
                String link = o.optString("link", "");
                if (source.toLowerCase(Locale.ROOT).contains("google") || link.toLowerCase(Locale.ROOT).contains("news.google.com")) {
                    removedOldGoogleItems = true;
                    continue;
                }
                articles.add(new Article(o.optString("title"), link, source, o.optString("date"), o.optString("imageUrl")));
            }
            if (removedOldGoogleItems) saveCachedArticles(articles);
        } catch (Exception ignored) { }
    }

    private void saveCachedArticles(List<Article> items) {
        try {
            JSONArray arr = new JSONArray();
            for (int i = 0; i < Math.min(items.size(), 300); i++) {
                Article a = items.get(i);
                JSONObject o = new JSONObject();
                o.put("title", a.title); o.put("link", a.link); o.put("source", a.source); o.put("date", a.date); o.put("imageUrl", a.imageUrl);
                arr.put(o);
            }
            prefs.edit().putString("articleCache", arr.toString()).apply();
        } catch (Exception ignored) { }
    }

    private String formatLastRefresh() {
        return android.text.format.DateFormat.format("HH:mm", new Date(lastRefresh)).toString();
    }

    private List<Article> parseFeed(String source, String url) throws Exception {
        List<Article> result = new ArrayList<>();
        XmlPullParser parser = Xml.newPullParser();
        // Force a fresh HTTP request. Some feed/CDN responses otherwise remain cached
        // and the app silently keeps the previous midnight snapshot.
        String freshUrl = url + (url.contains("?") ? "&" : "?") + "_vh=" + System.currentTimeMillis();
        URL u = new URL(freshUrl);
        java.net.URLConnection c = u.openConnection();
        c.setUseCaches(false);
        c.setConnectTimeout(15000); c.setReadTimeout(15000);
        c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 Veldio/4.9");
        c.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
        c.setRequestProperty("Pragma", "no-cache");
        c.setRequestProperty("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, */*");
        try (InputStream feedStream = c.getInputStream()) { parser.setInput(feedStream, null);
        boolean inside = false;
        String title = "", link = "", date = "", imageUrl = "";
        int event = parser.getEventType();
        while (event != XmlPullParser.END_DOCUMENT) {
            String name = parser.getName() == null ? "" : parser.getName();
            String lower = name.toLowerCase(Locale.ROOT);
            if (event == XmlPullParser.START_TAG && (lower.equals("item") || lower.equals("entry"))) inside = true;
            if (inside && event == XmlPullParser.START_TAG) {
                if (lower.equals("title")) { title = nextText(parser); }
                else if (lower.equals("link")) {
                    String href = parser.getAttributeValue(null, "href");
                    link = href != null ? href : nextText(parser);
                } else if (lower.equals("pubdate") || lower.equals("published") || lower.equals("updated") || lower.equals("dc:date")) {
                    date = nextText(parser);
                } else if (lower.equals("media:content") || lower.equals("media:thumbnail") || lower.equals("enclosure") || lower.equals("image")) {
                    String type = parser.getAttributeValue(null, "type");
                    String medium = parser.getAttributeValue(null, "medium");
                    String urlAttr = parser.getAttributeValue(null, "url");
                    if (urlAttr != null && (imageUrl.isEmpty() || "image".equalsIgnoreCase(medium) || (type != null && type.toLowerCase(Locale.ROOT).startsWith("image/")))) imageUrl = urlAttr;
                }
            }
            if (inside && event == XmlPullParser.END_TAG && (lower.equals("item") || lower.equals("entry"))) {
                if (!title.isEmpty() && link.startsWith("https://")) result.add(new Article(clean(title), link, source, date, imageUrl));
                title = ""; link = ""; date = ""; imageUrl = ""; inside = false;
            }
            event = parser.next();
        }
        }
        return result;
    }

    private String nextText(XmlPullParser parser) throws Exception {
        String value = parser.nextText();
        return value == null ? "" : value.trim();
    }

    private String clean(String s) { return s.replaceAll("\\s+", " ").trim(); }

    private void openArticle(String url, String title) {
        screenHistory.resetExit();
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            Toast.makeText(this, "Deze link is niet geldig", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            if (articleDialog != null && articleDialog.isShowing()) articleDialog.dismiss();
            articleOpen = true;
            articleDialog = new Dialog(this);
            LinearLayout page = new LinearLayout(this);
            page.setOrientation(LinearLayout.VERTICAL);
            page.setBackgroundColor(android.graphics.Color.rgb(5, 12, 9));

            LinearLayout toolbar = new LinearLayout(this);
            toolbar.setOrientation(LinearLayout.HORIZONTAL);
            toolbar.setGravity(Gravity.CENTER_VERTICAL);
            toolbar.setPadding(dp(12), dp(6), dp(12), dp(6));
            toolbar.setBackgroundColor(android.graphics.Color.rgb(5, 12, 9));

            TextView close = tv("‹  TERUG NAAR VELDIO", 14, C.TEXT, true);
            close.setGravity(Gravity.CENTER_VERTICAL);
            close.setPadding(dp(6), dp(8), dp(12), dp(8));
            close.setOnClickListener(v -> onBackPressed());
            toolbar.addView(close, new LinearLayout.LayoutParams(-2, dp(48)));

            TextView pageTitle = tv(title == null ? "Nieuwsartikel" : title, 13, C.MUTED, false);
            pageTitle.setMaxLines(1);
            pageTitle.setEllipsize(TextUtils.TruncateAt.END);
            toolbar.addView(pageTitle, new LinearLayout.LayoutParams(0, dp(48), 1));
            page.addView(toolbar, new LinearLayout.LayoutParams(-1, -2));

            activeWebView = new WebView(this);
            activeWebView.getSettings().setJavaScriptEnabled(true);
            activeWebView.getSettings().setDomStorageEnabled(true);
            activeWebView.setWebChromeClient(new WebChromeClient());
            activeWebView.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return false; // Keep navigation inside this viewer; app back/close returns directly to Veldio.
                }
            });
            page.addView(activeWebView, new LinearLayout.LayoutParams(-1, 0, 1));
            articleDialog.setContentView(page);
            android.view.Window window = articleDialog.getWindow();
            if (window != null) {
                window.setBackgroundDrawableResource(android.R.color.transparent);
                window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            }
            articleDialog.setOnDismissListener(d -> {
                if (activeWebView != null) {
                    activeWebView.stopLoading();
                    activeWebView.destroy();
                    activeWebView = null;
                }
                articleOpen = false;
            });
            articleDialog.show();
            articleDialog.setOnKeyListener((dialog,key,event)->{if(key!=android.view.KeyEvent.KEYCODE_BACK)return false;if(event.getAction()==android.view.KeyEvent.ACTION_UP)onBackPressed();return true;});
            if(android.os.Build.VERSION.SDK_INT>=33)articleDialog.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::onBackPressed);
            if (articleDialog.getWindow() != null) articleDialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            activeWebView.loadUrl(url);
        } catch (Exception e) {
            articleOpen = false;
            activeWebView = null;
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
            catch (Exception ignored) { Toast.makeText(this, "Artikel openen is niet gelukt", Toast.LENGTH_LONG).show(); }
        }
    }

    private void closeArticleView() {
        if (articleDialog != null && articleDialog.isShowing()) articleDialog.dismiss();
        else {
            articleOpen = false;
            activeWebView = null;
            showNews();
        }
    }

    private void shareArticle(String url) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, url);
        startActivity(Intent.createChooser(send, "Deel artikel"));
    }

    private void showIntro() {
        // Premium Veldio splash with a real, animated 3-second loading bar.
        final FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(PremiumDesign40.INK);
        overlay.setElevation(dp(50));
        overlay.setClickable(true);
        overlay.setFocusable(true);

        ImageView splash = new ImageView(this);
        splash.setImageResource(R.drawable.intro_splash);
        splash.setScaleType(ImageView.ScaleType.FIT_CENTER);
        splash.setContentDescription("Veldio. Alles voetbal. Eén plek.");
        overlay.addView(splash, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout loader = new LinearLayout(this);
        loader.setOrientation(LinearLayout.VERTICAL);
        loader.setGravity(Gravity.CENTER_HORIZONTAL);
        loader.setPadding(dp(28), dp(12), dp(28), dp(8));
        loader.setBackgroundColor(0x12020805);

        TextView status = tv("VELDIO WORDT GESTART", 11, 0xFFE1F5E8, true);
        status.setLetterSpacing(0.12f);
        status.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams statusLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(22));
        statusLp.bottomMargin = dp(10);
        loader.addView(status, statusLp);

        LinearLayout progressRow = new LinearLayout(this);
        progressRow.setOrientation(LinearLayout.HORIZONTAL);
        progressRow.setGravity(Gravity.CENTER_VERTICAL);
        IntroProgressView progressBar = new IntroProgressView(this);
        LinearLayout.LayoutParams barLp = new LinearLayout.LayoutParams(0, dp(12), 1f);
        barLp.rightMargin = dp(12);
        progressRow.addView(progressBar, barLp);

        TextView percent = tv("0%", 16, C.TEXT, true);
        percent.setGravity(Gravity.CENTER_VERTICAL | Gravity.RIGHT);
        percent.setMinWidth(dp(42));
        progressRow.addView(percent, new LinearLayout.LayoutParams(dp(48), dp(28)));
        loader.addView(progressRow, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(30)));

        FrameLayout.LayoutParams loaderLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        loaderLp.leftMargin = dp(8);
        loaderLp.rightMargin = dp(8);
        loaderLp.bottomMargin = dp(76);
        overlay.addView(loader, loaderLp);

        addContentView(overlay, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        ValueAnimator loadingAnimator = ValueAnimator.ofInt(0, 100);
        loadingAnimator.setDuration(3000L);
        loadingAnimator.setInterpolator(new LinearInterpolator());
        loadingAnimator.addUpdateListener(animation -> {
            int value = (Integer) animation.getAnimatedValue();
            progressBar.setProgress(value / 100f);
            percent.setText(value + "%");
        });
        loadingAnimator.addListener(new android.animation.AnimatorListenerAdapter() {
            @Override public void onAnimationEnd(android.animation.Animator animation) {
                if (isFinishing() || isDestroyed()) {
                    ViewParentHelper.remove(overlay);
                    return;
                }
                status.setText("KLAAR OM AF TE TRAPPEN");
                overlay.animate()
                        .alpha(0f)
                        .setDuration(250L)
                        .setInterpolator(new DecelerateInterpolator())
                        .withEndAction(() -> ViewParentHelper.remove(overlay))
                        .start();
            }
        });
        overlay.setAlpha(1f);
        overlay.post(loadingAnimator::start);
    }

    /** Rounded neon progress track with a soft green glow. */
    private final class IntroProgressView extends View {
        private final Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        private float progress = 0f;

        IntroProgressView(android.content.Context context) {
            super(context);
            setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            track.setColor(0xCC17271E);
            track.setStyle(Paint.Style.FILL);
            glow.setColor(C.GREEN);
            glow.setStyle(Paint.Style.FILL);
            glow.setShadowLayer(dp(7), 0, 0, 0xCC25F06B);
            fill.setColor(0xFF25F06B);
            fill.setStyle(Paint.Style.FILL);
        }

        void setProgress(float value) {
            progress = Math.max(0f, Math.min(1f, value));
            invalidate();
        }

        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float h = getHeight();
            float radius = h / 2f;
            float right = getWidth();
            RectF full = new RectF(0, 1, right, h - 1);
            canvas.drawRoundRect(full, radius, radius, track);
            Paint border = new Paint(Paint.ANTI_ALIAS_FLAG);
            border.setStyle(Paint.Style.STROKE);
            border.setStrokeWidth(dp(1));
            border.setColor(0xFF78F6A2);
            canvas.drawRoundRect(full, radius, radius, border);
            if (progress > 0f) {
                float end = Math.max(h, right * progress);
                RectF glowRect = new RectF(1, 2, Math.min(right - 1, end), h - 2);
                canvas.drawRoundRect(glowRect, radius, radius, glow);
                canvas.drawRoundRect(glowRect, radius, radius, fill);
            }
        }
    }

    private static final class ViewParentHelper {
        static void remove(View view) {
            if (view.getParent() instanceof ViewGroup) {
                ((ViewGroup) view.getParent()).removeView(view);
            }
        }
    }

    /** Draws a moving neon highlight over the source cards in the splash artwork. */
    private static class IntroGlowView extends View {
        private final Paint glowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint corePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private ValueAnimator animator;
        private float progress;

        IntroGlowView(android.content.Context context) {
            super(context);
            setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            setClickable(false);
            setFocusable(false);
            glowPaint.setStyle(Paint.Style.STROKE);
            corePaint.setStyle(Paint.Style.STROKE);
        }

        private float px(float value) { return value * getResources().getDisplayMetrics().density; }

        void startGlow() {
            if (animator != null) animator.cancel();
            animator = ValueAnimator.ofFloat(0f, 1f);
            animator.setDuration(3000L);
            animator.setRepeatCount(ValueAnimator.INFINITE);
            animator.addUpdateListener(a -> {
                progress = (Float) a.getAnimatedValue();
                invalidate();
            });
            animator.start();
        }

        void stopGlow() {
            if (animator != null) {
                animator.cancel();
                animator = null;
            }
        }

        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float w = getWidth(), h = getHeight();
            if (w <= 0 || h <= 0) return;

            // All source tiles pulse together. The six animated energy streams run
            // from the source tiles towards the central Veldio emblem.
            float[][] cards = {
                    {0.38f, 0.315f, 0.62f, 0.415f}, // VI
                    {0.095f, 0.405f, 0.335f, 0.515f}, // ESPN
                    {0.665f, 0.405f, 0.905f, 0.515f}, // VoetbalPrimeur
                    {0.095f, 0.585f, 0.335f, 0.695f}, // UEFA
                    {0.665f, 0.585f, 0.905f, 0.695f}, // VoetbalNieuws
                    {0.38f, 0.665f, 0.62f, 0.775f}  // Flashscore
            };
            float hubX = w * 0.5f, hubY = h * 0.545f;
            float pulse = (float)(0.5 + 0.5 * Math.sin(progress * Math.PI * 2.0));

            // Persistent, subtle connection rails.
            Paint rail = new Paint(Paint.ANTI_ALIAS_FLAG);
            rail.setStyle(Paint.Style.STROKE);
            rail.setStrokeCap(Paint.Cap.ROUND);
            rail.setStrokeWidth(px(2.0f));
            rail.setColor(android.graphics.Color.argb(85, 0, 255, 112));
            rail.setShadowLayer(px(8), 0, 0, android.graphics.Color.argb(70, 0, 255, 100));
            for (float[] b : cards) {
                float sx = (b[0] + b[2]) * 0.5f * w;
                float sy = (b[1] + b[3]) * 0.5f * h;
                canvas.drawLine(sx, sy, hubX, hubY, rail);
            }

            // Each card gets the same breathing neon outline, like a charging dashboard.
            for (float[] b : cards) {
                RectF r = new RectF(b[0] * w, b[1] * h, b[2] * w, b[3] * h);
                int alpha = (int)(115 + 105 * pulse);
                glowPaint.setColor(android.graphics.Color.argb(alpha, 0, 255, 112));
                glowPaint.setStrokeWidth(px(2.5f + 1.1f * pulse));
                glowPaint.setShadowLayer(px(12 + 13 * pulse), 0, 0,
                        android.graphics.Color.argb((int)(130 + 100 * pulse), 0, 255, 95));
                canvas.drawRoundRect(r, px(22), px(22), glowPaint);
                corePaint.setColor(android.graphics.Color.argb((int)(70 + 90 * pulse), 110, 255, 165));
                corePaint.setStrokeWidth(px(1.2f));
                corePaint.clearShadowLayer();
                canvas.drawRoundRect(r, px(22), px(22), corePaint);
            }

            // Bright energy pulses travel from every source into the central hub at once.
            Paint stream = new Paint(Paint.ANTI_ALIAS_FLAG);
            stream.setStyle(Paint.Style.STROKE);
            stream.setStrokeCap(Paint.Cap.ROUND);
            stream.setStrokeWidth(px(3.0f));
            stream.setColor(android.graphics.Color.argb((int)(150 + 100 * pulse), 45, 255, 130));
            stream.setShadowLayer(px(15), 0, 0, android.graphics.Color.argb(230, 0, 255, 110));
            Paint charge = new Paint(Paint.ANTI_ALIAS_FLAG);
            charge.setStyle(Paint.Style.FILL);
            charge.setColor(android.graphics.Color.WHITE);
            charge.setShadowLayer(px(15), 0, 0, android.graphics.Color.rgb(0, 255, 110));
            for (float[] b : cards) {
                float sx = (b[0] + b[2]) * 0.5f * w;
                float sy = (b[1] + b[3]) * 0.5f * h;
                // The illuminated segment length grows and contracts as energy is transferred.
                float t = 0.28f + 0.62f * progress;
                canvas.drawLine(sx, sy, sx + (hubX - sx) * t, sy + (hubY - sy) * t, stream);
                float dotT = progress;
                float dx = sx + (hubX - sx) * dotT;
                float dy = sy + (hubY - sy) * dotT;
                canvas.drawCircle(dx, dy, px(4.0f + 2.2f * pulse), charge);
            }

            // Central emblem receives the charge and gently brightens.
            Paint hub = new Paint(Paint.ANTI_ALIAS_FLAG);
            hub.setStyle(Paint.Style.STROKE);
            hub.setColor(android.graphics.Color.argb((int)(125 + 115 * pulse), 0, 255, 110));
            hub.setStrokeWidth(px(2.5f + 1.3f * pulse));
            hub.setShadowLayer(px(22), 0, 0, android.graphics.Color.argb((int)(150 + 100 * pulse), 0, 255, 100));
            float radius = Math.min(w, h) * (0.115f + 0.006f * pulse);
            canvas.drawCircle(hubX, hubY, radius, hub);
        }
    }

    private void showVideos(){
 enterScreen("videos",this::showVideos);content.removeAllViews();
 findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
 videoShelf40=new VideoShelf40(this);content.addView(videoShelf40,new android.widget.FrameLayout.LayoutParams(-1,-1));
}
private void showColumn() {
        enterScreen("column",this::showColumn);
        personalHubVisible = false; personalHub = null;
        eredivisieStatisticsVisible = false; weeklyPreviewVisible = false;
        findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        currentBottomTab = "Nieuws";
        buildNav();
    if (liveScoresRefresh != null) main.removeCallbacks(liveScoresRefresh);
    scoresPageVisible = false;
    content.removeAllViews();
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.addView(VeldioEditorial.columnHeader(this,this::onBackPressed));
    ScrollView scroll = new ScrollView(this);
    LinearLayout page = new LinearLayout(this);
    page.setOrientation(LinearLayout.VERTICAL);
    page.setPadding(dp(12), 0, dp(12), dp(24));
    ColumnBannerView columnBanner = new ColumnBannerView(this, () -> {}, false);
    LinearLayout.LayoutParams bannerParams = new LinearLayout.LayoutParams(-1, dp(216));
    bannerParams.setMargins(0, dp(4), 0, dp(14));
    page.addView(columnBanner, bannerParams);
    TextView columnIntro = tv("De column van Sander Brink voor Veldio. Een eigen kijk op voetbal.", 14, C.MUTED, false);
    columnIntro.setPadding(dp(4), 0, dp(4), dp(16)); page.addView(columnIntro);
    TextView archive = tv("Nieuwste columns", 20, C.TEXT, true);
    archive.setPadding(0, dp(4), 0, dp(16));
    page.addView(archive);
    addEditorialNewsSection(page, true);
    scroll.addView(page);
    root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    content.addView(root);PremiumDesign40.polish(root);
}

private void showScores() {
        enterScreen("scores",this::showScores);
        personalHubVisible = false; personalHub = null;
        eredivisieStatisticsVisible = false; weeklyPreviewVisible = false;
        findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
    if (liveScoresRefresh != null) main.removeCallbacks(liveScoresRefresh);
    scoresPageVisible = false;
    content.removeAllViews();
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.addView(sectionHeader("Uitslagen", "TERUG", this::onBackPressed));
    LinearLayout list = new LinearLayout(this);
    list.setOrientation(LinearLayout.VERTICAL);
    list.setPadding(dp(18), dp(18), dp(18), dp(24));
    list.addView(tv("Live uitslagen zijn tijdelijk verwijderd totdat de gebruiksrechten zijn bevestigd.", 15, C.MUTED, false));
    root.addView(list, new LinearLayout.LayoutParams(-1, -1));
    content.addView(root);PremiumDesign40.polish(root);
}


    private void addApiFootballEuropeanSection(LinearLayout parent) { /* disabled pending rights confirmation */ }


    private static final String EDITORIAL_API_URL = "https://voetbalhub-redactie.onrender.com";

    private boolean editorialArticleOpen = false;
    private android.app.Dialog editorialDialog;

    private void closeEditorialArticle() {
        if (editorialDialog != null) editorialDialog.dismiss();
        editorialArticleOpen = false;
    }

    private void showEditorialArticle(org.json.JSONObject article) {
        Branding.article(article);
        screenHistory.resetExit();
        if (homeFeature != null) homeFeature.pauseVideo();
        editorialArticleOpen = true;
        if (liveScoresRefresh != null) main.removeCallbacks(liveScoresRefresh);
        if (editorialDialog != null && editorialDialog.isShowing()) editorialDialog.dismiss();
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(VeldioEditorial.INK);
        root.addView(VeldioEditorial.readerHeader(this, "column".equalsIgnoreCase(article.optString("type")) || "de derde helft".equalsIgnoreCase(article.optString("category")), this::closeEditorialArticle));
        final java.util.ArrayList<TextView> readingText = new java.util.ArrayList<>();
        LinearLayout tools = new LinearLayout(this); tools.setGravity(Gravity.CENTER_VERTICAL);tools.setPadding(dp(14), dp(4), dp(14), dp(8));
        TextView save = tv(EditorialStore.contains(this, article) ? "★ Bewaard" : "☆ Bewaren", 13, C.GREEN, true);
        save.setGravity(Gravity.CENTER_VERTICAL); tools.addView(save, new LinearLayout.LayoutParams(0, dp(44), 1));
        save.setOnClickListener(v -> { boolean stored = EditorialStore.toggle(this, article); save.setText(stored ? "★ Bewaard" : "☆ Bewaren"); Toast.makeText(this, stored ? "Artikel bewaard op dit apparaat" : "Artikel uit leeslijst verwijderd", Toast.LENGTH_SHORT).show(); });
        TextView smaller = tv("A−", 14, C.TEXT, true); smaller.setGravity(Gravity.CENTER); tools.addView(smaller, new LinearLayout.LayoutParams(dp(44),dp(44)));smaller.setContentDescription("Kleinere artikeltekst");
        TextView larger = tv("A+", 17, C.TEXT, true); larger.setGravity(Gravity.CENTER); tools.addView(larger, new LinearLayout.LayoutParams(dp(44),dp(44)));larger.setContentDescription("Grotere artikeltekst");
        android.view.View.OnClickListener resize = v -> {int size = Math.max(15, Math.min(23, prefs.getInt("readerFontSize",17) + (v == larger ? 1 : -1)));prefs.edit().putInt("readerFontSize",size).apply();for(TextView paragraph : readingText)paragraph.setTextSize(size);};smaller.setOnClickListener(resize);larger.setOnClickListener(resize);
        TextView share = tv("Delen", 12, C.MUTED, true);share.setGravity(Gravity.CENTER);tools.addView(share,new LinearLayout.LayoutParams(dp(52),dp(44)));share.setOnClickListener(v -> {Intent send = new Intent(Intent.ACTION_SEND);send.setType("text/plain");send.putExtra(Intent.EXTRA_SUBJECT,article.optString("headline"));send.putExtra(Intent.EXTRA_TEXT,article.optString("headline")+"\n\n"+article.optString("standfirst")+"\n\nVeldio · Alles voetbal. Eén plek.");try{startActivity(Intent.createChooser(send,"Artikel delen"));}catch(Exception ignored){}});
        VeldioEditorial.styleTools(this, tools); LinearLayout.LayoutParams toolsLp=new LinearLayout.LayoutParams(-1,-2);toolsLp.setMargins(0,dp(6),0,dp(14));
        ScrollView scroll = new ScrollView(this);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(16), dp(8), dp(16), dp(28));
        // Reader actions scroll with the article. No text can be hidden behind a fixed bar.
        page.addView(tools,toolsLp);
        boolean isColumnReader = "column".equalsIgnoreCase(article.optString("type", "")) ||
            "de derde helft".equalsIgnoreCase(article.optString("category", ""));
        if (isColumnReader) {
            LinearLayout.LayoutParams banner = new LinearLayout.LayoutParams(-1, dp(190));banner.bottomMargin=dp(16);page.addView(new ColumnBannerView(this, this::showColumn, false),banner);
        } else {
            page.addView(VeldioEditorial.category(this, article.optString("category", "VOETBAL").toUpperCase(java.util.Locale.ROOT)));
        }
        TextView title = tv(article.optString("headline", "Voetbalnieuws"), 30, VeldioEditorial.SILVER, true);
        title.setPadding(0, dp(8), 0, dp(10));
        page.addView(title);
        String published = article.optString("publishedAt", "");String dateLabel = "";
        try {dateLabel = java.time.format.DateTimeFormatter.ofPattern("d MMMM yyyy · HH:mm", new java.util.Locale("nl","NL")).withZone(java.time.ZoneId.of("Europe/Amsterdam")).format(java.time.Instant.parse(published));} catch(Exception ignored) {}
        int words = 0;org.json.JSONArray readBody = article.optJSONArray("body");if(readBody!=null)for(int i=0;i<readBody.length();i++)words+=readBody.optString(i, "").trim().split("\\s+").length;
        TextView metadata = tv((dateLabel.isEmpty()?"":dateLabel+" · ")+Math.max(1,(words+199)/200)+" min leestijd", 11, C.MUTED, false);metadata.setPadding(0,0,0,dp(10));page.addView(metadata);
        TextView originalArt = VeldioEditorial.artwork(this);
        originalArt.setGravity(android.view.Gravity.CENTER);
        android.graphics.drawable.GradientDrawable artBackground = new android.graphics.drawable.GradientDrawable(
            android.graphics.drawable.GradientDrawable.Orientation.TL_BR,
            new int[]{0xFF145B36, 0xFF091C14});
        artBackground.setCornerRadius(dp(14));
        VeldioEditorial.styleArtwork(this,originalArt);
        LinearLayout.LayoutParams artParams = new LinearLayout.LayoutParams(-1, Math.round((getResources().getDisplayMetrics().widthPixels-dp(32))*9f/16f));
        artParams.setMargins(0, dp(10), 0, dp(14));
        page.addView(originalArt, artParams);if(isColumnReader)originalArt.setVisibility(android.view.View.GONE);
        String coverUrl = article.optString("imageUrl", "").trim();
        page.addView(EditorialPhotos.credit(this,article));
                  String coverRights = article.optString("imageRights", "").trim().toLowerCase(java.util.Locale.ROOT);
        if (!isColumnReader && coverUrl.startsWith("https://") && ("cleared".equals(coverRights) || "licensed".equals(coverRights))) {
            android.widget.ImageView cover = new android.widget.ImageView(this);
            cover.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);cover.setAdjustViewBounds(true);
            cover.setContentDescription("Afbeelding bij artikel"); VeldioEditorial.styleCover(this,cover);
            LinearLayout.LayoutParams coverLp = new LinearLayout.LayoutParams(-1, -2);
            coverLp.setMargins(0, dp(8), 0, dp(14));
            page.addView(cover, coverLp);
            cover.setVisibility(android.view.View.GONE);
            executor.execute(() -> {
                android.graphics.Bitmap localPhoto=EditorialPhotos.bitmap(this,article,1600);if(localPhoto!=null){runOnUiThread(()->{cover.setImageBitmap(localPhoto);cover.setVisibility(android.view.View.VISIBLE);originalArt.setVisibility(android.view.View.GONE);});return;}
                HttpURLConnection imageConn = null;
                try {
                    imageConn = (HttpURLConnection) new URL(coverUrl).openConnection();
                    imageConn.setConnectTimeout(10000);
                    imageConn.setReadTimeout(12000);
                    imageConn.setInstanceFollowRedirects(false);
                    int length = imageConn.getContentLength();
                    String type = imageConn.getContentType();
                    if (imageConn.getResponseCode() != 200 || type == null ||
                        !type.toLowerCase(java.util.Locale.ROOT).startsWith("image/") ||
                        length > 5000000) throw new java.io.IOException("Invalid image");
                    android.graphics.Bitmap bitmap;
                    try (InputStream stream = imageConn.getInputStream()) {
                        bitmap = EditorialBitmap.read(stream,1600);
                    }
                    if (bitmap == null) throw new java.io.IOException("Invalid bitmap");
                    runOnUiThread(() -> {cover.setImageBitmap(bitmap);cover.setVisibility(android.view.View.VISIBLE);originalArt.setVisibility(android.view.View.GONE);});
                } catch (Exception ignored) {
                    runOnUiThread(() -> {
                        cover.setVisibility(android.view.View.GONE);
                        originalArt.setVisibility(android.view.View.VISIBLE);
                    });
                } finally {
                    if (imageConn != null) imageConn.disconnect();
                }
            });
        }
        String intro = article.optString("standfirst", "").trim();
        if (!intro.isEmpty()) {
            TextView introText = tv(intro, 16, 0xFFCDDDD2, false); introText.setLineSpacing(dp(4),1f);
            introText.setPadding(0, 0, 0, dp(12));
            page.addView(introText);
        }
        // Original articles use the local licensed Veldio banner only.
        // No remote image slot or image credit is created in this reader.
        TextView byline = tv(article.optString("author", "Veldio Redactie"), 11, C.MUTED, false);
        byline.setPadding(0, 0, 0, dp(12));
        page.addView(byline);
        org.json.JSONArray paragraphs = article.optJSONArray("body");
        if (paragraphs != null) {
            for (int i = 0; i < paragraphs.length(); i++) {
                String paragraph = paragraphs.optString(i, "").trim();
                if (!paragraph.isEmpty()) {
                    TextView bodyText = tv(paragraph, prefs.getInt("readerFontSize",17), C.TEXT, false);bodyText.setLineSpacing(dp(5),1f);bodyText.setTextIsSelectable(true);readingText.add(bodyText);
                    bodyText.setPadding(0, 0, 0, dp(14));
                    page.addView(bodyText);
                }
            }
        }
        String why = article.optString("why_it_matters", "");
        if (!why.isEmpty()) {
            page.addView(tv("WAAROM DIT ERTOE DOET", 12, C.GREEN, true));
            TextView whyText = tv(why, 15, C.TEXT, false);
            whyText.setPadding(0, dp(6), 0, dp(14));
            page.addView(whyText);
        }
        android.view.View line = new android.view.View(this);
        line.setBackgroundColor(0xFF244136);
        LinearLayout.LayoutParams lineLp = new LinearLayout.LayoutParams(-1, dp(1));
        lineLp.setMargins(0, dp(8), 0, dp(12));
        page.addView(line, lineLp);
        String disclosure=article.optString("aiDisclosure", "");
        if(!disclosure.isEmpty()){TextView disclosureView=tv(disclosure,11,C.MUTED,false);disclosureView.setPadding(0,dp(8),0,dp(8));page.addView(disclosureView);}
        page.addView(ads().slot("reader"),new LinearLayout.LayoutParams(-1,-2));
        page.addView(VeldioEditorial.footer(this));
        scroll.addView(page);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        editorialDialog = new android.app.Dialog(this);
        editorialDialog.requestWindowFeature(android.view.Window.FEATURE_NO_TITLE);
        editorialDialog.setContentView(root);
        editorialDialog.setOnDismissListener(dialog -> { editorialArticleOpen = false; editorialDialog = null;if(personalHub!=null)personalHub.refreshSaved(); });
        editorialDialog.show();
        android.view.Window articleWindow = editorialDialog.getWindow();
        if (articleWindow != null) {
            articleWindow.setBackgroundDrawableResource(android.R.color.black);
            articleWindow.setLayout(-1, -1);
        }
    }

    private void addEditorialNewsSection(LinearLayout parent, boolean columnOnly) {
    FeedRepository.configure(this,EDITORIAL_API_URL);
    LinearLayout section=new LinearLayout(this);section.setOrientation(LinearLayout.VERTICAL);parent.addView(section,new LinearLayout.LayoutParams(-1,-2));

    section.addView(new FeedPanel(this,active,columnOnly,this::showEditorialArticle),new LinearLayout.LayoutParams(-1,-2));
}

    
    private void addPublisherLinkSection(LinearLayout parent) {
        LinearLayout section = new LinearLayout(this);
        section.setOrientation(LinearLayout.VERTICAL);
        section.setPadding(dp(12), dp(10), dp(12), dp(10));
        section.setBackground(cardBackground());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(0, 0, 0, dp(8));
        parent.addView(section, lp);
        section.addView(tv("NIEUWS BIJ DE BRON", 13, C.GREEN, true));
        section.addView(tv("Open het laatste nieuws rechtstreeks bij de uitgever. Koppen en foto's worden hier niet overgenomen.", 13, C.MUTED, false));
        String[][] publishers = {
            {"VI", "https://www.vi.nl/"},
            {"VoetbalPrimeur", "https://www.voetbalprimeur.nl/"},
            {"VoetbalNieuws", "https://www.voetbalnieuws.nl/"}
        };
        for (String[] publisher : publishers) {
            TextView link = tv("Open " + publisher[0] + "  ↗", 15, C.TEXT, true);
            link.setPadding(0, dp(12), 0, dp(8));
            link.setOnClickListener(v -> openArticle(publisher[1], publisher[0]));
            section.addView(link);
        }
    }

        private void scheduleScoresMidnightReset() {
        if (dailyScoresReset != null) main.removeCallbacks(dailyScoresReset);
        java.util.Calendar now = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("Europe/Amsterdam"));
        java.util.Calendar next = (java.util.Calendar) now.clone();
        next.add(java.util.Calendar.DAY_OF_YEAR, 1);
        next.set(java.util.Calendar.HOUR_OF_DAY, 0);
        next.set(java.util.Calendar.MINUTE, 0);
        next.set(java.util.Calendar.SECOND, 1);
        next.set(java.util.Calendar.MILLISECOND, 0);
        long delay = Math.max(1000L, next.getTimeInMillis() - now.getTimeInMillis());
        dailyScoresReset = () -> {
            if (scoresPageVisible && !isFinishing() && !isDestroyed()) showScores();
        };
        main.postDelayed(dailyScoresReset, delay);
    }

    private void addDailyFixtureSection(LinearLayout parent, String title, String[] endpoints, boolean cupOnlyQuarterFinal) { /* disabled pending rights confirmation */ }

    private String getCupStageText(JSONObject event, JSONObject competition, JSONObject scoreboard) {
        StringBuilder text = new StringBuilder();
        text.append(event.optString("name", " ")).append(' ')
            .append(event.optString("shortName", " ")).append(' ')
            .append(event.optString("seasonType", " ")).append(' ')
            .append(event.optString("week", " ")).append(' ');
        if (competition != null) {
            text.append(competition.optString("name", " ")).append(' ')
                .append(competition.optString("notes", " ")).append(' ');
            JSONArray notes = competition.optJSONArray("notes");
            if (notes != null) for (int i = 0; i < notes.length(); i++) {
                JSONObject note = notes.optJSONObject(i);
                if (note != null) text.append(note.optString("headline", " ")).append(' ');
            }
        }
        JSONObject season = scoreboard.optJSONObject("season");
        if (season != null) text.append(season.optString("name", " ")).append(' ');
        return text.toString().toLowerCase(java.util.Locale.ROOT);
    }

    /** Only the six clubs requested for European competition coverage. */
    private boolean isTargetEuropeanClub(String team) {
        String t = team == null ? "" : team.toLowerCase(java.util.Locale.ROOT).trim();
        String[] clubs = {"psv", "psv eindhoven", "ajax", "ajax amsterdam", "feyenoord", "feyenoord rotterdam",
                "az", "az alkmaar", "fc twente", "twente enschede", "nec", "nec nijmegen", "nijmegen"};
        for (String club : clubs) {
            if (club.equals("az") || club.equals("psv") || club.equals("ajax") || club.equals("nec") || club.equals("feyenoord")) {
                if (t.matches(".*(^|[^a-z])" + java.util.regex.Pattern.quote(club) + "([^a-z]|$).*")) return true;
            } else if (t.contains(club)) return true;
        }
        return false;
    }

    private boolean isDutchClub(String team) {
        String t = team == null ? "" : team.toLowerCase(java.util.Locale.ROOT);
        String[] clubs = {"ajax", "psv", "feyenoord", "az alkmaar", "fc twente", "go ahead eagles", "fc utrecht", "fc groningen", "sc groningen", "sc heerenveen", "nec nijmegen", "sparta rotterdam", "heracles", "fortuna sittard", "pec zwolle", "nac breda", "willem ii", "rkc waalwijk", "fc volendam", "de graafschap", "cambuur", "ado den haag", "telstar", "excelsior", "almere city", "vitesse", "roda jc", "fc emmen", "helmond sport", "fc dordrecht", "top oss", "jong ajax", "jong psv", "jong az", "psv eindhoven", "feyenoord rotterdam", "ajax amsterdam", "fc twente enschede"};
        for (String club : clubs) if (t.contains(club)) return true;
        // ESPN sometimes names AZ simply "AZ" instead of "AZ Alkmaar".
        return t.matches(".*(^|[^a-z])az([^a-z]|$).*");
    }

    private String todayKey() {
        return java.time.LocalDate.now(java.time.ZoneId.of("Europe/Amsterdam")).toString();
    }

    /** Convert ESPN's UTC/offset timestamp to the Dutch local calendar day. */
    private String localDayKey(String isoDate) {
        if (isoDate == null || isoDate.trim().isEmpty()) return "";
        java.time.ZoneId zone = java.time.ZoneId.of("Europe/Amsterdam");
        try { return java.time.Instant.parse(isoDate).atZone(zone).toLocalDate().toString(); } catch (Exception ignored) { }
        try { return java.time.OffsetDateTime.parse(isoDate).atZoneSameInstant(zone).toLocalDate().toString(); } catch (Exception ignored) { }
        try { return java.time.LocalDateTime.parse(isoDate).atZone(zone).toLocalDate().toString(); } catch (Exception ignored) { }
        return isoDate.length() >= 10 ? isoDate.substring(0, 10) : "";
    }

    private String formatDayLabel(String day) {
        try {
            java.text.SimpleDateFormat input = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.ROOT);
            input.setTimeZone(java.util.TimeZone.getTimeZone("Europe/Amsterdam"));
            java.util.Date d = input.parse(day);
            java.text.SimpleDateFormat output = new java.text.SimpleDateFormat("EEEE d MMMM", new java.util.Locale("nl", "NL"));
            output.setTimeZone(java.util.TimeZone.getTimeZone("Europe/Amsterdam"));
            String value = output.format(d);
            return value.substring(0, 1).toUpperCase(new java.util.Locale("nl", "NL")) + value.substring(1);
        } catch (Exception e) { return day; }
    }

    private void addAction(LinearLayout list, String title, String url) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(16), dp(13), dp(14), dp(13));
        card.setBackground(cardBackground());
        TextView label = tv(title, 15, C.TEXT, false);
        label.setGravity(Gravity.CENTER_VERTICAL);
        card.addView(label, new LinearLayout.LayoutParams(0, -2, 1));
        TextView arrow = tv("↗", 20, C.GREEN, true);
        arrow.setGravity(Gravity.CENTER);
        card.addView(arrow, new LinearLayout.LayoutParams(dp(28), dp(32)));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(0, 0, 0, dp(9));
        list.addView(card, lp);
        card.setOnClickListener(v -> openUrl(url));
    }


    private void showWeeklyPreview(String snapshot) {
        enterScreen("preview:"+snapshot.hashCode(),()->showWeeklyPreview(snapshot));
        personalHubVisible = false; personalHub = null;
        if (liveScoresRefresh != null) main.removeCallbacks(liveScoresRefresh);
        scoresPageVisible = false;
        weeklyPreviewVisible = true; eredivisieStatisticsVisible = false;
        currentBottomTab = "Nieuws"; buildNav();
        findViewById(R.id.header).setVisibility(android.view.View.GONE);
        findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        content.removeAllViews();
        content.addView(new MatchPreviewView(this, snapshot, this::onBackPressed), new android.widget.FrameLayout.LayoutParams(-1, -1));
    }
    private void showEredivisieStatistics(boolean feature) {showEredivisieStatistics(feature,"");}
    private void showEredivisieStatistics(boolean feature,String restoredState) {
        enterScreen("statistics:"+feature,()->showEredivisieStatistics(feature,restoredState));statisticsFeature=feature;
        personalHubVisible = false; personalHub = null;
        if (liveScoresRefresh != null) main.removeCallbacks(liveScoresRefresh);
        scoresPageVisible = false;
        eredivisieStatisticsVisible = true;
        currentBottomTab = "Nieuws";
        buildNav();
        content.removeAllViews();
        statisticsView=new EredivisieStatsView(this, this::onBackPressed, feature,restoredState);
        statisticsView.setClubOpener(name->showPersonalHub("profile",name));
        content.addView(statisticsView, new android.widget.FrameLayout.LayoutParams(-1, -1));
    }
    private void addEredivisieFeature(LinearLayout parent) {
        WeeklyMatchCard feature = new WeeklyMatchCard(this, () -> showEredivisieStatistics(false), snapshot -> showWeeklyPreview(snapshot));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.setMargins(dp(4), dp(8), dp(4), dp(16));
        parent.addView(feature, lp);
    }


    private void showCompetitions() {
        enterScreen("competitions",this::showCompetitions);
        personalHubVisible = false; personalHub = null;
        eredivisieStatisticsVisible = false; weeklyPreviewVisible = false;
        findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        currentBottomTab = "Nieuws";
        buildNav();
        scoresPageVisible = false;
        content.removeAllViews(); LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.addView(sectionHeader("Competities"));
        LinearLayout list = new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL); list.setPadding(dp(4), 0, dp(4), dp(24));
        String[][] c = {{"Eredivisie","https://eredivisie.nl/","eredivisie.nl"},{"Keuken Kampioen Divisie","https://keukenkampioendivisie.nl/","keukenkampioendivisie.nl"},{"Champions League","https://www.uefa.com/uefachampionsleague/","uefa.com"},{"Europa League","https://www.uefa.com/uefaeuropaleague/","uefa.com"},{"Conference League","https://www.uefa.com/uefaconferenceleague/","uefa.com"},{"Premier League","https://www.premierleague.com/","premierleague.com"},{"La Liga","https://www.laliga.com/","laliga.com"},{"Serie A","https://www.legaseriea.it/","legaseriea.it"},{"Bundesliga","https://www.bundesliga.com/","bundesliga.com"},{"Ligue 1","https://www.ligue1.com/","ligue1.com"}};
        android.widget.GridLayout grid=new android.widget.GridLayout(this);grid.setColumnCount(2);
        android.graphics.Bitmap arena=CompetitionTile.artwork(this);
        String[] codes={"ED","KKD","CL","EL","CO","PL","LL","SA","BL","L1"};
        int[] accents={0xFF338AF4,0xFFDA3651,0xFF436DF1,0xFFEF9426,0xFF40C94B,0xFFAE52D1,0xFFDB436B,0xFF2E9DE4,0xFFDD383F,0xFF438A9C};
        for(int i=0;i<c.length;i++){final String[] x=c[i];CompetitionTile tile=new CompetitionTile(this,x[0],codes[i%codes.length],accents[i%accents.length],arena,()->{showCompetition40(x[0],x[1]);});
            android.widget.GridLayout.LayoutParams gp=new android.widget.GridLayout.LayoutParams();gp.width=0;gp.height=-2;gp.columnSpec=android.widget.GridLayout.spec(android.widget.GridLayout.UNDEFINED,1f);gp.setMargins(dp(5),dp(6),dp(5),dp(6));grid.addView(tile,gp);
        }
        list.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        TextView artNote=tv("Eigen competitie-emblemen · AI-sfeerbeeld van een fictief stadion",10,C.MUTED,false);artNote.setPadding(dp(9),dp(10),dp(9),dp(12));list.addView(artNote);
        ScrollView scroll = new ScrollView(this); scroll.addView(list); root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1)); content.addView(root);PremiumDesign40.polish(root);
    }

    private Set<String> getSavedArticleLinks() {
        Set<String> stored = prefs.getStringSet("savedArticles", Collections.<String>emptySet());
        return new HashSet<>(stored);
    }

    private boolean isArticleSaved(String link) {
        return link != null && getSavedArticleLinks().contains(link);
    }

    private void toggleSavedArticle(String link) {
        Set<String> saved = getSavedArticleLinks();
        if (saved.contains(link)) saved.remove(link); else saved.add(link);
        prefs.edit().putStringSet("savedArticles", saved).apply();
    }

    
    private void showPersonalHub(String mode,String query) {showPersonalHub(mode,query,"");}
    private void showPersonalHub(String mode,String query,String restoredState) {
        enterScreen("personal:"+mode+":"+query,()->showPersonalHub(mode,query,restoredState));personalMode=mode;personalQuery=query;
        if (liveScoresRefresh != null) main.removeCallbacks(liveScoresRefresh);
        scoresPageVisible = false; weeklyPreviewVisible = false; eredivisieStatisticsVisible = false;
        personalHubVisible = true;
        currentBottomTab = "favorites".equals(mode) || "profile".equals(mode) ? "Mijn Clubs" : "Nieuws";
        buildNav(); findViewById(R.id.header).setVisibility(android.view.View.GONE);findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        content.removeAllViews();personalHub = new PersonalHubView(this, mode, query, this::showEditorialArticle, this::onBackPressed,restoredState);
        content.addView(personalHub, new android.widget.FrameLayout.LayoutParams(-1, -1));
    }

    private void showFavorites() { showPersonalHub("favorites", ""); }

    private String favoriteClubLogo(String club) {
        String[][] map = {
            {"FC Groningen","fcgroningen.nl"}, {"Ajax","ajax.nl"}, {"PSV","psv.nl"},
            {"Feyenoord","feyenoord.com"}, {"AZ","az.nl"}, {"FC Twente","fctwente.nl"},
            {"SC Heerenveen","sc-heerenveen.nl"}, {"FC Utrecht","fcutrecht.nl"}, {"NEC","nec-nijmegen.nl"},
            {"Sparta Rotterdam","sparta-rotterdam.nl"}, {"Heracles Almelo","heracles.nl"},
            {"Go Ahead Eagles","ga-eagles.nl"}, {"Fortuna Sittard","fortunasittard.nl"},
            {"PEC Zwolle","peczwolle.nl"}, {"NAC Breda","nac.nl"}, {"Willem II","willem-ii.nl"},
            {"Real Madrid","realmadrid.com"}, {"FC Barcelona","fcbarcelona.com"}, {"Liverpool","liverpoolfc.com"},
            {"Arsenal","arsenal.com"}, {"Manchester City","mancity.com"}, {"Bayern München","fcbayern.com"}
        };
        for (String[] item : map) if (item[0].equals(club)) return "https://www.google.com/s2/favicons?domain=" + item[1] + "&sz=128";
        return null;
    }

    private String clubInitials(String club) { String[] parts = club.split(" "); if (parts.length == 1) return club.substring(0, Math.min(3, club.length())).toUpperCase(Locale.ROOT); return (parts[0].substring(0,1) + parts[1].substring(0,1)).toUpperCase(Locale.ROOT); }

    private String join(Set<String> s, String sep) { StringBuilder b = new StringBuilder(); for (String x : s) { if (b.length() > 0) b.append(sep); b.append(x); } return b.toString(); }

    private void showStadiums(String id) {
        enterScreen("stadiums:"+id,()->showStadiums(id));
        personalHubVisible=false; personalHub=null; eredivisieStatisticsVisible=false; weeklyPreviewVisible=false;
        findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        content.removeAllViews();content.addView(new StadiumView(this,id,this::onBackPressed),new android.widget.FrameLayout.LayoutParams(-1,-1));
    }
    private ClubQuizView clubQuizView;
    private void closeClubQuiz(){clubQuizView=null;onBackPressed();}
    private void showClubQuiz() {
        enterScreen("clubquiz",this::showClubQuiz);
        currentBottomTab = "Meer";
        buildNav();
        personalHubVisible=false; personalHub=null; eredivisieStatisticsVisible=false; weeklyPreviewVisible=false;
        findViewById(R.id.header).setVisibility(android.view.View.GONE);
        findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        content.removeAllViews();clubQuizView=new ClubQuizView(this,this::closeClubQuiz);content.addView(clubQuizView,new android.widget.FrameLayout.LayoutParams(-1,-1));
    }
    private void addPremiumTile(android.widget.GridLayout grid,String title,String subtitle,Runnable action){
        LinearLayout tile=new LinearLayout(this);tile.setOrientation(LinearLayout.VERTICAL);tile.setGravity(android.view.Gravity.CENTER);tile.setPadding(dp(9),dp(12),dp(9),dp(12));
        android.graphics.drawable.GradientDrawable bg=new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TL_BR,new int[]{0xFF142C1D,0xFF030A06});bg.setCornerRadius(dp(15));bg.setStroke(dp(1),0xFF50754A);tile.setBackground(bg);tile.setElevation(dp(2));
        NavIconView icon=new NavIconView(this,title,true);tile.addView(icon,new LinearLayout.LayoutParams(dp(34),dp(34)));TextView label=tv(title,15,0xFFF1F8F1,true);label.setGravity(android.view.Gravity.CENTER);label.setMaxLines(2);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(7);tile.addView(label,lp);
        if(!subtitle.equals(title)){TextView small=tv(subtitle,10,0xFFB1C8B5,false);small.setGravity(android.view.Gravity.CENTER);small.setMaxLines(2);tile.addView(small);}
        android.util.TypedValue feedback=new android.util.TypedValue();getTheme().resolveAttribute(android.R.attr.selectableItemBackground,feedback,true);tile.setForeground(getDrawable(feedback.resourceId));tile.setFocusable(true);tile.setClickable(true);tile.setOnClickListener(v->action.run());android.widget.GridLayout.LayoutParams gp=new android.widget.GridLayout.LayoutParams();gp.width=0;gp.height=dp(127);gp.columnSpec=android.widget.GridLayout.spec(android.widget.GridLayout.UNDEFINED,1f);gp.setMargins(dp(5),dp(5),dp(5),dp(5));grid.addView(tile,gp);
    }
    private void showHome39(){showDestination39("home");}
    private void openDestination39(String id){
        if(id.startsWith("competitionNews:")){String key=id.substring(16);try{org.json.JSONObject names=new org.json.JSONObject(new String(BoundedInput.read(getAssets().open("competition-names47.json"),10000),java.nio.charset.StandardCharsets.UTF_8));showPersonalHub("competition",names.optString(key,key));}catch(Exception ignored){}return;}
        switch(id){
        case "news":active="Voor jou";articleDisplayLimit=20;showNews();break;
        case "competitions":showCompetitions();break;
        case "quiz":showClubQuiz();break;
        case "stadium":showStadiums("");break;
        case "column":showColumn();break;
        case "videos":showVideos();break;
        case "standings":showDestination39("competition:eredivisie");break;
        case "statistics":showEredivisieStatistics(false);break;
        case "favorites":showFavorites();break;
        case "myclub":showFavorites();break;
        case "more":showMore();break;
        case "fixtures":case "predictions":case "clubs":case "notifications":showDestination39(id);break;
        }
    }
    private void showDestination39(String mode){
        enterScreen("destination39:"+mode,()->showDestination39(mode));
        if ("home".equals(mode)) {
            active = "Voor jou";
            buildChips();
        }
        if(liveScoresRefresh!=null)main.removeCallbacks(liveScoresRefresh);
        if(homeFeature!=null)homeFeature.closeVideo();
        personalHubVisible=false;personalHub=null;eredivisieStatisticsVisible=false;weeklyPreviewVisible=false;scoresPageVisible=false;clubQuizView=null;
        findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.chipsScroll).setVisibility("home".equals(mode) ? View.VISIBLE : View.GONE);
        currentBottomTab="fixtures".equals(mode)?"Wedstrijden":"predictions".equals(mode)?"Voorspellen":"notifications".equals(mode)?"Meer":"Nieuws";buildNav();content.removeAllViews();
        if("predictions".equals(mode)){clubQuizView=new ClubQuizView(this,this::closeClubQuiz,true);content.addView(clubQuizView,new android.widget.FrameLayout.LayoutParams(-1,-1));}
        else content.addView("home".equals(mode)?new HomeMenu39(this,this::openDestination39,this::showEditorialArticle):new DestinationView39(this,mode,this::openDestination39,name->showPersonalHub("profile",name)),new android.widget.FrameLayout.LayoutParams(-1,-1));
    }
    private void showCompetition40(String name,String source){
 String[] names={"Eredivisie","Keuken Kampioen Divisie","Premier League","Bundesliga","La Liga","Serie A","Ligue 1","Champions League","Europa League","Conference League"};
 String[] keys={"eredivisie","kkd","premierleague","bundesliga","laliga","seriea","ligue1","championsleague","europaleague","conferenceleague"};
 for(int i=0;i<names.length;i++)if(names[i].equals(name)){showDestination39("competition:"+keys[i]);return;}
 }

    private void showMore() {
        enterScreen("more", this::showMore);
        personalHubVisible = false;
        eredivisieStatisticsVisible = false;
        weeklyPreviewVisible = false;
        findViewById(R.id.header).setVisibility(View.VISIBLE);
        findViewById(R.id.chipsScroll).setVisibility(View.GONE);
        currentBottomTab = "Meer";
        buildNav();
        content.removeAllViews();
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(C.BG);
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(dp(16), dp(16), dp(16), dp(26));
        list.addView(tv("Meer", 26, C.TEXT, true));
        list.addView(tv("Instellingen, informatie en extra onderdelen", 14, C.MUTED, false));
        moreSection(list, "Veldio");
        PremiumDesign40.menuRow(list, "Info", "Over Veldio", "Alles voetbal. Eén plek.", this::showAbout);
        PremiumDesign40.menuRow(list, "Clubquiz", "Voetbalquiz", "Kies uit zeven categorieën", this::showClubQuiz);
        PremiumDesign40.menuRow(list, "Contact", "Contact", "Neem contact op met de redactie", this::showContact);
        PremiumDesign40.menuRow(list, "Nieuws", "Nieuws vernieuwen", "Haal het laatste voetbalnieuws op", this::refreshNews);
        PremiumDesign40.menuRow(list, "Mijn Clubs", "Favorieten beheren", "Bekijk en wijzig je favoriete clubs", this::showFavorites);
        PremiumDesign40.menuRow(list, "Info", "Bronnen en beeldgebruik", "Herkomst van informatie en beelden", this::showLegalInfo);
        moreSection(list, "Instellingen");
        PremiumDesign40.menuRow(list, "Instellingen", "App-instellingen", "Open het Veldio-snelmenu", this::showSettings);
        PremiumDesign40.menuRow(list, "Meldingen", "Meldingen", "Bekijk de bestaande meldingsinstellingen", () -> showDestination39("notifications"));
        moreSection(list, "Juridisch");
        PremiumDesign40.menuRow(list, "Info", "Privacyverklaring", "Hoe Veldio met gegevens omgaat", () -> openExternal42("https://voetbalhub-redactie.onrender.com/privacy"));
        PremiumDesign40.menuRow(list, "Info", "Advertentieprivacy", "Informatie over advertenties en quizdeelname", () -> ads().privacy());
        scroll.addView(list);
        content.addView(scroll);
    }

    private void openExternal42(String url){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(android.content.ActivityNotFoundException e){android.widget.Toast.makeText(this,"Geen browser beschikbaar",android.widget.Toast.LENGTH_SHORT).show();}}

    private void moreSection(LinearLayout list, String title) {
        TextView heading = tv(title.toUpperCase(java.util.Locale.ROOT), 12, C.GREEN, true);
        heading.setPadding(dp(2), dp(20), 0, dp(8));
        list.addView(heading);
    }

    private void addActionRow(LinearLayout parent,String icon,String title,Runnable action) {
        LinearLayout row = new LinearLayout(this); row.setGravity(Gravity.CENTER_VERTICAL);row.setPadding(dp(14), dp(14), dp(14), dp(14));row.setBackground(cardBackground());
        row.addView(new NavIconView(this, icon, false), new LinearLayout.LayoutParams(dp(25),dp(25)));
        TextView name = tv(title, 14, C.TEXT, false);name.setPadding(dp(13),0,dp(8),0);row.addView(name,new LinearLayout.LayoutParams(0,-2,1));row.addView(tv("›",22,C.MUTED,false));row.setOnClickListener(v->action.run());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,0,0,dp(5));parent.addView(row,lp);
    }

    private void addSiteCard(LinearLayout list, String title, String subtitle, String url, String iconUrl) {
        LinearLayout card = new LinearLayout(this); card.setGravity(Gravity.CENTER_VERTICAL); card.setPadding(dp(14), dp(11), dp(14), dp(11)); card.setBackground(cardBackground());
        ImageView icon = new ImageView(this); icon.setScaleType(ImageView.ScaleType.FIT_CENTER); icon.setImageResource(R.drawable.veldio_logo);
        LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(dp(42), dp(42)); ip.setMargins(0, 0, dp(13), 0); card.addView(icon, ip);
        if (iconUrl != null) loadSiteIcon(icon, iconUrl);
        LinearLayout textBox = new LinearLayout(this); textBox.setOrientation(LinearLayout.VERTICAL);
        textBox.addView(tv(title, 15, C.TEXT, true)); TextView sub = tv(subtitle, 11, C.MUTED, false); sub.setPadding(0, dp(4), 0, 0); textBox.addView(sub);
        card.addView(textBox, new LinearLayout.LayoutParams(0, -2, 1)); card.addView(tv("›", 24, C.GREEN, true));
        card.setOnClickListener(v -> { if (url == null) showLegalInfo(); else if (url.startsWith("mailto:")) { try { startActivity(new Intent(Intent.ACTION_SENDTO, Uri.parse(url))); } catch (Exception ignored) {} } else openArticle(url, title); });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2); lp.setMargins(0, 0, 0, dp(10)); list.addView(card, lp);
    }

    private void loadSiteIcon(ImageView target, String iconUrl) {
        executor.execute(() -> { HttpURLConnection c = null; try { c = (HttpURLConnection) new URL(iconUrl).openConnection(); c.setConnectTimeout(5000); c.setReadTimeout(5000); c.setRequestProperty("User-Agent", "Mozilla/5.0 Veldio"); try (InputStream in = c.getInputStream()) { Bitmap bmp = BitmapFactory.decodeStream(in); if (bmp != null) main.post(() -> target.setImageBitmap(bmp)); } } catch (Exception ignored) {} finally { if (c != null) c.disconnect(); } });
    }

    private void showLegalInfo() {
        screenHistory.resetExit();
        PremiumDesign40.infoDialog(this, "Bronnen en beeldgebruik", null,
            new String[][] {
                {"Nieuws", "Eigen redactie en wedstrijddata", "Veldio publiceert eigen artikelen. De competitiepagina gebruikt Eredivisiegegevens en aanvullende wedstrijdgegevens."},
                {"Info", "Wedstrijdbeelden", "Veldio legt de herkomst en beeldverantwoording vast bij wedstrijdbeelden."},
                {"Info", "Onafhankelijke app", "Veldio is niet officieel verbonden aan de getoonde clubs of competities."}
            });
    }

    private void showAbout() {
        screenHistory.resetExit();
        PremiumDesign40.infoDialog(this, "Over Veldio", "Alles voetbal. Eén plek.",
            new String[][] {
                {"Nieuws", "Eigen voetbalnieuws", "Nieuws, clubquiz en De Derde Helft van Sander Brink."},
                {"Info", "Onafhankelijk platform", "Veldio is geen officiële partner van de genoemde competities."}
            });
    }

    private void showSearch() { showPersonalHub("search", ""); }

    private void search(String q) { showPersonalHub("search", q); }

    private void showSettings() {
        screenHistory.resetExit();
        Dialog dialog = new Dialog(this);
        LinearLayout panel = PremiumDesign40.dialogPanel(this, "Veldio-snelmenu", "Snel naar belangrijke opties");
        PremiumDesign40.menuRow(panel, "Nieuws", "Nieuws vernieuwen", "Haal het laatste voetbalnieuws op", () -> { dialog.dismiss(); refreshNews(); });
        PremiumDesign40.menuRow(panel, "Mijn Clubs", "Favorieten beheren", "Beheer je favoriete clubs", () -> { dialog.dismiss(); showFavorites(); });
        PremiumDesign40.menuRow(panel, "Info", "Bronnen bekijken", "Herkomst van informatie en beelden", () -> { dialog.dismiss(); showLegalInfo(); });
        PremiumDesign40.menuRow(panel, "Info", "Over Veldio", "Lees meer over Veldio", () -> { dialog.dismiss(); showAbout(); });
        PremiumDesign40.showDialog(dialog, panel);
    }

    private void openUrl(String url) { if (url == null || url.isEmpty()) return; openArticle(url, "Veldio"); }



    


@Override
    public void onBackPressed() {
        if(videoShelf40!=null&&videoShelf40.closeVideo())return;
        if(clubQuizView!=null&&clubQuizView.back())return;
        if(editorialDialog!=null&&editorialDialog.isShowing()){screenHistory.resetExit();closeEditorialArticle();return;}
        if(articleDialog!=null&&articleDialog.isShowing()){screenHistory.resetExit();if(activeWebView!=null&&activeWebView.canGoBack())activeWebView.goBack();else closeArticleView();return;}
        if(homeFeature!=null&&homeFeature.closeVideo()){screenHistory.resetExit();return;}
        if(personalHubVisible&&personalHub!=null&&personalHub.handleBack()){screenHistory.resetExit();return;}
        if(eredivisieStatisticsVisible&&statisticsView!=null&&statisticsView.handleBack()){screenHistory.resetExit();return;}
        if(previousScreen())return;
        if(screenHistory.confirmExit(android.os.SystemClock.elapsedRealtime())){
            if(exitDialog!=null&&exitDialog.isShowing())return;
            exitDialog=new AlertDialog.Builder(this).setTitle("Veldio afsluiten?")
                .setMessage("Wil je de app afsluiten?").setNegativeButton("Annuleren",(d,w)->screenHistory.resetExit())
                .setPositiveButton("Afsluiten",(d,w)->finish()).create();
            exitDialog.setOnCancelListener(d->screenHistory.resetExit());exitDialog.show();
        }
    }



    @Override protected void onDestroy() {
        if(videoShelf40!=null)videoShelf40.closeVideo();
        if(homeFeature!=null)homeFeature.closeVideo();
        if(newsNotifications39!=null)newsNotifications39.dispose();
        if(veldioAds!=null)veldioAds.dispose();
        main.removeCallbacks(periodicRefresh);

        executor.shutdownNow();
        
        super.onDestroy();
    }

    private static final class C {
        static final int GREEN = PremiumDesign40.GREEN;
        static final int TEXT = PremiumDesign40.WHITE;
        static final int MUTED = PremiumDesign40.MUTED;
        static final int BG = PremiumDesign40.INK;
        static final int CARD = PremiumDesign40.SURFACE;
        static final int BORDER = PremiumDesign40.EDGE;
        static final int IMAGE_PLACEHOLDER = 0xFF17211C;
    }

    @Override protected void onPause() {
        if(videoShelf40!=null)videoShelf40.pauseVideo();
        if(veldioAds!=null)veldioAds.pause();
        screenHistory.resetExit();
        if (homeFeature != null) homeFeature.pauseVideo();
        
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if(videoShelf40!=null)videoShelf40.resumeVideo();
        if(homeFeature!=null)homeFeature.resumeVideo();
        ads().resume();
        
    }

}
