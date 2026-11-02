# Veldio fase 26: lanceerrapport

31 oktober 2026. Nederland/EU. **Definitief advies: NO-GO voor openbare publicatie.**

De technisch uitvoerbare lokale herstelmaatregelen zijn aangebracht. De testversie bouwt en de volledige suite slaagt. Er is geen productie-uitrol uitgevoerd. De resterende blokkades omvatten rechtenbewijs, uitgevers- en privacygegevens, daadwerkelijke e-mailverzending, hostingverificatie, toestelcontrole en ondertekening van de echte productierelease. Het resultaat is geen juridisch goedkeuringscertificaat.

## 1. Uitgangspunt en controle fase 25

Het volledige `Veldio-25-lanceercontrole.md`, de actuele versie 3 van `Veldio-25-broncode.zip` en de bijbehorende test-APK zijn gelezen of onderzocht. Er is geen andere nieuwere bronversie in deze opdracht aangeleverd. Productieconfiguraties, contracten en accountgeheimen zijn niet uit een bronarchief afgeleid.

| Invoer | SHA-256 |
|---|---|
| Broncode fase 25 | `16fa3f502917e89223d6257f772fd0bc0a31e8e41c85fa6c745a03cf3f8645e6` |
| Rapport fase 25 | `16e24107e061b928f5c34a1340cd9833f8ed1010112e1ec8de986e50079b3cd4` |
| APK fase 25 | `923e5df84acd8365cbf9333cece515ea87ca1c301365feb759259d80f5a27aa3` |

Vóór wijzigingen zijn **201 tests uitgevoerd: 201 geslaagd, 0 mislukt, 0 overgeslagen**. De lokale Redis-dienst en Chromium waren daadwerkelijk actief. Een aanvankelijke poging zonder bereikbare Redis leverde verbindingsfouten op; na het starten van de geïsoleerde testdienst is de volledige nulmeting geslaagd. Verbindingsfouten zijn niet als productbugs of geslaagde tests gepresenteerd.

Fase 25 bevatte al de CLI-rechtenpoorten, contactpoort, verwijdering van AdMob, sleutelverwijdering uit Android, API 36, conceptrevisies, atomaire publicatie, duplicaatcontrole en bestaande feitencontrole. Deze onderdelen zijn behouden.

## 2. Bevindingen zorgvuldig onderscheiden

| Categorie | Vaststelling | Consequentie |
|---|---|---|
| Aantoonbare juridische overtreding | Met alleen de ontvangen code en ontbrekende contracten is geen definitief vaststaande individuele inbreuk bewezen. Er is geen rechterlijke of externe juridische beoordeling ontvangen. | Ontbrekend bewijs wordt niet als bewezen overtreding aangeduid. |
| Juridische onzekerheid / onvoldoende toestemming | Foto's, logo's, realistische AI-covers, het portret, systematische gegevensverwerking en AI-inputs missen een controleerbaar toepasselijk dossier. Voorwaarden geven geen algemene toestemming. | Niet zonder bewijs publiceren of nieuwe verwerking starten. Een wettelijke uitzondering kan relevant zijn, maar moet concreet worden beoordeeld. |
| Technisch beveiligingsprobleem | Onbeschermde conceptbeelden, onvoldoende afscherming van handmatige AI-/publicatieroutes, achterblijvende oude Worker-routes, onbevestigde caches/snapshots, onjuiste CORS-opmaak, ontbrekende algemene limieten en foutieve juridische links. | In deze ronde gericht hersteld. |
| Administratieve / operationele bevestiging | Uitgeversidentiteit, providerconfiguratie, bewaartermijnen, hostingmaatregelen, merkonderzoek en productiecertificaat ontbreken. | Niet fictief ingevuld; concrete acties in de productiechecklist. |

Niet elk clubnaamgebruik vereist toestemming. Beschrijvend journalistiek gebruik verschilt van een beeldmerk als eigen commerciële identiteit presenteren. Het noemen van een speler is ook iets anders dan het herpubliceren van diens foto. Het dossier moet het daadwerkelijke gebruik en een passende rechtsgrond dekken.

## 3. Daadwerkelijk uitgevoerde wijzigingen

### 3.1 Rechtenregister en afscherming

