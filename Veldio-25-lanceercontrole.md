# Veldio fase 25: juridische lanceercontrole

31 oktober 2026. Beoordeling voor Nederland en de EU.

**Eindadvies: NO-GO voor openbare lancering.** De redactionele techniek is ver gevorderd, maar een aantal gebruikte gegevens en beelden is niet aantoonbaar vrijgegeven. De definitieve uitgeversidentiteit, privacy-inrichting en ondertekende productie-release ontbreken. Een disclaimer, eigen formulering, bronvermelding of geslaagde test vervangt deze onderbouwing niet.

Dit is een technische en juridische risicoanalyse. Waar toepasselijkheid of een wettelijke uitzondering afhangt van de concrete omstandigheden, staat hieronder welke bevestiging van een jurist nodig is. Er is geen juridische zekerheid of goedkeuring door een toezichthouder geclaimd.

## Onderzochte versie en begrenzing

Uitgangspunt: `Veldio-24-broncode.zip`, ontvangen versie 2, SHA-256 `5e5e934ad333a334cd50e7b164dabb2a2cd732b1c85059e69d44c2bee905d400`, en het actuele `Veldio-24-controles.md`.

De server, redactionele controles, opslagtransacties, scripts, Android-basisproject, alle buildpatches, workflows, clientbestanden en beeldmanifesten zijn onderzocht. Officiële bronvoorwaarden en platformregels zijn opgezocht. Er zijn geen productiegegevens gewijzigd, berichten verzonden, betaalde AI-opdrachten gestart of externe publicaties gedaan. De broncodecorrecties moeten nog in de bestaande repository en hosting worden uitgerold. De werking van de momenteel geïnstalleerde app verandert niet door uitsluitend dit pakket te downloaden.

Niet als bewijs beschikbaar: licentiecontracten, accountgebonden API-abonnementen, definitieve uitgeversgegevens, actuele productiegeheimen, hostingregio's, mailboxinstellingen, Play Console-status en de bestaande productieondertekening. Een codearchief kan die gegevens niet bewijzen.

## 1. Wat fase 24 daadwerkelijk bevat

| Onderdeel | Aangetroffen implementatie | Wat daarmee wel en niet is bewezen |
|---|---|---|
| Daglimiet | Atomaire reservering in Redis; maximaal 20 automatische onderwerpen per Nederlandse kalenderdag, inclusief mislukkingen | Concurrerende reserveringen en daggrenzen lokaal testbaar. Geen garantie op 20 bruikbare artikelen. |
| Dubbele verwerking | Vaste bronpaaridentiteit, opgeslagen automatische concepten en hergebruik bij nieuwe runs | Herhaalde runs voorkomen nieuwe generatie voor hetzelfde onderwerp. |
| Conceptbehoud | `needs_review`, `rejected`, `publication_failed`, bewijsplaatsen en revisies | Afkeur en onderbreking blijven zichtbaar; handmatige beoordeling blijft mogelijk. |
| Feitencontrole | Twee primaire domeinen, bronpassages, actuele brondatum, namen/cijfers, categoriecontrole en tweede AI-beoordeling | Controlelogica aanwezig. Twee websites en twee AI-controles bewijzen niet dat ieder feit waar of rechtmatig verkregen is. |
| Beeld | Eigen Python-renderer, beeldhash, mediaopslag en zichtbaarheid in de desk | De automatische eenvoudige illustratie bevat geen foto, clublogo of herkenbare speler. Andere bestaande beeldroutes gebruiken die wel. |
| Publicatie | Revisiecontrole, actuele inhoudshash, duplicaatcontrole en één Redis-transactie | Gelijktijdigheid en verloren publicatiebevestiging worden afgevangen. |
| Workflow | Redis-integratietests, runrapporten en controle op serverprotocol 24 | Productie-uitrol en toekomstige echte nieuwsopdrachten zijn daarmee niet bewezen. |
| Android | Fase 24 veranderde de client niet; in het vorige rapport geen afgeronde nieuwe Gradle-build | De eerdere test-APK is geen bewijs van een fase-25-productierelease. |

Deze functies zijn behouden. Voor de toekomstige, juridisch toegestane automatische route draaien ketentests met fictieve bronnen en gesimuleerde AI- en media-antwoorden. De standaard productieblokkade wordt afzonderlijk getest. De fixturetoestemming wordt niet als echte licentie gebruikt.

## 2. Juridische bevindingen

