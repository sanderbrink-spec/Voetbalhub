# Veldio fase 47

Basis: premium fase46-commit 43cd30ad9a2628a1013eee25e5ec341e6ea12ab0. Herstelbranch fix/veldio-47-functional. Geen ZIP-bron gebruikt. Definitieve APK-bron: a845792cd6b4e7e2c596aa859088d58303e8830c. De 145 code-, manifest- en assetbestanden zijn bytegelijk aan de geslaagde regressie-APK uit 6ebd0dd006863776d96ab3629bd7fc401f2ec0b3. Eerste build 9e4e9cf bevatte nog de oude Eredivisie-ingang en is vervangen. Laatste documentatie-/servercorrecties kunnen op een latere productiecommit staan; de Android-assets blijven gelijk.

## De zeven herstelpunten

| Punt | Uitvoering | Beperking |
| --- | --- | --- |
| Mijn Clubs | Dubbele Mijn Club-route verwijst naar dezelfde Mijn Clubs-pagina. Bestaande favorieten blijven behouden; meerdere clubs toevoegen/verwijderen; primaire club in SharedPreferences. Clubgids vervangt de dubbele menutegel. | Geen account of cloudsynchronisatie. |
| Shirticonen | Dynamisch zelfgetekend SVG uit clubmetadata; kleuren voor alle 38 Nederlandse clubgidsitems; AZ rood/zwart, Twente rood. Geen logo’s of sponsors. | Onbekende internationale kleuren krijgen een neutraal shirt. |
| Statistieken | Oorzaak vastgesteld: Node-server had geen /integrations/statistics-route, Render liep achter. Route toegevoegd; beschikbaarheid en lege stand worden expliciet onderscheiden. | Eredivisie heeft nog geen geschikte actuele vrijgegeven bron. Er wordt geen fictieve stand getoond. |
| Wedstrijden | Centrale gratis OpenLigaDB-laag met vijf kandidaatcompetities, cache, deadline, verzoekbundeling, bronvermelding, competitie-/favorietenfilters en verversing. | Communitygegevens zonder SLA; ontbrekende eindstanden blokkeren de berekende stand. Berekende puntenlijst is geen officiële ranglijst, puntenaftrek of volledige tiebreakimplementatie. |
| Voorspellen | Echte toekomstige bronduels, lokale opslag, wijzigingen tot bekende aftrap, automatische sluiting, 3/1/0 punten, totaalscore en correctpercentage. Gecontroleerde punten blijven lokaal beschikbaar na herstart en bronuitval. | Geen voorspellingen op onbekende aftraptijd, accounts of online ranglijst. |
| Competitiepagina’s | Tien gidsen met regio, competitieopzet, achtergrond, officiële bronroute en eigen nieuwsroute. Beschikbare clubs, wedstrijden en berekende cijfers geïntegreerd. | Geen actuele clubs verzonnen voor competities zonder feed; geen kunstmatig nieuws toegevoegd. |
| Wedstrijdbeelden | Bestaande sjaalpipeline met exacte clubnamen, kleuren, pixelcontrole, cache en neutrale fallback behouden. Cachecontrole aangescherpt zodat ook opgeslagen foto’s nog aan de kwaliteitsregels moeten voldoen. Dezelfde gecontroleerde wedstrijdafbeelding kan tussen voor- en nabeschouwing hergebruikt worden zonder nieuwe betaalde aanroep. Algemene analyses krijgen niet automatisch een wedstrijdbeeld. | Geen betaalde generatie gestart; bestaande quota en sleutelconfiguratie blijven bepalend. |

## Extra herstel

Geen blijvende laadtekst na fout op de Eredivisie-pagina. Getypte voorspelling blijft staan tijdens netwerkverversing. Aftrap zonder bekende tijd is niet speelbaar. Wedstrijdcache per competitie voorkomt vermenging. Oude officiële-standenscraper uit de geplande workflow verwijderd; periodieke controle bevraagt uitsluitend Veldio’s toegestane centrale API. Bestaande beelden, logo, slogan en premium stijltokens behouden.

## Databronnen en rechten

