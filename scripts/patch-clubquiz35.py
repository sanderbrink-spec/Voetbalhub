"""Separate club quiz in Meer. Preserve the approved homepage byte for byte."""
from pathlib import Path
import shutil
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java')
s=p.read_text()
anchor='    private void showMore() {'
assert s.count(anchor)==1
s=s.replace(anchor,'''    private ClubQuizView clubQuizView;
    private void closeClubQuiz(){clubQuizView=null;onBackPressed();}
    private void showClubQuiz() {
        enterScreen("clubquiz",this::showClubQuiz);
        personalHubVisible=false; personalHub=null; eredivisieStatisticsVisible=false; weeklyPreviewVisible=false;
        findViewById(R.id.header).setVisibility(android.view.View.VISIBLE);
        findViewById(R.id.chipsScroll).setVisibility(android.view.View.GONE);
        content.removeAllViews();clubQuizView=new ClubQuizView(this,this::closeClubQuiz);content.addView(clubQuizView,new android.widget.FrameLayout.LayoutParams(-1,-1));
    }
'''+anchor)
anchor='        addActionRow(list, "Stadions", "Stadion van de week", ()->showStadiums(""));'
assert s.count(anchor)==1
s=s.replace(anchor,anchor+'\n        addActionRow(list, "Clubquiz", "Speel de clubquiz", this::showClubQuiz);')
s=s.replace('public void onBackPressed() {','public void onBackPressed() {\n        if(clubQuizView!=null&&clubQuizView.back())return;',1)
p.write_text(s)
shutil.copyfile('android-ui/java/ClubQuizView.java',p.parent/'ClubQuizView.java')
for name in ['clubquiz.html','clubquiz-engine.js','clubquiz-bank.js','clubquiz-ui.js']:
 shutil.copyfile('android-ui/assets/'+name,Path('app/src/main/assets')/name)
print('Separate offline Clubquiz installed under Meer')