De categorie **A** betekent: geen afzonderlijke rechtenblokkade aangetoond voor het beschreven, beperkte gebruik, met de genoemde technische begrenzing. **B** betekent: waarschijnlijk mogelijk, aanvullende verificatie nodig. **C** betekent: onvoldoende onderbouwd of in strijd met de aangetroffen voorwaarden zonder toestemming of toepasselijke uitzondering. Dit is geen algemeen verbod op voetbaljournalistiek.

| Onderwerp | Categorie | Bevinding en noodzakelijke actie |
|---|---|---|
| Eigen verslaggeving op onafhankelijk gecontroleerde feiten | B | Feiten en beschermde formuleringen zijn verschillende zaken. Schrijf zelfstandig, bewaar de feitelijke onderbouwing en toets hergebruik en verkrijging. Een vergelijkingsfilter van acht woorden is geen juridische vrijwaring. |
| Eigen grafische illustraties zonder externe beeldelementen | A/B | De eenvoudige automatische renderer tekent zelf. Geen afzonderlijke stock- of fotolicentie in die route aangetroffen. Controleer gebruikte fonts en eventuele externe elementen per daadwerkelijk ingezet bestand. |
| AI-tekst en AI-beelden | B | Commercieel gebruik van een model staat los van inbreuk in een specifieke output. Bescherming door auteursrecht vereist voldoende menselijke creativiteit. Leg tool, voorwaarden, inputrechten en creatieve/redactionele bewerking vast. |
| Clubnamen als redactionele identificatie | B | Niet ieder noemen van een club vereist een merklicentie. Gebruik mag geen commerciële verbondenheid suggereren. Jurist moet de daadwerkelijke presentatie beoordelen. |
| Clublogo's, spelersfoto's en stadionbeelden | C | In de API- en CDN-routes ontbreekt aantoonbaar toestemming voor de concrete bestanden. Identiteitscontrole en correcte credits bewijzen geen auteurs-, portret- of merkrechten. |
| Philips Stadion-foto | C | `stadium-assets.json` verwijst naar een PSV Museum & Tours-foto en noemt visuele controle. Een licentie voor herpublicatie ontbreekt. De foto is als bestand meegeleverd. Bewaren in de broncode is geen vrijgave. |
| Bestaande AI-wedstrijdcovers en portret | B/C | `reviewed:true` en `imageRights:cleared` zijn interne verklaringen. De creatiegeschiedenis, referentiebeelden en toestemmingen moeten per bestand worden bewaard. Het eigen portret van Sander vereist ook controle van fotograafrechten en toegestane bewerking. |
| VI en VoetbalPrimeur | C voor tekst-/beeldhergebruik | De huidige bronrestricties beperken deze uitgevers tot links. De officiële voorwaarden leveren geen algemene licentie voor vervangende nieuwsartikelen. Een abonnement of RSS-bereikbaarheid verandert dit niet. |
| Flashscore | C voor structurele overname | Geen automatische Flashscore-scraper aangetroffen. Wel een controleverwijzing voor wedstrijdfeiten. De voorwaarden beperken hergebruik en scraping. Een handmatig bezoek is geen toestemming om structureel de databank opnieuw op te bouwen. |
| Eredivisie.nl en ESPN | C | De actieve statistiekroute haalt complete competitiegegevens, standen en uitgebreide spelersstatistieken op. Eredivisie beperkt commercieel gebruik en geautomatiseerde extractie. Het script gebruikt bovendien een publiek ESPN-endpoint voor stadion- en historische gegevens. Een openbaar endpoint is geen API-licentie. |
| API-SPORTS / API-Football | B/C | Een geldig abonnement kan bepaalde datatoepassingen toestaan, maar het concrete abonnement en openbare herdistributie zijn niet bewezen. De leverancier geeft expliciet geen eigendomsrecht op aangeleverde logo's en foto's. Controleer ook publieke opslag op GitHub. |
| football-data.org | B/C, latent | Aangetroffen in bronbeleid, niet als primaire actieve statistiekroute. Bij gebruik gelden abonnement en attributie; grafische rechten moeten apart worden geregeld. |
| YouTube-speler | B | Officiële embed, zonder downloaden of vervangen van de videoadvertenties. Afzonderlijke toestemming toegevoegd. Controle van onder meer inhoudsstatus, kindercontent en correcte speleridentiteit blijft nodig. |
| YouTube-kanaalverzameling | C zolang route onbevestigd | Het script leest kanaal-XML en bewaart een selectie. Een feed is niet automatisch een algemene commerciële toestemming. De bestaande automatische verzamelroute is geblokkeerd. Een toegestane, gedocumenteerde route of schriftelijke bevestiging ontbreekt. |
| AdMob | C in de oude buildopzet | De Android-basis bevatte het SDK en manifestmetadata, maar geen aantoonbare CMP/UMP-afhandeling. De initializer was latent aanwezig. Ook een SDK kan buiten een zichtbare banner initialiseren. In de fase-25-build is het SDK verwijderd. |
| Privacy en contact | C vóór activering | Uitgeversidentiteit, grondslag, hostinglogs, mailboxbewaring en verwerkersafspraken waren onvoldoende uitgewerkt. Conceptverklaringen toegevoegd; verzending staat standaard uit totdat de inrichting is bevestigd. |
| Merk en handelsnaam Veldio | B, niet vrijgegeven | BOIP-register en officiële uitleg geraadpleegd, plus openbare zoekcontrole. Een volledig registeronderzoek naar overeenstemmende namen, beeldmerken en klassen is niet afgerond. Zoekmachineresultaten bewijzen geen beschikbaarheid. |

