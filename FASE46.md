# Veldio fase 46

Basis: geteste premium commit e78ecf37061bb8403e1635c2268b632774f439e5 (fase 45). Herstelpunt: backup/veldio-46-base-e78ecf37. Vier geslaagde fase45-workflows, inclusief APK en Android16, zijn hergebruikt als basisbewijs. Geen ZIP gebruikt.

## Uitgevoerde inventarisatie en prioriteiten

| Scherm of subpagina | Bevinding en resultaat |
| --- | --- |
| Home en nieuws | Bestaande premium slideshow en tegels behouden. Geen nieuwe advertenties. |
| Competities | Alle tien tegelroutes bekeken in de bron. Europese competitiepagina's hebben nu een route naar exact gekoppeld Veldio-nieuws en een officiële bronroute voor actuele cijfers. Geen onbevoegd overgenomen tabellen. |
| Eredivisie: stand, programma, uitslagen, spelers, clubs, uitgelicht | Bestaande uitgebreide tabbladen behouden. Cijfers vereisen nu geldige rechten en een update binnen 36 uur. Clubdetail linkt naar profiel en nieuws. Officiële logo-afbeeldingen verwijderd uit deze tabel. |
| Clubs en Mijn Club | Clubgids en clubnieuwsknoppen openen nu clubprofielen. Ajax, Feyenoord, PSV, Twente, AZ en Groningen hebben brononderbouwde achtergrond. Andere clubs blijven bereikbaar met expliciete ontbrekende-gegevensmeldingen. |
| Favorieten en bewaard | Favoriete clubkaart opent profiel. Wedstrijden koppelen op clubnaam en gecontroleerde alias, niet op ontbrekende ID's. Bewaren en zoekarchief behouden. |
| Clubprofiel | Oprichting, stadion waar gecontroleerd, bronknoppen, beschikbare positie/punten/doelsaldo, vijf eindstanden, vorm, eerstvolgende duel, recent nieuws en zoekarchief. Huidige trainer/selectie ontbreekt zonder vrijgegeven feed en wordt expliciet vermeld. Bestaande gecrediteerde archieffoto's hergebruikt voor Ajax, PSV en Feyenoord. |
| Wedstrijden en voorspellen | Zelfde actualiteitsgrens. Bestaande lokale voorspellingen blijven behouden. Geen verzonnen vervangende duels. |
| Stadion en stadionarchief | Bestaand brononderbouwd De Kuip-portret heeft 11 secties, geschiedenis, capaciteit met bronverschil, architectuur, historische duels en tien weetjes. Vast opschrift 'zes weetjes' gecorrigeerd. Geen tweede grotendeels identiek portret toegevoegd. |
| Quiz: setup, spel, antwoorduitleg, resultaat, dagelijks, club, expert, ranglijst | Bestaande spelvormen, animaties, uitleg, snelheidspunten en naamfilter behouden. Zeven brononderbouwde historievragen toegevoegd, 662 vragen totaal in Android en serverbank. |
| Video's en speler | Officiële YouTube-speler, bronvermelding, consent, fullscreen en externe fallback behouden. Stil hangende speler meldt na 15 seconden hoe de video extern geopend kan worden. Geen herhosting. |
| Column en artikelreader | Ongewijzigd. Originele auteur en artikelweergave behouden. |
| Zoeken | Ontbrekende, toekomstige en ongeldige publicatiedatums worden niet als nieuws weergegeven. Duplicaten op titel en ID verwijderd. Gerelateerde pagina's gebruiken 14 dagen; archief blijft apart doorzoekbaar. |
| Meer, contact, meldingen, instellingen, juridische info | Routes in bron geïnventariseerd. Bestaande functies behouden. Mailconfiguratie blijft afhankelijk van ontbrekende serverinstellingen uit fase45. |
| Terugnavigatie en lifecycle | Profielen bewaren interne geschiedenis en scrollpositie. Netwerkcallbacks stoppen bij verlaten WebViews. Persoonlijke pagina en statistiekverzoeken hebben een totale deadline van 18 seconden. |

## Databronnen, kosten en beperkingen

Op 4 november 2026 geeft de publieke API /health nog revision fd9b760e11d5226850754d14e24b1ee31d3b0ee5; /integrations/statistics geeft HTTP 404; /articles geeft tien artikelen. Er is dus geen actuele statistiekfeed aangetoond. De nieuwe pagina's gebruiken geen extra providers, sleutels of kosten. Historische feiten komen uit officiële clubpagina's, met bronlinks en controledatum in de assets. Nieuwe afbeeldingen zijn niet gegenereerd.

Een statistiekensnapshot moet rightsPolicyVersion 26 en een geldige rightsExpiresAt bevatten. Zonder zo'n snapshot tonen profielen hun historische inhoud, eigen artikelen en expliciete datameldingen. Europese standen en programma's zijn extern bereikbaar via de bestaande officiële competitiebron. De doelstelling 15 kwalitatieve artikelen per dag en alle fase45-redactiepoorten blijven intact; dit is geen aangetoonde dagelijkse productie.

Render-integratie vereist expliciete selectie van My Workspace (tea-dbdn0ba9lscs73cau5q0). Er is nog geen antwoord ontvangen op die selectie. De Render-serviceconfiguratie is niet gewijzigd. Publieke gezondheid is wel gelezen. Contactbezorging, advertenties en publieke lancering worden niet als werkend geclaimd.

## Validatie

Lokale suite: 251 tests, 243 geslaagd, acht bestaande Redis-tests overgeslagen zonder testdatabase. Nieuwe modeltests dekken onvolledige eindstanden, clubaliassen zonder ID's, verlopen rechten, oude en toekomstige snapshots, verlopen nieuws, dubbele koppen, competitieclassificatie en quizbronvalidatie.

Lokale browserstart is door de uitvoeromgeving geblokkeerd (socket Operation not permitted). De mobiele browsertest draait daarom in de bestaande GitHub-buildworkflow vóór de APK-build, op de daadwerkelijk verpakte Android-assets. Android16-regressietest blijft onderdeel van dezelfde workflow. Resultaten en APK-link worden na afloop toegevoegd. Geen fysieke Galaxy S23-test geclaimd.