Nieuwe `content-rights.js`, lege `content-rights.json`, beheerhandleiding `RIGHTS_REVIEW.md` en hulpmiddel `scripts/rights-review.js`.

De Node-server vereist serverzijdige vrijgave met scope, exacte inhoudshash, status, dossierverwijzing, onderbouwde rechtsgrond, beoordelaar, beoordelingsdatum en einddatum. Inkomende vinkjes zoals `imageRights: cleared` kunnen dit niet vervangen. Een ontbrekend, ongeldig, verlopen of ingetrokken dossier blokkeert de betreffende route. Het register wordt bij elke beslissing opnieuw gelezen. Productie kan een afzonderlijk afgeschermd bestand gebruiken via `CONTENT_RIGHTS_FILE`; bewijsstukken blijven buiten het bronarchief.

De hash bindt de definitieve kop, intro, tekst, toelichting, auteur, categorie, bronnen en beeldgegevens. Ook kolommen en beeldwijzigingen vallen eronder. De publieke feed controleert de uiteindelijke weergegeven versie, inclusief eventuele bestaande coververwerking. Alleen een intern `reviewed: true` op een cover maakt een artikel niet zichtbaar. Onvrijgegeven oude records worden verborgen, zonder ze uit opslag te wissen.

**Het meegeleverde register is leeg. Daarom levert deze veilige standaard geen vrijgegeven publieke artikelen of externe snapshots op. Dit is een bewuste rechtenblokkade, geen geslaagde productieredactie.** Er zijn geen toestemmingen verzonnen om de testapp gevuld te houden. Privé bewaarde favorieten worden niet verwijderd; oude APK's en externe publicaties worden door dit pakket niet ingetrokken.

AI-invoer via `/draft`, de verwerkende `/auto-inbox`-route en `/generate-article-image` krijgt een controle vóór een betaalde of externe modelaanroep. Kolompublicatie, normale publicatie en het wijzigen van een artikelafbeelding moeten de afzonderlijke publicatiecontrole doorstaan. De bestaande feiten-, taal-, revisie- en duplicaatcontroles blijven daarnaast gelden.

De vijf bestaande automatische CLI-poorten blijven uit omdat geen daadwerkelijk vrijgegeven broncorpus is ontvangen. De automatische generatie- en publicatiecode blijft aanwezig en wordt met fictieve, expliciet toegelaten testfixtures getest. Het aanzetten van één boolean maakt de rechtencontrole niet overbodig. Er is geen automatische productie gestart.

### 3.2 Externe gegevens en bestaande media

Nieuwe beveiligde routes `/integrations/statistics` en `/integrations/videos` vervangen directe Android-toegang tot oude mediafeeds. Eerst is toestemming voor de vaste bron nodig, daarna voor de hash van de concrete opgehaalde JSON. Omleidingen zijn uitgeschakeld, ophalen heeft een time-out en een grens van 3 MB. Zonder toestemming vindt geen extern verzoek plaats. De bestaande vormgeving voor statistieken, video's en wedstrijdvoorbeschouwingen blijft aanwezig.

Afbeeldingsroutes vereisen een afzonderlijke vrijgave. Lokale coverbytes en de oorspronkelijke externe beeldbytes worden met SHA-256 gebonden. Bij hergebruik van de beeldcache wordt toestemming opnieuw gecontroleerd. Voor extern beeld is daarnaast toestemming voor het ophalen vereist. Deze controles geven geen rechten op een bestand, maar voorkomen dat een eerdere URL-beoordeling gewijzigde bytes automatisch vrijgeeft.

De oude Cloudflare Worker heeft eveneens een serverzijdig bewijsregister (`CONTENT_RIGHTS_JSON`) voor AI-invoer, publicatie en publieke artikelen. Feedophalen vereist afzonderlijke URL-vrijgave naast de bestaande poort. De deploymentworkflow genereert nu, net als `wrangler.toml`, geen cron en zet feedrechten expliciet uit. Daarmee wordt de veilige configuratie niet meer onbedoeld door een deploymenttemplate vervangen.

### 3.3 Android en YouTube

