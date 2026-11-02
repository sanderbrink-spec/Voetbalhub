# Veldio fase 24: automatische redactie

Datum: 31 oktober 2026.
Uitgangspunt: de afgeronde `Veldio-23-audit-broncode.zip`, versie 1.

## Resultaat

De bestaande redactieketen is gericht versterkt. Automatische onderwerpreservering telt nu ook mislukte en tegengehouden concepten mee voor maximaal 20 onderwerpen per Nederlandse kalenderdag. Herhaalde opdrachten starten voor hetzelfde gereserveerde onderwerp geen nieuwe AI-generatie. Afkeuringen en fouten blijven zichtbaar in de bestaande redactiedesk.

Artikelopslag, actuele goedkeuring, duplicaatidentiteit en conceptstatus worden samen atomair verwerkt. Een gelijktijdige andere publicatie maakt een eerdere duplicaatcontrole ongeldig, zodat de server opnieuw controleert voordat hij schrijft. De bestaande controle op sterk overlappende teksten blijft behouden.

Alle bestanden in `android-ui`, inclusief Java-code, afbeeldingen en de acht UI-assets, zijn byte voor byte gelijk aan fase 23. Slideshow, startpagina, artikelkaarten, De Derde Helft, huisstijl en contactformulier zijn niet gewijzigd. Er zijn geen nieuwsfeeds, domeinen of livescores toegevoegd. Afbeeldingsgenerator en afmetingen zijn behouden.

## Inventarisatie en gerichte verbeteringen

| Onderdeel | Al aanwezig en behouden | Aangetoond probleem en aanpassing |
| --- | --- | --- |
| Nieuwsdetectie | Bestaande officiële domeinen, nieuwsindexen, bronparen en actualiteitsvenster | Relevante Nederlandse en Europese onderwerpen krijgen binnen deze bestaande selectie voorrang. Er zijn geen nieuwe bronnen toegevoegd. |
| Daglimiet | `maxPerDay:20` en `maxPerRun:6` | De oude limiet telde alleen gepubliceerde artikelen. Nu reserveert Redis atomair maximaal 20 automatische onderwerpen per dag, inclusief mislukte pogingen. Een lager ingestelde limiet wordt gerespecteerd. |
| Herhaalde opdrachten | Controle van al gepubliceerde onderwerpen | Nog niet gepubliceerde, mislukte opdrachten konden opnieuw AI-verbruik veroorzaken. Een vaste identiteit van het bronpaar houdt verwerking en beoordeling nu vast over runs heen. |
| Concepten | Origineel Nederlands concept, tekstcontrole en maximaal één gerichte herstelpoging | Een onderbroken of afgekeurd automatisch onderwerp verdween eerder in runlogs. Er staat nu direct een privérecord met status `needs_review`, dat met tekst en controles wordt bijgewerkt. |
| Feitencontrole | Letterlijke bronpassages, twee primaire websites, tekstcontroles en tweede AI-beoordeling | Feiten worden aanvullend getoetst op cijfers en namen die niet in de aangewezen bewijsplaatsen voorkomen. Iedere gebruikte bron van een automatische mededeling moet een geldige actuele datum hebben. Misvormde AI-antwoorden leveren begrijpelijke controlepunten op. |
| Transfers en wedstrijdgegevens | Beperkte automatische route; geen zelfstandige Flashscore-scraper | Transfers en onvoldoende bevestigde informatie gaan naar menselijke controle. Uitslagen en wedstrijdverslagen blijven geblokkeerd zonder de bestaande onafhankelijke controles en Flashscore-verwijzing. |
| Categorie | Opgeslagen categorie reist mee naar de openbare feed | Ontbrekende, te lange of ongeldige AI-categorieën worden tegengehouden. De gecontroleerde categorie blijft behouden; er wordt geen competitie uit alleen een clubnaam afgeleid. |
| Afbeelding | Eigen grafische illustraties, inhoudsgebonden bestandsnaam en controle van openbaar opgehaalde bytes | Geen generatorfout aangetoond. De generator is behouden. De bewezen beeldhash staat nu ook bij de controle-informatie van het concept. De desk toont de bijbehorende afbeelding. |
| Handmatige beoordeling | Bewerken, opslaan, revisies, goedkeuren en publiceren | Afkeuren ontbrak als opgeslagen eigen-conceptstatus. De bestaande editor heeft nu een knop Afkeuren; afgekeurde records blijven leesbaar. |
| Publicatie | Toegangscontrole, inhoudshash en duplicaatcontrole | Los lezen en schrijven kon concurrente publicaties of gewijzigde goedkeuring laten passeren. Eén Redis-transactie hercontroleert de revisie en verwerkt artikel, duplicaatindex en gepubliceerde status samen. |
| Verloren antwoord | Artikel-ID uit opgeslagen concept | De automatische route herhaalt een publicatieverzoek één keer met dezelfde goedgekeurde conceptidentiteit. Een verloren bevestiging na opslag levert hetzelfde artikel op. |
| Fouten en herstel | Runlogs en downloadbaar workflowrapport | Controles en publicatiefouten worden met fase en reden bewaard. Ook bij een vroege fatale fout wordt het runrapport geschreven. Bronuitval wordt expliciet gemeld. |
| Desk-informatie | Bronlinks, feiten en gecontroleerde versie | Controlepunten, letterlijke bewijsplaatsen en statussen zijn zichtbaar. Een controle die niet bij de huidige inhoudshash hoort, wordt als niet actueel gemarkeerd. Oude teksten die alle automatische publicatie uitgeschakeld noemden, zijn verduidelijkt. |
| CI | Bestaande test- en publicatieworkflows | De automatische workflow gebruikt nu Redis voor de integratietests en onderbreekt een lopende publicatie niet wegens een nieuwe run. De browserworkflow installeert de bestaande Pillow-rendererafhankelijkheid en test de volledige keten inclusief Veldio-weergave. |
| Deploy-volgorde | Render-service en GitHub-workflow | De runner controleert vooraf de nieuwe servercapaciteit `editorialAutomationVersion:24` en verbonden opslag. Op een oude server start hij geen generatie of reserveringsschrijfacties. |

