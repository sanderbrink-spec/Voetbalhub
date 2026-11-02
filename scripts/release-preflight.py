"""Read-only configuration gate. Account, signing and device evidence are separate."""
from pathlib import Path
import re

def settings_issues(source):
    errors=[]
    for name,value in {'TEST_MODE':False,'AUDIENCE_CONFIRMED':True,'PRODUCTION_APPROVED':True,'ACCOUNT_VERIFIED':True}.items():
        values=re.findall(r'\b'+name+r'\s*=\s*(true|false)\s*;',source)
        if values != ['true' if value else 'false']:errors.append(name+' is niet productiegeschikt')
    ids={name:re.findall(r'\b'+name+r'\s*=\s*"([^"]+)"',source) for name in ['APP_ID','HOME_UNIT','READER_UNIT']}
    if any(len(values)!=1 for values in ids.values()):return errors+['Advertentie-identificaties ontbreken of zijn dubbel']
    app,home,reader=(ids[name][0] for name in ['APP_ID','HOME_UNIT','READER_UNIT'])
    if not re.fullmatch(r'ca-app-pub-\d{16}~\d{10}',app) or any(not re.fullmatch(r'ca-app-pub-\d{16}/\d{10}',x) for x in [home,reader]):
        errors.append('Ongeldige advertentie-identificaties')
    elif any(x[:27]!=app[:27] for x in [home,reader]):errors.append('Advertenties gebruiken verschillende uitgevers')
    if any('3940256099942544' in x for x in [app,home,reader]):errors.append('Officiële testidentificaties zijn nog aanwezig')
    if home==reader:errors.append('Twee afzonderlijke productie-bannerunits zijn vereist')
    return errors

def main():
    source=Path('android-ui/java/AdSettings.java').read_text()
    errors=settings_issues(source)
    prepared=Path('app/src/main/java/nl/voetbalhub/app/AdSettings.java')
    if not prepared.exists() or prepared.read_text()!=source:errors.append('Voorbereide Android-configuratie ontbreekt of wijkt af')
    if errors:raise SystemExit('Release geblokkeerd: '+'; '.join(errors)+'. Geen productie-AAB vrijgegeven.')
    print('Advertentieconfiguratie gecontroleerd; account, CMP, signing en toestelbewijs blijven afzonderlijk vereist.')

if __name__=='__main__':main()