Nieuwe `PublicationPolicy.java` controleert beleidsversie 26 en de geldigheidsduur van feed-/snapshotantwoorden. Oude onbeoordeelde caches en de oude YouTube-seed gelden niet langer als publicatiebewijs. Het beleid geldt voor de homepagina, de persoonlijke omgeving, statistieken, wedstrijdkaart, voorbeschouwing en de native nieuwslezer. Gecontroleerde caches verlopen uiterlijk na vijf minuten, of eerder wanneer het dossier verloopt. Bij intrekking kan een reeds toegelaten offline cache dus nog maximaal binnen die korte geldigheidsduur zichtbaar blijven. Persoonlijk opgeslagen artikelen/favorieten worden behouden en zijn geen publiek distributiekanaal.

YouTube-miniatuurverzoeken in de home-WebView worden lokaal vervangen. Daarvoor gaat geen verzoek naar Google. Dit verandert geen afmetingen of slideshowopmaak. De bestaande speler vraagt per video toestemming en gebruikt de officiële embed met app-identiteit als referer. Sluiten en naar de achtergrond gaan stoppen de speler. De selectie wordt pas beschikbaar via een goedgekeurde snapshot. Advertenties in de YouTube-speler worden niet verborgen of vervangen.

Werkelijke afspeelbaarheid, beschikbaarheid, kindercontentstatus en volledige Google-verwerking moeten op de productie-inrichting worden gecontroleerd. Er is geen live YouTube-netwerkmeting of fysieke toesteltest uitgevoerd. De websitebestanden voor de homepagina zijn ongewijzigd; de thumbnailafscherming zit in de Android-WebView. Er is geen nieuwe zelfstandige web-hostingvariant vrijgegeven.

De links onder Meer gebruikten ten onrechte `/articles/privacy` en `/articles/legal`. De buildpatch verwijdert nu `/articles` voordat de correcte publieke URL wordt opgebouwd.

### 3.4 Authenticatie, misbruik en invoer

Bearercontrole gebruikt constante-tijdvergelijking bij gelijke lengte. Ontbrekende of lege sleutels autoriseren nooit. `NODE_ENV=production` vereist bij starten minimaal 32 tekens voor `HUB_API_SECRET`. Een lange sleutel moet daarnaast willekeurig worden gegenereerd en veilig worden beheerd.

Conceptbeelden via `/generated-image/` vereisen nu redactieautorisatie. Een onvoorspelbaar ID alleen is geen toegangscontrole. Niet-geautoriseerde pogingen krijgen een begrensde teller. Redactionele acties en kostbare beeld-/snapshotroutes hebben aparte proceslimieten met begrensde opslag en verval. Deze limieten gebruiken geen door een bezoeker gekozen proxyheaders. Voor meerdere serverinstanties is daarnaast een hostingbrede/WAF-limiet nodig; proceslimieten zijn geen bewijs van bescherming tegen een verspreide DDoS.

CORS antwoordt alleen met één exact toegelaten HTTPS-origin uit de configuratie. `null`, wildcards en op elkaar lijkende domeinen worden niet automatisch toegelaten. CSRF kan de serverzijdige bearerautorisatie niet vervangen. Requests met een correcte sleutel moeten JSON verzenden; primitieve JSON en arrays worden afgewezen. De algemene bodygrens telt bytes, geeft expliciet HTTP 413 terug en verbreekt niet eerst de verbinding. Beveiligingsheaders, productie-HSTS en server-time-outs zijn toegevoegd.

Het contactformulier behoudt validatie, spamval, herhaalbeveiliging en Redis-limieten. In productie wordt nu ook bij ontbrekende gedeelde Redis-opslag veilig geweigerd. Provideracceptatie blijft vereist voor succes. Er worden geen berichtteksten in het nieuwe rechtenlog opgenomen; het log bevat datum, scope, hash en toestaan/weigeren. Stel bewaartermijn en toegang tot hostinglogs afzonderlijk vast.

Build- en testworkflows gebruiken expliciete minimale tokenrechten. De oude Node-testingangen gebruiken `npm ci` met de lockfile en Node 22. Er is niets naar GitHub gepusht en geen workflow met productie-effect gestart.

## 4. Rechten- en bronnenbeoordeling

