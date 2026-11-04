package nl.voetbalhub.app;

import android.app.Activity;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Shared editorial presentation, independent of navigation and stored article data. */
public final class VeldioEditorial {
    public static final int LIME=0xFFA9FF35, INK=0xFF050A07, SILVER=0xFFECF4EF, MUTED=0xFFA4B5AA;
    private static int dp(Activity a,int n){return (int)(n*a.getResources().getDisplayMetrics().density+.5f);}
    private static TextView text(Activity a,String value,int size,int color,boolean bold){TextView t=new TextView(a);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setIncludeFontPadding(false);if(bold)t.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));return t;}
    private static GradientDrawable surface(Activity a,int fill,int stroke,int radius){GradientDrawable d=new GradientDrawable();d.setColor(fill);d.setCornerRadius(dp(a,radius));d.setStroke(dp(a,1),stroke);return d;}
    public static View readerHeader(Activity a,boolean column,Runnable back){
        LinearLayout frame=new LinearLayout(a);frame.setOrientation(LinearLayout.VERTICAL);frame.setBackgroundColor(INK);
        LinearLayout row=new LinearLayout(a);row.setGravity(Gravity.CENTER_VERTICAL);row.setPadding(dp(a,16),dp(a,10),dp(a,12),dp(a,10));
        ImageView logo=new ImageView(a);logo.setImageResource(R.drawable.veldio_logo);logo.setScaleType(ImageView.ScaleType.FIT_CENTER);logo.setContentDescription("Veldio");row.addView(logo,new LinearLayout.LayoutParams(dp(a,40),dp(a,40)));
        LinearLayout identity=new LinearLayout(a);identity.setOrientation(LinearLayout.VERTICAL);identity.setPadding(dp(a,10),0,0,0);identity.addView(text(a,"Veldio",21,SILVER,true));
        TextView label=text(a,column?"DE DERDE HELFT":"VOETBALNIEUWS",9,LIME,true);label.setLetterSpacing(.13f);label.setPadding(0,dp(a,3),0,0);identity.addView(label);row.addView(identity,new LinearLayout.LayoutParams(0,-2,1));
        TextView close=text(a,"‹  Terug",12,SILVER,true);close.setGravity(Gravity.CENTER);close.setPadding(dp(a,12),0,dp(a,12),0);close.setBackground(surface(a,0xFF101B14,0xFF294633,14));close.setOnClickListener(v->back.run());close.setFocusable(true);close.setContentDescription("Terug naar de vorige pagina");row.addView(close,new LinearLayout.LayoutParams(-2,dp(a,42)));frame.addView(row);
        View line=new View(a);line.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,new int[]{LIME,0xFF17D669,0x00050A07}));frame.addView(line,new LinearLayout.LayoutParams(-1,dp(a,1)));return frame;
    }
    public static View columnHeader(Activity a,Runnable back){
        LinearLayout row=new LinearLayout(a);row.setGravity(Gravity.CENTER_VERTICAL);row.setPadding(dp(a,16),dp(a,7),dp(a,12),dp(a,7));
        TextView label=text(a,"VELDIO / DE COLUMN",11,LIME,true);label.setLetterSpacing(.12f);row.addView(label,new LinearLayout.LayoutParams(0,-2,1));
        TextView close=text(a,"‹  Terug",12,MUTED,true);close.setGravity(Gravity.CENTER);close.setPadding(dp(a,12),0,dp(a,12),0);close.setOnClickListener(v->back.run());close.setFocusable(true);row.addView(close,new LinearLayout.LayoutParams(-2,dp(a,36)));return row;
    }
    public static TextView category(Activity a,String label){TextView t=text(a,label,10,LIME,true);t.setLetterSpacing(.09f);t.setPadding(dp(a,10),dp(a,6),dp(a,10),dp(a,6));t.setBackground(surface(a,0xFF142619,0xFF2E4930,8));return t;}
    public static void styleTools(Activity a,LinearLayout tools){
        tools.setBackground(surface(a,0xFF0D1711,0xFF223A2B,13));tools.setPadding(dp(a,10),dp(a,2),dp(a,6),dp(a,2));
        for(int i=0;i<tools.getChildCount();i++)if(tools.getChildAt(i) instanceof TextView){TextView t=(TextView)tools.getChildAt(i);t.setTextColor(i==0?LIME:SILVER);if(i==0)t.setTextSize(12);}
    }
    public static TextView artwork(Activity a){TextView t=text(a,"Veldio\nAlles voetbal. Eén plek.",17,SILVER,true);t.setGravity(Gravity.CENTER);return t;}
    public static void styleArtwork(Activity a,TextView view){
        view.setBackground(surface(a,0xFF102319,0xFF2B4932,15));android.graphics.drawable.Drawable logo=a.getDrawable(R.drawable.veldio_logo);if(logo!=null){logo.setBounds(0,0,dp(a,56),dp(a,56));view.setCompoundDrawables(null,logo,null,null);view.setCompoundDrawablePadding(dp(a,6));}
    }
    public static void styleCover(Activity a,ImageView cover){cover.setBackground(surface(a,0xFF0D1711,0xFF294231,14));cover.setClipToOutline(true);}
    public static TextView footer(Activity a){TextView t=text(a,"VELDIO  /  Alles voetbal. Eén plek.",10,MUTED,true);t.setLetterSpacing(.05f);t.setPadding(0,dp(a,3),0,dp(a,6));return t;}
}
