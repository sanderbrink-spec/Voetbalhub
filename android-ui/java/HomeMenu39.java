package nl.voetbalhub.app;

import android.app.Activity;
import android.content.res.ColorStateList;
import android.graphics.*;
import android.graphics.drawable.*;
import android.view.*;
import android.widget.*;

/** Native launcher: stable TalkBack nodes on every visit, using the shared vector set. */
public final class HomeMenu39 extends ScrollView {
 private static final String[][] ITEMS={{"news","Nieuws"},{"fixtures","Wedstrijden"},{"competitions","Competities"},{"predictions","Voorspellen"},{"quiz","Club Quiz"},{"stadium","Stadion van de Week"},{"column","De Derde Helft"},{"videos","Video's"},{"standings","Standen"},{"clubs","Clubs"},{"favorites","Favorieten"},{"notifications","Meldingen"}};
 private int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
 private TextView text(Activity a,String value,int size,int color){TextView v=new TextView(a);v.setText(value);v.setTextSize(size);v.setTextColor(color);v.setTypeface(null,Typeface.BOLD);return v;}
 private GradientDrawable panel(){GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xFF142619,0xFF060D09});d.setCornerRadius(dp(15));d.setStroke(dp(1),0xFF3B573B);return d;}
 public HomeMenu39(Activity a,DestinationView39.Route route){
  super(a);setFillViewport(true);setBackgroundColor(0xFF050B08);setClipToPadding(false);
  LinearLayout page=new LinearLayout(a);page.setOrientation(LinearLayout.VERTICAL);page.setPadding(dp(12),dp(14),dp(12),dp(26));addView(page,new LayoutParams(-1,-2));
  FrameLayout hero=new FrameLayout(a);hero.setBackground(panel());hero.setClipToOutline(true);
  Bitmap arena=CompetitionTile.artwork(a);if(arena!=null){ImageView photo=new ImageView(a);photo.setImageBitmap(arena);photo.setScaleType(ImageView.ScaleType.CENTER_CROP);photo.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);hero.addView(photo,new FrameLayout.LayoutParams(-1,-1));}
  View shade=new View(a);shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,new int[]{0xF5031209,0x55031209}));hero.addView(shade,new FrameLayout.LayoutParams(-1,-1));
  LinearLayout copy=new LinearLayout(a);copy.setOrientation(LinearLayout.VERTICAL);copy.setPadding(dp(18),dp(18),dp(18),dp(18));TextView eyebrow=text(a,"MIJN VELDIO",10,0xFFB7FF39);eyebrow.setLetterSpacing(.18f);copy.addView(eyebrow);
  TextView title=text(a,"Alles voetbal.\nEén plek.",25,0xFFF2F6F3);title.setPadding(0,dp(4),0,dp(6));copy.addView(title);TextView sub=text(a,"Kies jouw onderdeel.",13,0xFFD8E7DA);sub.setTypeface(null,Typeface.NORMAL);copy.addView(sub);hero.addView(copy,new FrameLayout.LayoutParams(-1,-2));page.addView(hero,new LinearLayout.LayoutParams(-1,dp(Math.max(164,164+(getResources().getConfiguration().fontScale-1)*90))));
  // Fixed three columns with scalable row height. Small screens can scroll all four rows.
  float scale=getResources().getConfiguration().fontScale;int height=dp(Math.max(107,107+(scale-1)*60));
  for(int row=0;row<4;row++){LinearLayout line=new LinearLayout(a);LinearLayout.LayoutParams rowLp=new LinearLayout.LayoutParams(-1,height);rowLp.topMargin=dp(row==0?14:9);page.addView(line,rowLp);
   for(int col=0;col<3;col++){final String[] item=ITEMS[row*3+col];LinearLayout tile=new LinearLayout(a);tile.setOrientation(LinearLayout.VERTICAL);tile.setGravity(Gravity.CENTER);tile.setPadding(dp(4),dp(10),dp(4),dp(10));tile.setBackground(panel());tile.setClipToOutline(true);tile.setElevation(dp(2));tile.setFocusable(true);tile.setClickable(true);tile.setContentDescription(item[1]);tile.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);tile.setAccessibilityDelegate(new View.AccessibilityDelegate(){@Override public void onInitializeAccessibilityNodeInfo(View v,android.view.accessibility.AccessibilityNodeInfo info){super.onInitializeAccessibilityNodeInfo(v,info);info.setClassName(Button.class.getName());}});
    tile.setForeground(new RippleDrawable(ColorStateList.valueOf(0x44B7FF39),null,new ColorDrawable(Color.WHITE)));tile.addView(new NavIconView(a,item[1],true),new LinearLayout.LayoutParams(dp(34),dp(34)));TextView label=text(a,item[1],12,0xFFF2F6F3);label.setGravity(Gravity.CENTER);label.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);LinearLayout.LayoutParams labelLp=new LinearLayout.LayoutParams(-1,-2);labelLp.topMargin=dp(9);tile.addView(label,labelLp);tile.setOnClickListener(v->route.open(item[0]));LinearLayout.LayoutParams cell=new LinearLayout.LayoutParams(0,-1,1);if(col>0)cell.leftMargin=dp(9);line.addView(tile,cell);
   }
  }
 }
}