| Bron | Licentie / commercieel gebruik | Kosten, beperkingen en verversing | Productie |
| --- | --- | --- | --- |
| OpenLigaDB, https://www.openligadb.de/ en https://api.openligadb.de/ | Officiële homepage vermeldt ODbL. https://www.openligadb.de/lizenz en https://opendatacommons.org/licenses/odbl/1-0/. Commercieel gebruik toegestaan onder ODbL; attributie en herbruikbare afgeleide database via publiek JSON-endpoint. Geen logo’s overgenomen. | €0; geen sleutel; communitykwaliteit, geen SLA. Maximaal één centraal bronverzoek per competitie per vijftien minuten. App ververst maximaal iedere minuut vanuit centrale cache. | Bundesliga, La Liga, Premier League, Champions League, Europa League na structuurcontrole. Onvolledige eindstanden leveren geen competitiestand op. |
| OpenFootball, https://github.com/openfootball/football.json | CC0: https://github.com/openfootball/football.json/blob/master/LICENSE.md. Commercieel hergebruik toegestaan. | €0; geen sleutel, geen gegarandeerde updatefrequentie. Gevonden revisie e674442 van 22 september 2026 is verouderd. | Niet gebruikt als actuele feed. |
| football-data.org | https://www.football-data.org/pricing, https://www.football-data.org/about, https://www.football-data.org/documentation/faq. Gratis abonnement met attributie, tien aanvragen/minuut. | Sleutel en toepasselijke rechtenafspraken niet bevestigd. | Niet geactiveerd; geen registratie of betaald abonnement aangemaakt. |
| NOS/Teletekst, Flashscore, ESPN | Geen toestemming voor commerciële extractie vastgesteld. | Gratis toegankelijkheid geeft geen hergebruikrecht. | Niet gekoppeld. Oude scraper niet meer ingepland. |
| Veldio redactionele invoer | Beveiligde /football-review-route: controleur, bron-URL, concreet rechtenbewijs en vier controles vereist. Originele eigen invoer, onafhankelijke verificatie en geen beschermde database-extractie. | Bestaande Redis; geen nieuwe dienst. Invoer verloopt na 36 uur en vereist hercontrole. Losse wedstrijden leveren geen competitiestand op. | Deskformulier via /football-desk en link vanuit de publicatiedesk toegevoegd; nog geen onbewezen wedstrijdrecords ingevoerd. |

Achtergrond: officiële KNVB-historie, Premier League-historie, Bundesliga-historie en UEFA-uitleg over de competitiefase. URLs staan in competitions47.js. Geen overgenomen artikelen of clubfoto’s toegevoegd.

## Controles en bewijs

Lokale Node-suite: 262 tests, 254 geslaagd, acht bestaande Redis-tests overgeslagen zonder testdatabase. Nieuwe tests dekken 3/1/0 punten, gesloten aftrap, toekomstige/onvolledige eindstanden, offline bewaarde punten, weigering van onbevestigde invoer, dubbele wedstrijd-ID’s, cacheverzoekbundeling en veilige shirtmarkup.

Mobiele browsertests: fase46-profielregressie plus functional47.cjs geslaagd op 320 en 393 pixels. Alle tien competitiegidsen, voorspelling via bridge, aftrapvergrendeling, filters, verversing, formulierenbehoud, Mijn Clubs en primaire club gecontroleerd. Bronprovenancecontrole slaagt. Zeven screenshots uit de opdracht geïnspecteerd.

GitHub Actions: Node-suite 41912848304 en redactionele kwaliteitstests 41912848459 geslaagd. De actuele lokale suite telt 262 tests: 254 geslaagd, acht bestaande Redis-tests overgeslagen. De gecontroleerde productie-deskroute levert HTTP 200, bevat de wedstrijdinvoer en is gekoppeld vanaf /desk. Publicatie zonder sleutel geeft HTTP 401.

APK-build 41912848471 is geslaagd, rechtstreeks uit versiebeheerde bron a845792, zonder oude ZIP. De optionele browserinstallatie die bij de vorige build lang duurde is in deze build overgeslagen; de bijbehorende mobiele browsercontroles op exact dezelfde appbron waren lokaal al geslaagd. Bronhashes, verpakte assets, manifest, geheime-sleutelscan en APK-handtekening zijn gecontroleerd.

API36-test in workflow 41912848471 is geslaagd op de exact opgeleverde APK uit a845792. De aanvullende regressieworkflow 41912475042 slaagde eveneens op bytegelijke appcode/manifest/assets uit 6ebd0dd. Installatie, starten, twaalf menuroutes, terugnavigatie, meldingsvoorkeuren, meerdere favoriete clubs, offline herstart, quizantwoorden en een voorspelling voor een echt toekomstig OpenLigaDB-duel via de Java-bridge zijn daadwerkelijk getest. De voorspelling bleef na procesherstart opgeslagen. Het 3/1/0-model en de aftrapgrens zijn geautomatiseerd getest; er is niet op een echte eindstand gewacht. Geen fysieke Galaxy S23-test, achtergrondpush of videoplaybacksucces geclaimd.

