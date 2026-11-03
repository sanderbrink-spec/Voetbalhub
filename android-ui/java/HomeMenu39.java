package nl.voetbalhub.app;
import android.app.Activity;
import android.graphics.*;
import android.view.*;
import android.widget.*;
/** One launcher with the approved carousel geometry and twelve stable native routes. */
public final class HomeMenu39 extends ScrollView {
 private static final String[][] ITEMS={{"news","Nieuws"},{"fixtures","Wedstrijden"},{"competitions","Competities"},{"predictions","Voorspellen"},{"quiz","Club Quiz"},{"stadium","Stadion van de Week"},{"column","De Derde Helft"},{"videos","Samenvattingen"},{"standings","Standen"},{"favorites","Favorieten"},{"myclub","Mijn Club"},{"more","Meer"}};
 private int dp(float n){return PremiumDesign40.dp(getContext(),n);}
 public HomeMenu39(Activity a,DestinationView39.Route route,HomeFeatureView.OpenArticle open){super(a);setFillViewport(true);setBackgroundColor(PremiumDesign40.INK);setClipToPadding(false);
  LinearLayout page=new LinearLayout(a);page.setOrientation(1);page.setPadding(dp(10),dp(8),dp(10),dp(28));addView(page,new LayoutParams(-1,-2));
  float heroHeight=Math.min(390,Math.max(245,getResources().getDisplayMetrics().widthPixels/getResources().getDisplayMetrics().density*.62f))+Math.max(0,getResources().getConfiguration().fontScale-1)*180;
  page.addView(new HomeSlideshow40(a,open,()->route.open("news")),new LinearLayout.LayoutParams(-1,dp(heroHeight)));

  TextView title=PremiumDesign40.text(a,"Mijn Veldio",25,PremiumDesign40.WHITE,true);title.setTypeface(null,Typeface.BOLD_ITALIC);title.setPadding(dp(3),dp(20),0,dp(14));page.addView(title);
  float scale=getResources().getConfiguration().fontScale;int height=dp(126+Math.max(0,scale-1)*70);
  for(int r=0;r<4;r++){LinearLayout line=new LinearLayout(a);LinearLayout.LayoutParams row=new LinearLayout.LayoutParams(-1,height);row.topMargin=dp(9);page.addView(line,row);
   for(int col=0;col<3;col++){final String[] item=ITEMS[r*3+col];FrameLayout tile=new FrameLayout(a);PremiumDesign40.card(tile,PremiumDesign40.EDGE);PremiumDesign40.touch(tile);tile.setContentDescription("Menu: "+item[1]);tile.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);tile.setAccessibilityDelegate(new View.AccessibilityDelegate(){public void onInitializeAccessibilityNodeInfo(View v,android.view.accessibility.AccessibilityNodeInfo n){super.onInitializeAccessibilityNodeInfo(v,n);n.setClassName(Button.class.getName());}});
    ImageView art=new ImageView(a);art.setScaleType(ImageView.ScaleType.CENTER_CROP);art.setImageBitmap(PremiumDesign40.artwork(a,item[0]));art.setImportantForAccessibility(2);tile.addView(art,new FrameLayout.LayoutParams(-1,-1));
    TextView label=PremiumDesign40.text(a,item[1],12,PremiumDesign40.WHITE,true);label.setGravity(Gravity.CENTER);label.setPadding(dp(3),dp(6),dp(3),dp(9));label.setMinHeight(dp(40));label.setImportantForAccessibility(2);label.setBackground(new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0x00020805,0xF5020805}));tile.addView(label,new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));tile.setOnClickListener(v->route.open(item[0]));LinearLayout.LayoutParams cell=new LinearLayout.LayoutParams(0,-1,1);if(col>0)cell.leftMargin=dp(8);line.addView(tile,cell);
   }
  }
 }
}
