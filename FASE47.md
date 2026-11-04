# Veldio fase 47

Basis: premium fase46-commit 43cd30ad9a2628a1013eee25e5ec341e6ea12ab0. Herstelbranch fix/veldio-47-functional. Geen ZIP-bron gebruikt. Buildbron 9e4e9cf57eab30e46a853e7058e87b096037283a; identieke productietree in 003efd72b9255f61fed0216171aca636961d23fb. Laatste documentatie-/servercorrecties kunnen op een latere productiecommit staan; de Android-assets blijven gelijk.

## De zeven herstelpunten

| Punt | Uitvoering | Beperking |
| --- | --- | --- |
| Mijn Clubs | Dubbele Mijn Club-route verwijst naar dezelfde Mijn Clubs-pagina. Bestaande favorieten blijven behouden; meerdere clubs toevoegen/verwijderen; primaire club in SharedPreferences. Clubgids vervangt de dubbele menutegel. | Geen account of cloudsynchronisatie. |
| Shirticonen | Dynamisch zelfgetekend SVG uit clubmetadata; kleuren voor alle 38 Nederlandse clubgidsitems; AZ rood/zwart, Twente rood. Geen logo’s of sponsors. | Onbekende internationale kleuren krijgen een neutraal shirt. |
| Statistieken | Oorzaak vastgesteld: Node-server had geen /integrations/statistics-route, Render liep achter. Route toegevoegd; beschikbaarheid en lege stand worden expliciet onderscheiden. | Eredivisie heeft nog geen geschikte actuele vrijgegeven bron. Er wordt geen fictieve stand getoond. |
| Wedstrijden | Centrale gratis OpenLigaDB-laag met vijf kandidaatcompetities, cache, deadline, verzoekbundeling, bronvermelding, competitie-/favorietenfilters en verversing. | Communitygegevens zonder SLA; ontbrekende eindstanden blokkeren de berekende stand. Berekende puntenlijst is geen officiële ranglijst, puntenaftrek of volledige tiebreakimplementatie. |
| Voorspellen | Echte toekomstige bronduels, lokale opslag, wijzigingen tot bekende aftrap, automatische sluiting, 3/1/0 punten, totaalscore en correctpercentage. Gecontroleerde punten blijven lokaal beschikbaar na herstart en bronuitval. | Geen voorspellingen op onbekende aftraptijd, accounts of online ranglijst. |
| Competitiepagina’s | Tien gidsen met regio, competitieopzet, achtergrond, officiële bronroute en eigen nieuwsroute. Beschikbare clubs, wedstrijden en berekende cijfers geïntegreerd. | Geen actuele clubs verzonnen voor competities zonder feed; geen kunstmatig nieuws toegevoegd. |
| Wedstrijdbeelden | Bestaande sjaalpipeline met exacte clubnamen, kleuren, pixelcontrole, cache en neutrale fallback behouden. Cachecontrole aangescherpt zodat ook opgeslagen foto’s nog aan de kwaliteitsregels moeten voldoen. Algemene analyses krijgen niet automatisch een wedstrijdbeeld. | Geen betaalde generatie gestart; bestaande quota en sleutelconfiguratie blijven bepalend. |

## Extra herstel

Geen blijvende laadtekst na fout op de Eredivisie-pagina. Getypte voorspelling blijft staan tijdens netwerkverversing. Aftrap zonder bekende tijd is niet speelbaar. Wedstrijdcache per competitie voorkomt vermenging. Oude officiële-standenscraper uit de geplande workflow verwijderd; periodieke controle bevraagt uitsluitend Veldio’s toegestane centrale API. Bestaande beelden, logo, slogan en premium stijltokens behouden.

## Databronnen en rechten