| Onderdeel | Huidig oordeel en ontbrekend bewijs |
|---|---|
| Eigen feiten en originele formulering | Mogelijke toegestane route. Onafhankelijke verkrijging, concrete feitenonderbouwing, oorspronkelijkheid en eventuele beschermde selectie/opbouw moeten aantoonbaar zijn. Geen algemene vrijwaring door achtwoordenfilter of AI. |
| VI, VoetbalPrimeur, Voetbalzone | Bestaand link-only-beleid blijft. Bij VI/VP zijn rechtenvoorbehouden gecontroleerd. De Voetbalzone-voorwaarden konden via de onderzochte URL niet betrouwbaar worden opgehaald. Geen stilzwijgende toestemming aangenomen. |
| Flashscore | Geen algemene publicatie- of scrapinglicentie vastgesteld. De eerdere aangewezen feitencontrole blijft onderdeel van de redactieregels, maar legitimeert geen structurele kopie van de databank. |
| Eredivisie / ESPN / overige clubs | Geen door Veldio aangetoonde licenties of concrete andere grond ontvangen. Oude structurele data-aanvoer blijft geblokkeerd. Een primaire website of openbaar endpoint is geen generieke hergebruiklicentie. |
| API-Football | Het abonnement alleen bewijst geen rechten op alle data, competities, logo's of foto's. De actuele voorwaarden leggen aanvullende rechtencontrole bij de afnemer. Account en toegestane openbare distributie moeten worden bevestigd. |
| Eigen eenvoudige renderer | Technisch aanwezig en met echte lokale beeldbytes getest. Geen fotomateriaal of clublogo nodig. DejaVu-fontvoorwaarden zijn geraadpleegd; controleer het daadwerkelijk gebruikte fontpakket en voeg notices toe indien fontsoftware wordt verspreid. Geen specifieke nieuwe productiecover vrijgegeven zonder dossier. |
| PSV Museum/Tours-stadionfoto | Fase 25 noemt geen herpublicatietoestemming. Bronbestand behouden voor gerichte beoordeling, niet als publiek vrijgegeven beeld aangemerkt. De beeldroutes zijn afgeschermd. Verkrijg toestemming of vervang de concrete foto door aantoonbaar eigen/licentiebeeld. |
| Realistische AI-covers / clublogo's / spelersbeelden | Geen creatie- en inputdossier per bestand ontvangen. Portret-, merk- en auteursrechten en mogelijke AI-transparantie vragen afzonderlijke beoordeling. Geen ongevraagde generieke vervanging uitgevoerd. |
| Portret Sander / Veldio-logo | Bestaande bytes behouden. Gebruikstoestemming, inputherkomst en eventuele fotograafrechten ontbreken als formeel dossier. Er is geen nieuw portret of logo gegenereerd. |
| YouTube | Officiële embed blijft. Geen download of vervanging van speleradvertenties. De verkrijgingsroute, contentstatus, toegestane selectie en privacy-inrichting zijn nog niet compleet bevestigd. |
| AdMob | SDK en initialization ontbreken in deze APK. Er is geen CMP-implementatie toegevoegd voor een SDK die nu niet wordt gebruikt. Herinvoering vereist afzonderlijke toestemmingsinrichting en controle van de daadwerkelijk ingebouwde release. |

### Merkonderzoek

BOIP-register en BOIP-zoekinstructies zijn geopend; de registerpagina leverde in de beschikbare zoektoegang slechts een invoerveld op. EUIPO eSearch gaf een 502-fout. Gerichte openbare zoekopdrachten leverden geen bruikbaar volledig registerrapport op. **Er is daarom geen afgeronde registerzoekopdracht met resultaten die beschikbaarheid of afwezigheid van conflicten bewijst.** Dit is een onvoltooide controle, geen merkinbreukvaststelling.

Nodig: BOIP/KVK en relevante EU/internationale registers, volledige naam, naamdelen, klank-/spellingsvarianten en beeldmerkvergelijking, gekoppeld aan werkelijk aangeboden diensten. Onderzoek bijvoorbeeld software, nieuws-/uitgeversdiensten en eventuele SaaS-diensten in passende klassen. Beoordeel aangetroffen rechten inhoudelijk met een merkenprofessional. Naam en hoofdlogo zijn niet gewijzigd.

## 5. AVG en contact: wat is nog niet vastgesteld?

