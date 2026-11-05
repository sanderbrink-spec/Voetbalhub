package nl.voetbalhub.app;
import android.app.Activity;
import android.graphics.*;
import android.view.*;
import android.widget.*;
/** One launcher with the approved carousel geometry and stable native routes. */
public final class HomeMenu39 extends ScrollView {
 private static final String[][] ITEMS={{"column","De Derde Helft"},{"stadium","Stadion van de Week"},{"videos","Samenvattingen"},{"competitions","Competities"},{"standings","Standen"},{"clubs","Clubgids"}};
 private int dp(float n){return PremiumDesign40.dp(getContext(),n);}
 public HomeMenu39(Activity a,DestinationView39.Route route,HomeFeatureView.OpenArticle open){super(a);setFillViewport(true);setBackgroundColor(PremiumDesign40.INK);setClipToPadding(false);
  LinearLayout page=new LinearLayout(a);page.setOrientation(1);page.setPadding(dp(10),dp(8),dp(10),dp(28));addView(page,new LayoutParams(-1,-2));
  float heroHeight=Math.min(390,Math.max(245,getResources().getDisplayMetrics().widthPixels/getResources().getDisplayMetrics().density*.62f))+Math.max(0,getResources().getConfiguration().fontScale-1)*180;
  page.addView(new HomeSlideshow40(a,open,()->route.open("news")),new LinearLayout.LayoutParams(-1,dp(heroHeight)));

  LinearLayout shortcuts=new LinearLayout(a);page.addView(shortcuts,new LinearLayout.LayoutParams(-1,-2));
  for(String[] item:new String[][]{{"fixtures","Wedstrijden"},{"predictions","Voorspellen"},{"quiz","Quiz"},{"news","Nieuws"}}){LinearLayout cell=new LinearLayout(a);cell.setOrientation(1);cell.setGravity(Gravity.CENTER);cell.setPadding(dp(2),dp(12),dp(2),dp(12));PremiumDesign40.card(cell,PremiumDesign40.EDGE);NavIconView icon=new NavIconView(a,"Quiz".equals(item[1])?"Club Quiz":item[1],true);cell.addView(icon,new LinearLayout.LayoutParams(dp(28),dp(28)));TextView text=PremiumDesign40.text(a,item[1],11,PremiumDesign40.WHITE,true);text.setGravity(Gravity.CENTER);cell.addView(text);cell.setContentDescription("Menu: "+item[1]);cell.setOnClickListener(v->route.open(item[0]));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(80),1);lp.setMargins(dp(3),dp(12),dp(3),dp(8));shortcuts.addView(cell,lp);}
  page.addView(new MatchStrip40(a,()->route.open("fixtures")),new LinearLayout.LayoutParams(-1,-2));
  TextView title=PremiumDesign40.text(a,"Meer onderdelen ▾",18,PremiumDesign40.WHITE,true);title.setTypeface(null,Typeface.BOLD_ITALIC);title.setPadding(dp(3),dp(20),0,dp(14));page.addView(title);
  LinearLayout secondary=new LinearLayout(a);secondary.setOrientation(1);secondary.setVisibility(GONE);page.addView(secondary,new LinearLayout.LayoutParams(-1,-2));title.setMinHeight(dp(48));title.setFocusable(true);title.setContentDescription("Meer Veldio-onderdelen tonen");title.setOnClickListener(v->{boolean expanded=secondary.getVisibility()==VISIBLE;secondary.setVisibility(expanded?GONE:VISIBLE);title.setText(expanded?"Meer onderdelen ▾":"Minder onderdelen ▴");title.setContentDescription(expanded?"Meer Veldio-onderdelen tonen":"Overige Veldio-onderdelen verbergen");});
  float scale=getResources().getConfiguration().fontScale;int height=dp(126+Math.max(0,scale-1)*70);
  for(int r=0;r<ITEMS.length/3;r++){LinearLayout line=new LinearLayout(a);LinearLayout.LayoutParams row=new LinearLayout.LayoutParams(-1,height);row.topMargin=dp(9);secondary.addView(line,row);
   for(int col=0;col<3;col++){final String[] item=ITEMS[r*3+col];FrameLayout tile=new FrameLayout(a);PremiumDesign40.card(tile,PremiumDesign40.EDGE);PremiumDesign40.touch(tile);tile.setContentDescription("Menu: "+item[1]);tile.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);tile.setAccessibilityDelegate(new View.AccessibilityDelegate(){public void onInitializeAccessibilityNodeInfo(View v,android.view.accessibility.AccessibilityNodeInfo n){super.onInitializeAccessibilityNodeInfo(v,n);n.setClassName(Button.class.getName());}});
    ImageView art=new ImageView(a);art.setScaleType(ImageView.ScaleType.CENTER_CROP);art.setImageBitmap(PremiumDesign40.artwork(a,item[0]));art.setImportantForAccessibility(2);tile.addView(art,new FrameLayout.LayoutParams(-1,-1));
    TextView label=PremiumDesign40.text(a,item[1],12,PremiumDesign40.WHITE,true);label.setGravity(Gravity.CENTER);label.setPadding(dp(3),dp(6),dp(3),dp(9));label.setMinHeight(dp(40));label.setImportantForAccessibility(2);label.setBackground(new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0x00020805,0xF5020805}));tile.addView(label,new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));tile.setOnClickListener(v->route.open(item[0]));LinearLayout.LayoutParams cell=new LinearLayout.LayoutParams(0,-1,1);if(col>0)cell.leftMargin=dp(8);line.addView(tile,cell);
   }
  }
 }
}
