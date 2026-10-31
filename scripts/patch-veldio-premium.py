"""Final Veldio presentation patch. Does not change data, routing or callbacks."""
from pathlib import Path
import shutil
p=Path('app/src/main/java/nl/voetbalhub/app/MainActivity.java');s=p.read_text()
anchor='View header = findViewById(R.id.header);';assert s.count(anchor)==1;s=s.replace(anchor,anchor+'\n        VeldioChrome.install(this);',1)
anchor='b.setBackground(ContextCompat.getDrawable(this, label.equals(active) ? R.drawable.rounded_active : R.drawable.rounded_chip));';assert s.count(anchor)==1;s=s.replace(anchor,anchor+'\n            VeldioChrome.chip(this,b,label,label.equals(active));',1)
# Keep the existing navigation route callbacks and labels exactly as they are.
anchor='nav.addView(box, new LinearLayout.LayoutParams(0, -1, 1));';assert s.count(anchor)==1;s=s.replace(anchor,'VeldioChrome.navigation(this,box,page.equals(currentBottomTab));\n            '+anchor,1)
s=s.replace('new LinearLayout.LayoutParams(-2, dp(34))','new LinearLayout.LayoutParams(-2, dp(38))')
p.write_text(s);shutil.copyfile('android-ui/java/VeldioChrome.java',p.parent/'VeldioChrome.java')
gradle=Path('app/build.gradle.kts');g=gradle.read_text().replace('versionCode = 57','versionCode = 58').replace('versionName = "4.25-veldio"','versionName = "4.26-veldio"');gradle.write_text(g)
print('Installed Veldio stadium linework, prominent logo and accessible navigation; exact source portrait retained.')