De privacyverklaring is aangepast aan de nieuwe beveiliging, Android-miniaturen en rechtenpoorten. Zij blijft expliciet een concept voor de testversie. De echte uitgever, toepasselijk vestigingsadres, grondslagen, ontvangers, contracten, hostingregio's en bewaartermijnen zijn niet verzonnen. Een eerder genoemd privé-adres is niet automatisch een zakelijk uitgeversadres.

De lokale omgeving bevat geen Resend-sleutel of geconfigureerde afzender. Er is **geen echte e-mail verzonden en geen ontvangst in Gmail bevestigd**. Tests gebruiken gesimuleerde provideracceptatie; die bewijst de foutafhandeling en het succescriterium, niet de operationele mailbox. Nodig zijn een geverifieerd verzenddomein, DNS-verificatie, passende `CONTACT_FROM`, serverzijdige `RESEND_API_KEY`, exacte toegelaten origins, Redis, de definitieve privacy-inrichting en pas daarna `CONTACT_PRIVACY_READY=1`. Test vervolgens een eigen, niet-gevoelig bericht en controleer providerstatus én mailbox, inclusief spam. Een provider-ID bewijst acceptatie, niet gegarandeerde aflevering.

Er is geen universele wettelijke mailboxtermijn ingevuld. Stel een passende termijn en verwijderprocedure vast voor inbox, spam, prullenbak, providerlogs, back-ups en hostinglogs. Resend vermeldt Amerikaanse opslag en reguliere retentie van 30 dagen voor bepaalde abonnementen; controleer de echte accountafspraken. Een EU-verzendregio betekent geen uitsluitend Europese opslag.

Google Play Data Safety moet het netwerkgedrag van de uiteindelijke productieversie volgen. Geen Ads-SDK betekent niet dat er helemaal geen persoonsgegevens worden verwerkt. Controleer hosting, beeldverzoeken, video, contact, lokale opslag en AI afzonderlijk.

## 6. Test- en buildbewijs

| Controle | Daadwerkelijk resultaat | Begrenzing |
|---|---|---|
| Nulmeting fase 25 | 201/201 geslaagd; geen skips | Lokale uitvoering, geen productieaccounts |
| Definitieve volledige Node-suite | **210/210 geslaagd, 0 mislukt, 0 overgeslagen** | Inclusief echte lokale Redis en Chromium-keten |
| Nieuwe regressies | Rechtenhash/bron/beeld/expiry/revocation; echte feedcontrole; AI-blokkade vóór netwerk; conceptbeeldautorisatie; lege/primitive invoer; HTTP 413; limiter; contact zonder Redis; Worker-blokkade; beeldhash/cachehercontrole | Fictieve rechtenbewijzen in tests zijn geen echte licenties |
| Zes browserprogramma's | Contact, redactiedesk, Eredivisie, voorbeschouwing, persoonlijke omgeving en Veldio-home geslaagd | Fixtures en provider-/publicatiemocks; geen echte wedstrijdverificatie of videoafspeling |
| Home/slideshow | Browsercontrole 320–768 px; geen horizontale overloop; drie slides en callbacks werken | Bekende testinhoud; geen fysieke Android-test |
| Java ScreenHistoryTest | Geslaagd met JDK 17 | De eerste compileroproep had geen javac op PATH; met de beschikbare volledige JDK correct uitgevoerd |
| Workflows | Alle 16 YAML-bestanden geparseerd; ingebedde Python-blokken gecompileerd | Geen live GitHub Actions-run |
| Afhankelijkheden | `npm audit --omit=dev`: 0 bekende kwetsbaarheden | Scan op uitvoeringsdatum; geen audit van alle accounts of repositoryhistorie |
| Bron/geheimenscan | Geen concrete matches op geselecteerde sleutel-/privatekeypatronen; ook ingesloten Android-basis-ZIP onderzocht | Geen bewijs dat een geheim nooit in een oude versie of account heeft gestaan |
| Android debug en releasecompilatie | `:app:assembleDebug :app:bundleRelease`: BUILD SUCCESSFUL, inclusief release lintVital | Lokaal met SDK 36, AGP 8.9.1, Gradle 8.11.1 en JDK 17 |
| APK-handtekening | Geldig debugcertificaat, hetzelfde SHA-256-certificaat als fase 25 | Installatie-update technisch voorzien; fysieke installatie niet uitgevoerd |
| APK-inhoud | Geen Ads-classprefix, geen `API_FOOTBALL_KEY`, geen native `.so`; back-up uit; geen Ads-initialisatie of advertentie-ID-permissie | Geen complete dynamische netwerkmeting |
| Productieondertekening | Releasebundle gecompileerd maar niet ondertekend. Negatieve controle zonder secrets stopt expliciet en maakt geen vervangende sleutel | Geen publicatieklare AAB opgeleverd |
| Live backend / toestel / Play | Niet bevestigd; publieke health-opvraag via beschikbare zoektoegang was niet bereikbaar | Geen deploy, Play-indiening, productiemutatie of claim van productie-GO |