### Werkelijke bronnen tegenover het bronbeleid

De naam `officialDomains` in `automatic-editorial.json` is een technische selectie, geen rechtenregister. De huidige lijst omvat Ajax, AZ, PSV, Willem II, Feyenoord, Fortuna Sittard, FC Emmen, FC Den Bosch, FC Groningen, KNVB, KNVB Beker, Inter, Club Brugge, FC Twente, Eredivisie, FC Midtjylland en PEC Zwolle.

Bij Ajax en Feyenoord zijn uitdrukkelijke beperkingen op herpublicatie aangetroffen; bij AZ een rechtenvoorbehoud; bij KNVB en KNVB Beker gebruikersvoorwaarden met beschermde content. Eredivisie bevat bovendien een expliciete beperking voor geautomatiseerde verzameling en commercieel gebruik. Voor de overige genoemde domeinen is geen aan Veldio verleende hergebruiklicentie vastgesteld. Zoekresultaten over ticket- of webshopvoorwaarden zijn niet als nieuwslicentie gebruikt. PSV's voorgestelde disclaimerroute kon niet betrouwbaar worden gelezen; ook daar is dus geen toestemming aangenomen.

Er is bewust geen domein afzonderlijk juridisch goedgekeurd op basis van alleen de technische allowlist. De automatische verwerking van deze hele lijst staat uit. Afzonderlijk beperkte raadpleging en eigen verslaggeving kunnen onder andere omstandigheden mogelijk zijn; de jurist moet de beoogde methode per bron beoordelen.

### Databankrecht en bronvoorwaarden

Niet alleen complete kopieën kunnen problematisch zijn. Ook herhaalde systematische extractie van kleine delen kan onder het databankrecht vallen. De bestaande route verzamelt méér dan één los sportfeit. Dat maakt een onderbouwing voor structurele verwerking noodzakelijk. Er is geen stilzwijgende toestemming aangenomen uit openbare toegankelijkheid, `robots.txt`, het ontbreken van een API-sleutel of een HTTP 200-antwoord.

Een tekst- en datamininguitzondering is niet zonder meer een publicatielicentie. Toegang, rechtenvoorbehoud, doel en de uiteindelijke herpublicatie moeten afzonderlijk worden getoetst.

## 3. Wat daadwerkelijk is opgelost

