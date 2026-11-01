package nl.voetbalhub.app;
import android.app.Activity;
import android.view.View;
import android.widget.*;
import org.json.*;
import java.util.*;

/** Updates the article rows in place, without rebuilding the screen or carousel. */
public final class FeedPanel extends LinearLayout implements FeedRepository.Listener {
 private final Activity activity;private final LinearLayout rows;private final TextView status;private final ProgressBar spinner;private final HomeFeatureView.OpenArticle open;private final String category;private final boolean column;
 private Button retry;
 private String rendered="";private boolean attached;
 private final Runnable poll=new Runnable(){public void run(){if(!attached||getWindowVisibility()!=VISIBLE)return;FeedRepository.refresh(false);postDelayed(this,60000);}};
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 public FeedPanel(Activity a,String category,boolean column,HomeFeatureView.OpenArticle open){
  super(a);activity=a;this.category=category;this.column=column;this.open=open;setOrientation(VERTICAL);
  LinearLayout bar=new LinearLayout(a);bar.setGravity(android.view.Gravity.CENTER_VERTICAL);bar.setPadding(dp(10),dp(6),dp(10),dp(6));
  status=new TextView(a);status.setTextSize(11);status.setTextColor(0xFFB5C9BB);bar.addView(status,new LayoutParams(0,-2,1));
  spinner=new ProgressBar(a);spinner.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(0xFF25F06B));bar.addView(spinner,new LayoutParams(dp(20),dp(20)));
  retry=new Button(a);retry.setText("Verversen");retry.setTextSize(11);retry.setTextColor(0xFF25F06B);retry.setBackgroundColor(android.graphics.Color.TRANSPARENT);retry.setOnClickListener(v->FeedRepository.refresh(true));bar.addView(retry,new LayoutParams(-2,dp(44)));addView(bar);
  rows=new LinearLayout(a);rows.setOrientation(VERTICAL);addView(rows);
 }
 @Override protected void onAttachedToWindow(){super.onAttachedToWindow();attached=true;FeedRepository.subscribe(activity,this);removeCallbacks(poll);post(poll);}
 @Override protected void onDetachedFromWindow(){attached=false;removeCallbacks(poll);FeedRepository.unsubscribe(this);super.onDetachedFromWindow();}
 @Override protected void onWindowVisibilityChanged(int visibility){super.onWindowVisibilityChanged(visibility);if(attached){removeCallbacks(poll);if(visibility==VISIBLE)post(poll);}}
 public void changed(JSONObject data,boolean loading,boolean failed){
  retry.setText(failed?"Opnieuw proberen":"Verversen");retry.setEnabled(!loading);spinner.setVisibility(loading?VISIBLE:GONE);status.setText(failed?"Verbinding mislukt. Opgeslagen nieuws blijft zichtbaar.":loading?"Nieuws bijwerken…":(activity.getSharedPreferences("voetbalhub_editorial",0).getLong("last_fetch_at",0)==0?"Opgeslagen selectie · trek omlaag om te vernieuwen":"Nieuws bijgewerkt · trek omlaag om te vernieuwen"));
  if(data==null||data.optJSONArray("articles")==null)return;String fingerprint=data.optJSONArray("articles").toString();if(fingerprint.equals(rendered))return;rendered=fingerprint;
  ScrollView scroll=null;android.view.ViewParent p=getParent();while(p instanceof View){if(p instanceof ScrollView){scroll=(ScrollView)p;break;}p=p.getParent();}final ScrollView sc=scroll;
  String anchor=null;int offset=0;if(sc!=null&&sc.getScrollY()>0)for(int i=0;i<rows.getChildCount();i++){View child=rows.getChildAt(i);int[] pos=new int[2],sp=new int[2];child.getLocationOnScreen(pos);sc.getLocationOnScreen(sp);if(pos[1]+child.getHeight()>sp[1]&&pos[1]<sp[1]+sc.getHeight()){anchor=String.valueOf(child.getTag());offset=pos[1]-sp[1];break;}}
  rows.removeAllViews();JSONArray list=data.optJSONArray("articles");ArrayList<JSONObject> sorted=new ArrayList<>();for(int i=0;i<list.length();i++){JSONObject row=list.optJSONObject(i);if(row!=null)sorted.add(row);}sorted.sort((x,y)->y.optString("publishedAt").compareTo(x.optString("publishedAt")));HashSet<String> ids=new HashSet<>(),headlines=new HashSet<>();
  for(JSONObject row:sorted){boolean isColumn="column".equalsIgnoreCase(row.optString("type"))||"column".equalsIgnoreCase(row.optString("category"))||"de derde helft".equalsIgnoreCase(row.optString("category"));if(column!=isColumn||!ids.add(row.optString("id"))||!headlines.add(row.optString("headline").trim().toLowerCase(Locale.ROOT)))continue;
   String cat=row.optString("category").toLowerCase(Locale.ROOT),title=row.optString("headline").toLowerCase(Locale.ROOT);if(!column&&"Transfers".equals(category)&&!cat.contains("transfer")&&!title.matches(".*(transfer|contract|versterking|vertrek).*"))continue;
   if(!column&&"Eredivisie".equals(category)&&!cat.contains("eredivisie"))continue;
   if(!column&&"Buitenland".equals(category)&&!cat.matches(".*(buitenland|premier league|bundesliga|serie a|la liga|champions|europa|conference).*"))continue;
   NewsListCard card=new NewsListCard(activity,row,()->open.open(row));card.setTag(row.optString("id"));LayoutParams lp=new LayoutParams(-1,-2);lp.setMargins(dp(6),dp(4),dp(6),dp(5));rows.addView(card,lp);
  }
  if(rows.getChildCount()==0){TextView empty=new TextView(activity);empty.setText("Er zijn nog geen berichten in deze rubriek.");empty.setTextColor(0xFFB5C9BB);empty.setPadding(dp(12),dp(12),dp(12),dp(12));rows.addView(empty);}
  final String keep=anchor;final int dy=offset;if(sc!=null&&keep!=null)rows.post(()->{for(int i=0;i<rows.getChildCount();i++){View child=rows.getChildAt(i);if(keep.equals(child.getTag())){int[] cp=new int[2],sp=new int[2];child.getLocationOnScreen(cp);sc.getLocationOnScreen(sp);sc.scrollBy(0,cp[1]-sp[1]-dy);break;}}});
 }
}