| Bron | Licentie / commercieel gebruik | Kosten, beperkingen en verversing | Productie |
| --- | --- | --- | --- |
| OpenLigaDB, https://www.openligadb.de/ en https://api.openligadb.de/ | Officiële homepage vermeldt ODbL. https://www.openligadb.de/lizenz en https://opendatacommons.org/licenses/odbl/1-0/. Commercieel gebruik toegestaan onder ODbL; attributie en herbruikbare afgeleide database via publiek JSON-endpoint. Geen logo’s overgenomen. | €0; geen sleutel; communitykwaliteit, geen SLA. Maximaal één centraal bronverzoek per competitie per vijftien minuten. App ververst maximaal iedere minuut vanuit centrale cache. | Bundesliga, La Liga, Premier League, Champions League, Europa League na structuurcontrole. Onvolledige eindstanden leveren geen competitiestand op. |
| OpenFootball, https://github.com/openfootball/football.json | CC0: https://github.com/openfootball/football.json/blob/master/LICENSE.md. Commercieel hergebruik toegestaan. | €0; geen sleutel, geen gegarandeerde updatefrequentie. Gevonden revisie e674442 van 22 september 2026 is verouderd. | Niet gebruikt als actuele feed. |
| football-data.org | https://www.football-data.org/pricing, https://www.football-data.org/about, https://www.football-data.org/documentation/faq. Gratis abonnement met attributie, tien aanvragen/minuut. | Sleutel en toepasselijke rechtenafspraken niet bevestigd. | Niet geactiveerd; geen registratie of betaald abonnement aangemaakt. |
| NOS/Teletekst, Flashscore, ESPN | Geen toestemming voor commerciële extractie vastgesteld. | Gratis toegankelijkheid geeft geen hergebruikrecht. | Niet gekoppeld. Oude scraper niet meer ingepland. |
| Veldio redactionele invoer | Beveiligde /football-review-route: controleur, bron-URL, concreet rechtenbewijs en vier controles vereist. Originele eigen invoer, onafhankelijke verificatie en geen beschermde database-extractie. | Bestaande Redis; geen nieuwe dienst. Invoer verloopt na 36 uur en vereist hercontrole. Losse wedstrijden leveren geen competitiestand op. | Deskformulier toegevoegd; nog geen onbewezen wedstrijdrecords ingevoerd. |

Achtergrond: officiële KNVB-historie, Premier League-historie, Bundesliga-historie en UEFA-uitleg over de competitiefase. URLs staan in competitions47.js. Geen overgenomen artikelen of clubfoto’s toegevoegd.

## Controles en bewijs

Lokale Node-suite: 260 tests, 252 geslaagd, acht bestaande Redis-tests overgeslagen zonder testdatabase. Nieuwe tests dekken 3/1/0 punten, gesloten aftrap, toekomstige/onvolledige eindstanden, offline bewaarde punten, weigering van onbevestigde invoer, dubbele wedstrijd-ID’s, cacheverzoekbundeling en veilige shirtmarkup.

Mobiele browsertests: fase46-profielregressie plus functional47.cjs geslaagd op 320 en 393 pixels. Alle tien competitiegidsen, voorspelling via bridge, aftrapvergrendeling, filters, verversing, formulierenbehoud, Mijn Clubs en primaire club gecontroleerd. Bronprovenancecontrole slaagt. Zeven screenshots uit de opdracht geïnspecteerd.

GitHub Actions: Node-suite 41910671661 geslaagd. APK-/API36-workflow 41910671682 bouwt 4.47-test, versiecode 87, rechtstreeks uit versiebeheerde bron. Definitieve build- en Androidresultaten volgen na afronding; geen geslaagde fysieke Galaxy S23-test geclaimd.

## Openstaande blokkades en drie lanceringsprioriteiten

1. Actuele Eredivisie-/KKD-data en officiële standen: geschikte licentie of onafhankelijk gecontroleerde originele redactionele invoer nodig. Een lege feed is niet als voltooid aangemerkt.
2. Redactieproductie en bestaande infrastructuur: vijftien is het bestaande maximum, geen gegarandeerd dagelijks volume. Verifieer publicatierapporten, contactbezorging en bronstatus vóór publieke lancering.
3. Definitieve APK-acceptatie, releaseondertekening en fysieke Samsung Galaxy S23-test. Emulatorbewijs vervangt geen fysieke test.
