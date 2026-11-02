from pathlib import Path
icons={
'news':'M5 3H19V21H5Z M8 6H16V10H8Z M8 13H16 M8 16H16 M8 19H13 M2 6V19Q2 21 5 21',
'fixtures':'M4 5H20V21H4Z M4 10H20 M8 2V7 M16 2V7 M8 14H9 M12 14H13 M16 14H17 M8 18H9 M12 18H13',
'competitions':'M7 3H17V9Q17 15 12 15Q7 15 7 9Z M7 5H3V8Q3 12 8 12 M17 5H21V8Q21 12 16 12 M12 15V20 M8 21H16',
'predictions':'M13 4A8 8 0 1 0 20 13 M11 8L14 10L13 14H9L8 10Z M8 10L5 8 M9 14L7 18 M13 14L16 17 M15 6L19 2 M16 2H20V6',
'quiz':'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3 M9 9Q9 6 12 6Q15 6 15 9Q15 11 12 12V14 M12 17H12.01',
'stadium':'M2 10Q12 2 22 10V17Q12 23 2 17Z M2 10Q12 16 22 10 M7 13V20 M17 13V20 M3 7V3 M21 7V3 M8 7V4 M16 7V4 M9 16H15V19H9Z',
'column':'M13 4H4V21H20V12 M8 8H11 M8 12H10 M8 17H13 M13 13L14 9L20 3L23 6L17 12Z M18 5L21 8',
'videos':'M3 5H21V19H3Z M10 8L16 12L10 16Z',
'standings':'M3 21H22 M5 17H8V21H5Z M11 11H14V21H11Z M17 4H20V21H17Z M4 10L10 6L14 8L20 2',
'clubs':'M8 3Q12 6 16 3L22 7L19 12L17 11V21H7V11L5 12L2 7Z M10 9H14',
'favorites':'M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8Z',
'notifications':'M5 17H19L17 14V9Q17 4 12 4Q7 4 7 9V14Z M10 20Q12 23 14 20 M12 2V4',
'home':'M2 11L12 3L22 11 M5 9V21H19V9 M10 21V15H14V21',
}
root=Path('android-ui/assets/icons')
for key,d in icons.items():
 root.joinpath(key+'.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#b7ff39" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg>')
import json
Path('android-ui/assets/icons/manifest.json').write_text(json.dumps({'author':'Veldio','rights':'Original vector path artwork created for Veldio','viewBox':'0 0 24 24','strokeWidth':1.65,'icons':icons},indent=2))