## Bewezen volledige ketens

### Handmatig

Een synthetisch testonderwerp wordt via de echte `/draft`-route omgezet in een concept. De echte tekst- en publicatiecontroles draaien. De bestaande Python-generator rendert daadwerkelijk een WebP-afbeelding. De mediakoppeling wordt gecontroleerd. De conceptversie wordt opgeslagen en goedgekeurd. Twee gelijktijdige verzoeken leveren één artikel op. De echte `/articles`-route geeft dat artikel met de juiste tekst, categorie en afbeelding terug.

Chromium ontvangt deze werkelijk gepubliceerde lokale feed in het ongewijzigde Veldio-homebestand. De artikelkop en gerenderde afbeelding zijn zichtbaar; klikken geeft het juiste artikel-ID aan de bestaande Android-bridge-interface door. Dit bewijst de WebView-inhoud en de callback, niet bediening op een fysiek Android-toestel.

Een apart afgekeurd concept kan niet worden gepubliceerd en verandert de feed niet.

### Automatisch

De bestaande runner doorloopt detectie, selectie van bronpassages, conceptgeneratie, feitencontrole, echte beeldrendering, goedkeuring, publicatie en controle van de zichtbare feed. Een gesimuleerd verloren HTTP-antwoord ná echte lokale opslag wordt veilig herhaald. Er ontstaat één artikel. Een volgende run veroorzaakt geen nieuwe AI-completions voor hetzelfde onderwerp.

Bij een negatieve tweede feitencontrole blijft het volledige concept als `needs_review` bewaard. Er wordt geen afbeelding geüpload en niets gepubliceerd.

**Werkelijke onderdelen:** serverroutes, Redis, transacties, revisies, controlelogica, Python-renderer, browserweergave en callback.