APK: Veldio-47.apk, pakket nl.voetbalhub.app1, versie 4.47-test, versiecode 87, 21.069.456 bytes. SHA-256: d5206eebd6c5e1584f17f6fa0cea6eaf6aefe1eb68d1f7a7058ce25021212ab1. Debug-APK; een update over een anders ondertekende eerdere testversie is niet gegarandeerd.

Direct beschikbaar: https://chatgpt.com/library?file_id=libfile_7a3b620008248191b47e37d4be7638e3&account_id=personal
GitHub APK-artifact: https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41912848471/artifacts/13362704033
Android-bewijs van de exact opgeleverde APK: https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41912848471/artifacts/13364730308
Aanvullende regressie: https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41912475042/artifacts/13363327569

## Livecontrole op 4 november 2026

Render-deploy dep-dblpnn3bc2fs73a2ou7g is live met bffcf2a. /health bevestigt deze revisie. Bundesliga: 306 duels en 18 berekende rijen. Champions League en Europa League: elk 144 duels en 36 berekende rijen. La Liga: 380 duels, tien verstreken duels zonder eindstand; Premier League: 380 duels, 29 verstreken duels zonder eindstand. Voor die twee bronnen wordt de onvolledige stand bewust niet getoond. Eredivisie geeft nu HTTP 200 met expliciete unavailable-status, geen 404 en geen verzonnen cijfers.

De eerste API36-test stopte bij Mijn voorspellingen onder de schermrand, zonder scrollinstructie. De gecorrigeerde testdriver is daarna aantoonbaar geslaagd in workflow 41912475042. De oude mislukte test wordt niet als geslaagd vermeld.

Belangrijkste gewijzigde bestanden: football-data47.js, server.js, DestinationView39.java, MainActivity.java, PersonalHubView.java, HomeMenu39.java, NavIconView.java, destinations39.html, personal-hub.html, football47.js, competitions47.js, club-directory.json/js, editorial-image44(-service).js, public/publish-desk.html, redactie/dashboard/index.html en de bijbehorende test-, bronprovenance- en workflowbestanden. Volledige diff is via GitHub beschikbaar.

## Openstaande blokkades en drie lanceringsprioriteiten

1. Actuele Eredivisie-/KKD-data en officiële standen: geschikte licentie of onafhankelijk gecontroleerde originele redactionele invoer nodig. Een lege feed is niet als voltooid aangemerkt.
2. Redactieproductie en bestaande infrastructuur: vijftien is het bestaande maximum, geen gegarandeerd dagelijks volume. Laatste gecontroleerde automatische run 41889864306 (4 november 18:43 UTC): nul publicaties, bron Feyenoord HTTP 403, onvoldoende onafhankelijke feiten bij twee kandidaten; imageProviderConfigured=false. Dit blijft een expliciete productieblokkade. Verifieer publicatierapporten, contactbezorging en bronstatus vóór publieke lancering.
3. Definitieve APK-acceptatie, releaseondertekening en fysieke Samsung Galaxy S23-test. Emulatorbewijs vervangt geen fysieke test.

## Afbakening van de oplevering

Dit is een functionele hersteloplevering, geen volledige afronding van alle fase47-criteria en geen publieke lanceringsvrijgave. Eredivisie, KKD, Serie A, Ligue 1 en Conference League hebben nog geen actuele vrijgegeven feed. De handmatige goedkeuringsroute is beschikbaar maar bevat geen fictieve invulling. La Liga en Premier League missen voldoende eindstanden voor een betrouwbare volledige stand. Clubs met onbekende internationale kleuren gebruiken een neutraal shirt. Mijn Clubs kan bij ontbrekende statistiekgegevens nog een algemene verbindingsmelding tonen; een werkelijk netwerkprobleem en een ontbrekende statistiekfeed worden daar nog niet volledig onderscheiden.

De sjaalpipeline en cache zijn technisch getest; nieuwe betaalde beeldgeneratie is niet gestart en de laatste gecontroleerde redactieronde meldde geen geconfigureerde beeldprovider. Bestaande goedgekeurde afbeeldingen zijn behouden. Alle oude wedstrijdafbeeldingen opnieuw laten genereren is daarom niet als voltooid aangemerkt. De actuele automatische redactie publiceerde in de laatste gecontroleerde run nul artikelen; kwaliteitscontroles zijn niet versoepeld om volume te produceren. Contactbezorging, definitieve releaseondertekening en fysieke acceptatie blijven lanceringsafhankelijkheden.

De exacte opgeleverde APK heeft op 4 november om 21:15 UTC de Android16-test gehaald. Er zijn na de geslaagde controles geen Android-bronwijzigingen aangebracht. De documentatiecommit verandert de APK niet; Render wordt daarna op dezelfde productiebranch geverifieerd.