| Correctie | Bestanden en gedrag |
|---|---|
| Automatische routes standaard geblokkeerd | `launch-policy.json/js`: vijf expliciete rechtenpoorten staan op `false`. Tien CLI-routes stoppen vóór inladen van hun overige code, externe verzoeken, AI-kosten en publicaties. Dit omvat automatisch nieuws, statistieken, coververversing, YouTube-selectie en oude publicatieproeven/columnopdrachten. |
| Serverbescherming voor automatische concepten | `/editorial-drafts` weigert automatische reservering. `/publish` weigert ook eerder goedgekeurde concepten met automatische herkomst. Menselijke conceptbewerking en bestaande handmatige controles blijven beschikbaar. Een automatisch concept moet voor publicatie zelfstandig handmatig worden beoordeeld en als nieuw handmatig concept worden opgeslagen. |
| Controleerbare status | `/health` toont `launchPolicyVersion:25` en de effectief uitgeschakelde automatische redactie. Het fase-24-opslagprotocol blijft intact. |
| Oude Worker-feedroute begrensd | Cloudflare-crons zijn standaard leeg; Worker-verwerking vereist daarnaast expliciete bevestiging van feedrechten. Een URL in de allowlist is onvoldoende. |
| Contactverzending standaard uit | De provider wordt niet aangeroepen zonder `CONTACT_PRIVACY_READY=1`. De bestaande validatie, herhaalbeveiliging, snelheidslimiet en foutafhandeling blijven behouden. Deze instelling is een operationele bevestiging, geen automatisch juridisch bewijs. |
| Juridische informatie beschikbaar gemaakt | Nieuwe `/privacy`- en `/legal`-pagina's. Beide tonen openlijk dat de verklaring en uitgeversgegevens nog niet compleet zijn. Geen fictief adres, KVK-nummer, licentie of bedrijfsnaam ingevuld. Links toegevoegd via Meer en het bestaande contactscherm. |
| YouTube-toestemming | Voor iedere geopende video een afzonderlijke keuze vóór het laden van de speler. Weigeren, privacy raadplegen en sluiten blijven mogelijk. Dit is geen AdMob-CMP en geen verklaring dat alle YouTube-verplichtingen al zijn vervuld. |
| Advertentieveiligheid | De laatste Android-buildpatch verwijdert de Ads-dependency, imports, initializerinhoud en manifestmetadata. Er is geen schijnoplossing met alleen niet-gepersonaliseerde advertenties toegepast. |
| Geheimen en Android-back-up | De gegenereerde Android-app bevat geen `API_FOOTBALL_KEY` in BuildConfig en leest die sleutel niet meer. De ongebruikte oude scorecode krijgt een lege waarde. Android-back-up is uitgeschakeld. |
| Actuele Play-target en releasepad | Laatste patch stelt compile/target SDK 36 in; AGP 8.9.1 en Gradle 8.11.1. Bestaande workflow kan expliciet een releasebundle bouwen met de bestaande productieondertekening. Ontbrekende signinggegevens stoppen die stap; een debug-sleutel wordt niet als productiesleutel aangemaakt. |

De bestaande slideshowcode en styling zijn niet gewijzigd. `home-features.html`, `home-model.js` en `HomeFeatureView.java` zijn byte voor byte gelijk aan fase 24. De twee logo-bestanden met PNG-extensie bleken JPEG-bytes te bevatten en veroorzaakten een Android-resourcefout. Ze zijn naar werkelijk PNG omgezet met exact gelijke gedecodeerde RGB-pixels. De overige bestaande afbeeldingen en portretbestanden zijn niet opnieuw bewerkt. Rechtenrisico's in al bestaande beeldbestanden zijn daardoor nog niet automatisch opgelost. De blokkade voorkomt nieuwe automatische verwerking; zij trekt bestaande media op externe hosting, oude APK's of reeds gepubliceerde artikelen niet in.

## 4. Privacy en Google Play Data Safety

De nieuwe privacytekst is een **concept voor de testversie**, geen afgeronde openbare privacyverklaring. Het opnemen van een lijst met ontbrekende gegevens voldoet niet vanzelf aan de AVG. De contactpoort mag pas worden geactiveerd nadat die gegevens werkelijk zijn ingevuld en afspraken gecontroleerd zijn.

| Gegevensstroom | Aangetroffen gedrag | Nog vast te stellen vóór de definitieve Data Safety-opgave |
|---|---|---|
| Favorieten, historie, zoekvoorkeuren | Lokale clientopslag | Controleer netwerkgedrag in de uiteindelijke release; lokaal blijven betekent niet automatisch dat andere appverzoeken geen gegevens verwerken. |
| Contact | Naam, e-mail, onderwerp en bericht naar API, daarna Resend en Gmail; standaard uit | Doel, grondslag, gegevenscategorieën, optioneel karakter, verwerker/zelfstandig verantwoordelijke, verwijderverzoeken en doorgifte. |
| Herhaalbeveiliging | Hash en verzendstatus maximaal 24 uur | Geen berichttekst in deze Redis-records. Hashes niet als anoniem presenteren. |
| Misbruikbeperking | Gehasht IP, maximaal 660 seconden in de gebruikte sleutel | Hostinglogs kunnen het oorspronkelijke IP daarnaast bewaren. |
| Hosting, feed en afbeeldingen | Verzoeken aan Render en GitHub/mediahosts | Werkelijke accesslogs, IP-verwerking, bewaartermijnen, regio's en eventuele verdere ontvangers. |
| YouTube | Miniaturen kunnen vóór spelerkeuze technische gegevens naar Google sturen; speler na toestemming | Beoordeel deze verwerking en legitimatie afzonderlijk. Spelertoestemming dekt geen al geladen miniatuur achteraf. Controleer cookies en apparaten-ID's met netwerkinspectie. |
| AdMob | Verwijderd uit fase-25-buildpad | Alleen 'geen advertenties' invullen voor de daadwerkelijke gecontroleerde artefactversie. Geen eerdere APK als bewijs gebruiken. |
| Redactionele AI | Groq krijgt inhoudelijke feiten en mogelijk namen van spelers | Accountafspraken, grondslag en eventuele journalistieke uitzonderingen; geen contactberichten naar deze route. |