De ketentests voor bestaande transacties/kwaliteit gebruiken nu een expliciete fictieve rechtencontrole als testdouble; de Worker-feedfixture bevat een fictief bewijsrecord. De kwaliteitsasserties zijn behouden. Nieuwe tests controleren daarnaast de echte lege rechtenregistratie en echte hash-/intrekkingslogica. Zo zijn de oorspronkelijke transactietests niet als juridisch bewijs gebruikt.

## 7. Behoud van vormgeving en bestanden

`android-ui/assets/home-features.html` en `home-model.js` zijn byte-identiek aan fase 25, ook binnen de werkelijk gebouwde APK. Hoofdlogo, lokale portretfoto, verhoudingen, kleuren en typografie zijn behouden. `HomeFeatureView.java` heeft alleen gegevens-/cachecontrole, veilige integratie-URLs en thumbnailafscherming gekregen. Er is geen slideshow-redesign uitgevoerd. Column, categorieën, navigatie en redactionele workflow blijven aanwezig; onderdelen zonder rechtenbewijs tonen hun bestaande lege/foutstatus.

## 8. Definitieve GO/NO-GO

Dit is een afzonderlijke hercontrole na implementatie door dezelfde uitvoerder, geen onafhankelijke externe juridische opinie.

| Onderdeel | Oordeel | Onderbouwing |
|---|---|---|
| Technische stabiliteit | GO voor de gecontroleerde testversie | Suite, browsers, navigatietest en compilatie geslaagd; productiewerking nog niet bewezen |
| Automatische redactie | NO-GO | Geen aantoonbaar vrijgegeven productiebronnen; poorten blijven uit |
| Auteursrechten | NO-GO | Rechten-/verkrijgingsdossiers en concrete beoordeling ontbreken |
| Afbeeldingen en clublogo's | NO-GO | Bestaande beeldcollectie niet per bestand vrijgegeven; routes afgeschermd |
| Merkrechten Veldio | NO-GO | Geen afgerond register- en overeenstemmingsonderzoek |
| AVG en privacy | NO-GO | Uitgever, termijnen, contracten en operationele inrichting ontbreken |
| Contactformulier | NO-GO voor productie | Lokale functionele tests geslaagd, echte provider/mailbox niet getest |
| YouTube en externe bronnen | NO-GO | Technische bescherming aanwezig, gebruiks- en accountbewijs/inrichting ontbreekt |
| Productiebeveiliging | NO-GO voor operationele vrijgave | Codeproblemen hersteld; daadwerkelijke geheimen, rechten, TLS/proxy, WAF en hosting niet geverifieerd |
| Android-productierelease | NO-GO | Geen productiesleutel, ondertekende release, fysieke toestelcontrole of Play-bevestiging |

**Geen definitieve GO.** Alleen externe juridische/administratieve stukken overhouden is nog niet bereikt: ook de daadwerkelijke hosting-, mail-, toestel- en ondertekeningscontroles moeten na geautoriseerde configuratie worden uitgevoerd. De lokaal uitvoerbare wijzigingen zijn aangebracht. Geen onbereikbare dienst of ontbrekend account is als werkend gemeld.

## 9. Oplevering en reproduceerbaarheid