**Gesimuleerde onderdelen:** bronpagina's en actuele nieuwsfeiten, Groq-antwoorden en GitHub-mediaopslag. Testverhalen zijn fictieve fixtures. Er zijn geen testartikelen naar de productie-app gestuurd en geen betaalde AI-opdrachten gestart.

## Testresultaten

| Controle | Eindresultaat |
| --- | --- |
| Volledige Node-suite, met echte lokale Redis | 196 geslaagd, 0 mislukt, 0 overgeslagen. Dit omvat de 183 bestaande tests en 13 aanvullende scenario's. |
| Volledige handmatige keten, inclusief zichtbaar artikel en klik in Veldio-home | Geslaagd met Chromium. |
| Volledige automatische keten | Geslaagd met de hierboven onderscheiden echte en gesimuleerde onderdelen. |
| Afgekeurde automatische feitencontrole | Geslaagd: `needs_review`, tekst behouden, geen beeldpublicatie en geen artikel. |
| Afgekeurd handmatig concept | Geslaagd: server weigert publicatie. |
| Daglimiet onder 25 gelijktijdige aanvragen | Geslaagd: 20 reserveringen, 5 geweigerd. Herhaling van dezelfde identiteit telt niet opnieuw. |
| Nederlandse daggrens | Geslaagd: reset op de kalenderdatum van Europe/Amsterdam, niet op UTC-middernacht. |
| Gelijktijdige publicatie en gewijzigde goedkeuring | Geslaagd: geen dubbele opslag; gewijzigde goedkeuring wordt geweigerd. |
| Nieuwe publicatie tijdens eerdere duplicaatcontrole | Geslaagd: oudere controlesnapshot wordt geweigerd. |
| Verloren publicatiebevestiging en volgende run | Geslaagd: hetzelfde artikel, geen extra AI-generatie. |
| Oud serverprotocol, bronuitval, ongeldige categorie, misvormde AI-data en verlopen verzoek | Geslaagd: stoppen zonder onterechte publicatie. |
| Zes bestaande browserprogramma's | Geslaagd: redactiedesk, Eredivisie, voorbeschouwing, persoonlijke omgeving, Veldio-home en contactformulier. |
| Aanvullende deskcontrole | Geslaagd: statussen, beeldkoppeling, ontsnapte HTML in bronbewijs en opgeslagen afkeuring. |
| Java ScreenHistoryTest uit Android-voorbereiding | Geslaagd. |
| Alle 16 GitHub-workflows als YAML | Geldig geparseerd. Een nieuwe live Actions-run is niet gestart. |
| Alle Android-bron-, UI- en afbeeldingsbestanden tegenover fase 23 | Exact gelijk. |
| Afhankelijkheden | `package.json` en lockfile ongewijzigd. `npm audit --omit=dev` meldt 0 bekende kwetsbaarheden. |
| Gerichte scan op bekende sleutel- en private-keypatronen | Geen overeenkomsten in de uitgepakte broncode. Dit vervangt geen volledige geheimencontrole van alle historische archieven en externe accounts. |

De eerste nieuwe ketentest bevatte een fout in de testhelper: het JSON-statusveld overschreef de HTTP-status. Deze testfout is gecorrigeerd. Het uitgebreide Redis-protocol vereiste ook een aanpassing van de bestaande mock in de servertests; de echte transactie is daarnaast met Redis getest. Alle uiteindelijke controles hierboven slagen.

## Activeren en resterende begrenzing

De wijzigingen zijn in de opgeleverde broncode uitgevoerd. Er is geen productiecommit of Render-deploy gestart. Voor activering:

1. Werk de bestaande repository bij met deze broncode, inclusief beide gewijzigde workflows. Laat de bestaande Render-service de nieuwe serverversie uitrollen. Controleer daarna `/health`: `editorialAutomationVersion` moet 24 zijn en `storage` moet `connected` zijn.
2. Behoud de bestaande serverinstellingen `REDIS_URL`, `HUB_API_SECRET` en `GROQ_API_KEY`. De automatische GitHub-workflow gebruikt `HUB_API_SECRET`, `GROQ_API_KEY` en het bestaande `GITHUB_TOKEN` met media-schrijfrechten. Er zijn geen sleutels in broncode opgenomen. De daadwerkelijke geldigheid van productiegeheimen is in deze fase niet getest.
3. Controleer één echte nieuwsrun en beoordeel de opgeslagen bronnen en concepten. Onvoldoende bevestigde onderwerpen blijven privé. Een onderbroken of afgekeurde automatische poging wordt niet opnieuw tegen betaling gegenereerd; zij kan handmatig worden geopend, aangepast, goedgekeurd of afgekeurd.

De 20 is een bovengrens voor gereserveerde automatische onderwerpen per dag, inclusief onbruikbare pogingen. Het is geen belofte van 20 publicaties. De bestaande route blijft beperkt tot voldoende onderbouwde mededelingen. De bestaande geselecteerde wedstrijdvoorbeschouwing blijft in haar eigen proces. Transfers en wedstrijdverslagen worden niet onbeheerst aan automatische publicatie toegevoegd.

Er is geen nieuwe juridische beoordeling van bestaande domeinen uitgevoerd. Een technisch toegestane officiële website is geen algemene licentie op haar teksten, foto's of logo's. De bestaande bronbeperkingen, controle op letterlijke overname en eigen illustraties zijn behouden. Flashscore wordt niet automatisch verzameld.

AI-controles bewijzen niet zelfstandig dat iedere sportieve bewering waar is. Productiebronbereikbaarheid, echte Groq-kwaliteit, actuele wedstrijdfeiten, echte GitHub-mediarechten, geplande toekomstige runs en fysieke Android-bediening zijn niet aangetoond door de lokale tests.

## Android en beschikbare APK

De Android-voorbereiding en Java-navigatietest slagen. De 46 voorbereide bestanden onder `app/src/main` zijn exact gelijk aan de bestanden waarmee de test-APK van fase 23 succesvol is gebouwd. De volledige map `android-ui` is eveneens ongewijzigd.

Een **nieuwe lokale Gradle-herbouw is in fase 24 niet afgerond**. Rechtstreekse downloads van bestaande Maven-afhankelijkheden gaven HTTP 403. Pogingen via een lokale cache van de officiële repositories overschreden daarna de ingestelde tijdslimieten tijdens afhankelijkheidsresolutie. Er is daarom geen nieuwe succesvolle Android-build of toesteltest geclaimd. Versies of productie-repositories zijn hiervoor niet aangepast in de opgeleverde broncode.

De bestaande `Veldio-23-audit-test.apk` blijft de bij deze ongewijzigde Android-client behorende test-APK. Deze is opnieuw met `apksigner verify` gecontroleerd en heeft een geldige v2-handtekening. Zij wordt als bestaande client aangeboden, niet als een nieuw gebouwde fase-24-APK. De fase-24-wijzigingen bevinden zich in de server, runner en redactiedesk; de client krijgt de nieuwe berichten via dezelfde bestaande API.

Interne APK-versie: `4.26-veldio`, versionCode `58`, pakket `nl.voetbalhub.app1`. Deze metadata is al in het aangeleverde project aanwezig en is behouden. Het betreft een debug-testbuild.

APK SHA-256: `3a37b185a3e54e75385de4d057f5bebe9c3056226ed30f4a0a9668c16008647b`.

## Gewijzigde bestanden

Bestaande bestanden: `server.js`, `editorial-drafts.js`, `scripts/automatic-publication.js`, `public/desk.js`, `public/publish-desk.html`, `.github/workflows/automatic-publication.yml`, `.github/workflows/redactie-ui.yml` en de relevante bestaande Node- en desk-browsertests.

Toegevoegd: `editorial-publication.js`, `test/editorial-chain.redis.test.js`, `test/editorial-reliability.redis.test.js` en een synthetische testfixture onder `test/fixtures`. Het vorige controlerapport blijft in het broncodepakket bewaard. Historische productierecords zijn niet gewijzigd of verwijderd.