Vul niet simpelweg 'geen gegevens verzameld' in. Definities van verzamelen, delen, verwerking door dienstverleners en tijdelijke verwerking moeten op de concrete release worden toegepast. De tabel is een invulbasis, geen reeds ingediende Play Console-verklaring.

Voor e-mail is geen fictieve bewaartermijn vastgesteld: een Redis-TTL verwijdert geen bericht bij Gmail of Resend. Resend beschrijft 30 dagen voor reguliere e-mail/loggegevens op gangbare abonnementen, maar het actuele account en afwijkende afspraken moeten worden gecontroleerd. Een EU-verzendregio betekent volgens Resend geen EU-opslag. Leg voor de mailbox een passende, onderbouwde termijn en daadwerkelijke verwijderprocedure vast. Controleer ook back-ups, hostinglogs en klachten/incidenten.

Voor de publieke privacy-URL vereist Google Play een bereikbare webpagina, plus toegang vanuit de app. De routes en links zijn geïmplementeerd, maar pas na uitrol bestaan zij op de bestaande productiehost. Controleer daarna HTTPS, bereikbaarheid zonder login en overeenstemming tussen privacytekst, app en Data Safety.

## 5. Openstaande licenties, bewijs en besluiten

| Nodig | Concreet op te leveren bewijs | Eigenaar van de vervolgstap |
|---|---|---|
| Beeldbestand per foto/logo/cover | Rechthebbende, bestand/hash, herkomst, toestemming of specifieke wettelijke grond, commercieel gebruik, kanaal, duur en credits | Uitgever, waar nodig jurist/rechthebbende |
| Statistiekroute | API-abonnement/licentie met dekking voor publieke app, afgeleide overzichten, caching en publieke herdistributie | Uitgever en dataleverancier |
| Nieuwsbronnen | Per bron toegestane manier van raadplegen, opslaan, AI-input en publiceren; geen algemene cluballowlist | Uitgever en jurist |
| YouTube | Bevestigde gedocumenteerde verkrijgingsroute, embedcontroles, kindercontentstatus en definitieve privacy/advertentiebeoordeling | Uitgever en ontwikkelaar |
| AI-tools en modellen | Toepasselijke accountvoorwaarden, modelvoorwaarden en bewijs van rechten op inputs/referenties | Uitgever |
| Naam Veldio en logo | Zoekrapport BOIP/KVK en relevante EU/internationale merken, inclusief gelijkende spelling/klank en relevante dienstenklassen, zoals software en nieuwsuitgave | Merkenjurist of gemachtigde |
| Uitgever | Volledige naam/exploitant, toepasselijk vestigingsadres en contactkanaal, ondernemingsstatus, KVK/btw waar van toepassing | Uitgever |
| Verwerkers en doorgifte | Actuele afspraken met hosting, opslag, mail en AI; regio's, subprocessors, maatregelen en overdrachtsgrond | Uitgever met privacyjurist waar nodig |
| Android-release | Bestaande productie/uploadkey, Play App Signing-status en passende hogere versiecode ten opzichte van het echte Play-record | Accounteigenaar en ontwikkelaar |
| Play Console | Ontwikkelaarsverificatie, Data Safety, leeftijdsdoelgroep, contentrating, nieuwsverklaring, privacy/contact-URL en teststatus | Accounteigenaar |

Een persoonlijke naam of woonadres uit eerdere gesprekken is niet automatisch een bevestigd zakelijk uitgeversadres. Daarom is dat niet als bedrijfsgegeven gepubliceerd. Ook is geen beschikbaarheid van Veldio geclaimd omdat een zoekmachine geen merkconflict laat zien.

## 6. Wat vóór lancering moet gebeuren