- `Veldio-26-broncode.zip`: oorspronkelijke volledige bronset met gerichte wijzigingen, nieuwe rechtenmodules, tests, handleiding, rapport en checklist. De Android-basis-ZIP plus bestaande workflow en patches vormen het bouwpad. Geen `node_modules`, Gradle-caches, lokale signingbestanden of credentials opgenomen.
- `Veldio-26-test.apk`: nieuwe debugbuild, pakket `nl.voetbalhub.app1`, versie **4.32-veldio**, versionCode **60**, min API 24, target/compile API **36**.
- `Veldio-26-lanceerrapport.md` en `Veldio-26-productiechecklist.md`: bevindingen, grenzen en resterende acties.

APK SHA-256: `01d1103c4ac113dca3e1641e1809304bfb85d4306905635210589b8053d6aeac`.

Debugcertificaat SHA-256: `29cdc56abf94bf4bf43fd9f170dadbaec321112146fe37b54aa55e4a398e82b5`. Dit is geen geheime sleutel en geen productiecertificaat. De bronbestanden staan nog niet in de externe repository of hosting. Deze test-APK vereist voor inhoud de nieuwe serverversie; tegen een oude backend wordt onbevestigde inhoud geweigerd.

## 10. Officiële bronnen, geraadpleegd 31 oktober 2026

Onderstaande bronnen onderbouwen de genoemde algemene voorwaarden; zij bewijzen geen individuele aan Veldio verleende toestemming. In totaal zijn per bron uitsluitend beperkte samenvattingen gebruikt.

| Bron | Onderwerp |
|---|---|
| [VI voorwaarden](https://www.vi.nl/pagina/algemene-voorwaarden) | Geen algemene overdracht van content-/databankrechten |
| [VoetbalPrimeur voorwaarden](https://www.voetbalprimeur.nl/pagina/algemene-voorwaarden) | Rechtenvoorbehoud en wettelijke uitzonderingen |
| [Livesport voorwaarden](https://www.livesport.eu/terms-of-use/en) | Persoonlijk gebruik, databankrechten en geautomatiseerde extractie |
| [Eredivisie voorwaarden](https://eredivisie.nl/algemene-voorwaarden/) | Rechten op content en beeld |
| [API-Football voorwaarden](https://www.api-football.com/terms) | Eigen verantwoordelijkheid voor aanvullende toestemmingen |
| [BOIP zoeken](https://support.boip.int/hc/nl/articles/50736524162705-Hoe-zoek-ik-een-merk-op-in-het-Benelux-Merkenregister) en [beschikbaarheid](https://support.boip.int/hc/nl/articles/50736506728081-Hoe-controleer-ik-of-mijn-merk-beschikbaar-is) | Naam-, klank-, klasse- en beeldonderzoek |
| [BOIP register](https://www.boip.int/nl/merkenregister), [EUIPO eSearch](https://euipo.europa.eu/eSearch/) | Geen voltooide registerresultaten verkregen |
| [AP informatieplicht](https://autoriteitpersoonsgegevens.nl/nl/zelf-doen/privacyrechten/recht-op-informatie), [bewaartermijnen](https://autoriteitpersoonsgegevens.nl/nl/over-privacy/persoonsgegevens/bewaren-van-persoonsgegevens), [cookies](https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/internet-telefoon-tv-en-post/cookies) | Transparantie, bewaarbeleid en toestemming |
| [YouTube minimumfunctionaliteit](https://developers.google.com/youtube/terms/required-minimum-functionality) en [ontwikkelaarsbeleid](https://developers.google.com/youtube/terms/developer-policies) | Referer/app-identiteit, speler en gegevensverwerking |
| [YouTube embeds](https://support.google.com/youtube/answer/171780?expand=UseHTTPS&hl=en) | Officiële speler en beperkingen privacy-enhanced mode in apps |
| [AdMob toestemming](https://support.google.com/admob/answer/13554116?hl=en) | Gecertificeerde CMP voor gepersonaliseerde advertenties in betreffende regio's |
| [Resend AVG](https://resend.com/security/gdpr) | Opslag/doorgifte en retentie |
| [DejaVu licentie](https://dejavu-fonts.github.io/License.html) | Toegestaan fontgebruik en voorwaarden bij distributie |

De algemene AI-verordeningpagina vereiste JavaScript/robotcontrole. Er wordt geen nieuwe artikelspecifieke AI-wetsconclusie uit die onleesbare pagina afgeleid; laat de concrete transparantieplicht en eventuele redactionele uitzondering afzonderlijk toetsen.