1. **Rechten en huidige inhoud afronden.** Inventariseer de bestaande productiefeed, mediabranche en ingebouwde beelden. Laat de PSV-foto, stadionfoto's, logo's, spelersportretten en realistische AI-covers beoordelen. Verkrijg aantoonbaar rechten of vervang alleen de betrokken inhoud in een afzonderlijk goedgekeurde vervolgstap. Bestaande artikelen met onduidelijke bron- of beeldrechten mogen niet ongemerkt blijven staan.
2. **Uitgever en privacy vastleggen.** Vul de echte uitgever in; bepaal en implementeer mailbox- en logbewaring, verwerkersafspraken en doorgifte. Pas beide juridische pagina's aan en controleer het daadwerkelijke netwerkgedrag. Activeer contact pas daarna.
3. **Merkonderzoek en juridische bevestiging.** Beoordeel merk/handelsnaam, databankrechten, bronvoorwaarden, beeld- en portretrecht, eventuele journalistieke uitzonderingen en AI-transparantie. Artikel 50 AI-verordening vraagt bijzondere aandacht bij AI-teksten over algemeen belang en realistische beelden; menselijke eindcontrole en concrete redactionele verantwoordelijkheid moeten aantoonbaar zijn als daarop een uitzondering wordt gebaseerd.
4. **Productiecontrole.** Werk de bestaande repository bij, rol de server uit en controleer `/health`: `launchPolicyVersion:25`, automatische redactie uit en opslag verbonden. Controleer de publieke juridische pagina's. Voer daarna één handmatige publicatie uit met volledig gecontroleerde feiten en rechten. Dit is nog niet in productie uitgevoerd.
5. **Ondertekende release en Play.** Bouw met de bestaande productie-identiteit, controleer de exacte pakketnaam `nl.voetbalhub.app1`, echte hoogste versionCode en API 36. Test Android 16, terugnavigatie, contact, video weigeren/toestaan/sluiten, leesbaarheid en afwezigheid van advertentieverkeer. Controleer eventuele native libraries op 16 KB-compatibiliteit. Dien vervolgens de juiste app- en nieuwsverklaringen in.

Voor bepaalde nieuwe persoonlijke Play-accounts geldt een gesloten test met minimaal 12 doorlopend ingeschreven testers gedurende 14 dagen vóór het aanvragen van productietoegang. Of dit account daaronder valt is onbekend. De bestaande eigen testgroep bewijst die Play-status niet.

**Geen automatische heractivering.** Laat `launch-policy.json` op de veilige standaard staan. Het wijzigen van een boolean of het zetten van `CONTACT_PRIVACY_READY=1` vervult de inhoudelijke voorwaarden niet. De bestaande redactionele kwaliteitscontrole mag ook na juridische vrijgave niet worden overgeslagen.

## 7. Wat gereed is en wat nog blokkeert

**Gereed voor gecontroleerde technische verificatie:** de bestaande vormgeving en slideshow, conceptopslag, revisies, duplicaatbeveiliging, handmatige redactieroutes, eigen eenvoudige illustratierenderer, juridische routes en standaardblokkades. Gebruik voor onvrijgegeven materiaal fictieve testgegevens.

**Nog niet gereed voor openbare publicatie:** huidige volledige beeldcollectie en externe dataverwerking, definitieve privacy- en uitgeversverklaring, merkbeschikbaarheid, productie-uitrol en ondertekende store-release. De bestaande externe media en oude APK's zijn niet door deze codewijziging opgeschoond.

**Bevestiging door jurist vereist:** toepasselijkheid van auteursrechtelijke uitzonderingen en databankrecht op de concrete methode; redactioneel logo-/portretgebruik; naam en logo Veldio; verwerkingsgrondslagen en journalistieke uitzonderingen; internationaal doorgeven van gegevens; AI-transparantie. Niet ieder onderdeel vereist noodzakelijk een betaalde licentie, maar een specifieke rechtsgrond moet wel aantoonbaar zijn.

## 8. Controlebewijs

De definitieve test- en buildresultaten staan in het onderstaande validatieblok. Fictieve nieuwsfixtures en gemockte providerantwoorden zijn geen verificatie van echte wedstrijdfeiten of productieaccounts.

| Controle | Resultaat |
|---|---|
| Volledige Node-suite met echte lokale Redis en browserketen | **201 geslaagd, 0 mislukt, 0 overgeslagen**. Inclusief de 13 Worker-tests. |
| Zes bestaande browserprogramma's | Geslaagd: contact, desk, Eredivisie, voorbeschouwing, persoonlijke omgeving en Veldio-home. Chromium headless build 1194 gebruikt. |
| Juridische pagina's | Beide routes bereikbaar zonder login; 320, 393 en 768 px zonder horizontale overloop. |
| Java ScreenHistoryTest | Geslaagd met Java 17. |
| Alle 16 workflows | YAML geldig. Beide Python-blokken van de ondertekeningsstap compileren. |
| Afhankelijkhedenscan | `npm audit --omit=dev`: 0 bekende kwetsbaarheden. |
| Bekende credentialpatronen in geselecteerde bronbestanden | Geen overeenkomsten. Geen volledige historische geheimenaudit van accounts/repositories. |
| Slideshow versus fase 24 | `home-features.html`, `home-model.js` en `HomeFeatureView.java` byte-identiek. |
| Logoformaat | Werkelijke PNG-bytes; gedecodeerde RGB-pixels exact gelijk aan de oorspronkelijke JPEG-inhoud. Pixelhash: `7d8ce0ede867aef1a19e6c00d93c02c5795c96b9917d8a51eb5c0dc157aa7aff`. |
| Android-debug en releasecompilatie | `:app:assembleDebug :app:bundleRelease`: **BUILD SUCCESSFUL**, inclusief release lintVital. AGP 8.9.1, Gradle 8.11.1, JDK 17.0.20, SDK 36. |
| Test-APK | `Veldio-25-test.apk`; pakket `nl.voetbalhub.app1`, versie `4.31-veldio`, versionCode `59`, target API `36`. Geldige APK v2-handtekening; debug-build, geen productievrijgave. |
| Werkelijke APK-inhoud | Geen Ads-SDK-classprefix, geen `API_FOOTBALL_KEY`-veld, geen native `.so`-libraries. Laatste merged manifest gecontroleerd op afwezigheid van Ads-initialisatie en advertentie-ID-permissie. |
| Releasebundle | Succesvol gegenereerd, **niet productie-ondertekend**. Geen certificaatbestand in `META-INF`. Niet als publicatieklare download aangeboden. De taaknaam `signReleaseBundle` bewijst geen aanwezige handtekening. |
| Productie/toestel/Play | Geen deploy, fysieke Android-test, live nieuwsbrief/publicatie of Play Console-indiening uitgevoerd. De releaseworkflow met echte geheime signinggegevens is niet uitgevoerd. |

APK SHA-256: `923e5df84acd8365cbf9333cece515ea87ca1c301365feb759259d80f5a27aa3`.

De eerste buildpogingen legden een lokale SDK/JDK- en netwerkconfiguratiebeperking bloot. De lokale toolchain is compleet gemaakt; officiële repositories zijn met de omgevingsproxy gebruikt. De aantoonbare broncodefout was JPEG-inhoud onder een PNG-bestandsnaam. Die fout is gecorrigeerd. Er zijn geen productie-repositories omgeleid en geen beveiligingscontroles zoals release-lint uitgeschakeld. De APK is lokaal nieuw gebouwd; het is geen hernoemde oudere APK.


## 9. Officiële bronnen

Geraadpleegd op 31 oktober 2026. Samenvattingen gelden alleen voor de genoemde onderwerpen; contracten op accountniveau kunnen afwijken. Bronvoorwaarden kunnen veranderen en bewijzen geen individueel aan Veldio verleende licentie.

| Bron | Gecontroleerd onderwerp |
|---|---|
| [VI voorwaarden](https://www.vi.nl/pagina/algemene-voorwaarden) | Rechten op content en databanken blijven bij VI/licentiegevers. |
| [VoetbalPrimeur voorwaarden](https://www.voetbalprimeur.nl/pagina/algemene-voorwaarden) | Geen algemene toestemming voor kopiëren of verspreiden; wettelijke uitzonderingen afzonderlijk. |
| [Flashscore/Livesport](https://www.livesport.eu/terms-of-use/en) | Content- en databankrechten, automatisering en scraping; daarnaast Nederlandse voorwaarden gecontroleerd. |
| [Eredivisie voorwaarden](https://eredivisie.nl/algemene-voorwaarden/) | Persoonlijk gebruik, commercieel hergebruik en geautomatiseerde extractie. |
| [Ajax disclaimer](https://www.ajax.nl/meer/disclaimer) | Herpublicatie en linken zijn verschillend behandeld. |
| [Feyenoord disclaimer](https://www.feyenoord.com/nl/disclaimer) | Schriftelijke toestemming voor overname/herpublicatie. |
| [AZ disclaimer](https://az.nl/club/juridisch/disclaimer) | Voorbehoud van rechten. |
| [KNVB gebruikersvoorwaarden](https://www.knvb.nl/info/3047/gebruikersvoorwaarden) en [KNVB Beker](https://www.eurojackpotknvbbeker.nl/info/163/gebruikersvoorwaarden) | Beschermde sitecontent en rechten van derden. |
| [API-Football](https://www.api-football.com/terms) | Logo's en afbeeldingen blijven onder mogelijke rechten van derden. |
| [football-data.org](https://www.football-data.org/about) | Abonnement, attributie en afzonderlijke grafische rechten. |
| [Databankenrichtlijn 96/9, art. 7 en 8](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=celex%3A31996L0009) | Substantiële en herhaalde systematische extractie. |
| [KNVB over beeld](https://www.knvb.nl/assist-bestuurders/regels-bepalingen/wetgeving/maken-en-gebruiken-van-beeld) | Auteursrecht, portretrecht en mogelijke bezwaren tegen publicatie. |
| [Auteursrecht.nl over AI](https://www.auteursrecht.nl/Auteursrechtwijzer/Werken-gemaakt-met-kunstmatige-intelligentie) | Menselijke creativiteit en risico's van concrete output. |
| [Groq Services Agreement](https://console.groq.com/docs/legal/services-agreement), [DPA](https://console.groq.com/docs/legal/customer-data-processing-addendum), [databeleid](https://console.groq.com/docs/your-data) | Inputrechten, verantwoordelijkheid voor output, verwerking en doorgifte. |
| [OpenAI open modellen](https://openai.com/open-models/) | Modellicentie van de gebruikte gpt-oss-familie, geen vrijgave van broncontent. |
| [AI-verordening](https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng/pdf) | Transparantie, in het bijzonder artikel 50. |
| [YouTube voorwaarden](https://www.youtube.com/t/terms) en [ontwikkelaarsbeleid](https://developers.google.com/youtube/terms/developer-policies) | Embed, geautomatiseerde toegang, privacy, kindercontent en advertentiebeperkingen. |
| [AdMob CMP-eisen](https://support.google.com/admob/answer/13554116?hl=en) | Gecertificeerde CMP voor gepersonaliseerde advertenties in onder meer de EER. |
| [AP informatieplicht](https://autoriteitpersoonsgegevens.nl/nl/zelf-doen/privacyrechten/recht-op-informatie) en [cookies](https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/internet-telefoon-tv-en-post/cookies) | Inhoud privacyverklaring en toestemming vooraf. |
| [Resend AVG](https://resend.com/security/gdpr) en [DPA](https://resend.com/legal/dpa) | Amerikaanse opslag, retentie en contractuele doorgiftewaarborgen. |
| [BOIP merkonderzoek](https://support.boip.int/hc/nl/articles/50736506728081-Hoe-controleer-ik-of-mijn-merk-beschikbaar-is) en [register](https://www.boip.int/nl/merkenregister) | Naam, gelijkende tekens en product-/dienstklassen; geen afgeronde vrijgave. |
| [KVK Naamchecker](https://www.kvk.nl/starten/naamchecker/) | Handelsnaam- en merkcontrole. |
| [Ondernemersplein identificatie](https://ondernemersplein.overheid.nl/wetten-en-regels/regels-voor-bedrijfscorrespondentie/) | Toepasselijke uitgevers- en bedrijfsgegevens. |
| [Play User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en) | Privacy-URL en overeenstemming van Data Safety. |
| [Play nieuwsbeleid](https://support.google.com/googleplay/android-developer/answer/9935326?hl=en) en [nieuwsverklaring](https://support.google.com/googleplay/android-developer/answer/16189314?hl=en) | Bron/auteur, actualisering, bereikbare contactinformatie en uitgeversverklaring. |
| [Play API-target](https://support.google.com/googleplay/android-developer/answer/11926878?hl=nl) en [Android tools](https://developer.android.com/build/releases/about-agp) | API 36 voor nieuwe indieningen; geschikte AGP-versie. |
| [Play testvereisten](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB) | Voorwaarden voor bepaalde persoonlijke accounts. |
| [Android 16 KB](https://developer.android.com/guide/practices/page-sizes) | Controle van native afhankelijkheden en uiteindelijke release. |

## Eindadvies

**NO-GO.** De blokkades zijn concreet en deels technisch afgeschermd. Een voorwaardelijke GO is pas verantwoord na aantoonbare rechtenvrijgave of gerichte vervanging van de betrokken content, een volledige privacy- en uitgeversinrichting, naamcontrole en succesvolle controle van de daadwerkelijk ondertekende productie-release. De goedgekeurde slideshow blijft behouden.
