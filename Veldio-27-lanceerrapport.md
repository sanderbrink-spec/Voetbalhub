# Veldio fase 27: lanceerrapport

31 oktober 2026. **Definitief oordeel: NO-GO voor openbare lancering.**

De eigen redactieroute en twee advertentieposities zijn daadwerkelijk gebouwd. De oorspronkelijke 210 tests slagen opnieuw; de uitgebreide suite telt 221 geslaagde tests, zonder fouten of overgeslagen tests. De lokale keten gebruikt echte Redis-opslag, werkelijk gerenderde afbeeldingen en de bestaande atomaire publicatie. Bronfeeds en AI-antwoorden zijn daarbij fictieve testfixtures. Er is geen echte autonome nieuwsproductie, advertentievertoning, e-mailaflevering of productierelease geclaimd.

Er is geen openbare website gebouwd, geen productie-uitrol uitgevoerd, geen code naar de automatisch deployende hoofdbranch gepusht en niets bij Google Play ingediend. Het eerste product blijft de gratis Android-app. De minimale juridische webpagina's en de bestaande beheeromgeving blijven ondersteunend.

## 1. Uitgangspunt en nulmeting

De volledige actuele fase-26-rapportage en productiechecklist zijn gelezen, samen met de broncode en test-APK. De ontvangen broncode heeft SHA-256 `1d0166b2f920def1bbf57c3acc3d4019265dc69f432b167cd06b62760362457c`. De fase-26-APK heeft SHA-256 `01d1103c4ac113dca3e1641e1809304bfb85d4306905635210589b8053d6aeac`.

Vóór wijzigingen zijn 210/210 tests uitgevoerd en geslaagd, inclusief Redis en de Chromium-keten. De bestaande rechtenpoorten, normale publicatiecontroles, conceptrevisies, authenticatie, contactvalidatie, back-upbeperking in Android en advertentieblokkades zijn als uitgangspunt behouden.

## 2. Blokkades: opgelost en resterend

| Type | Fase-26-blokkade | Resultaat fase 27 |
|---|---|---|
| Technisch | Leeg register veroorzaakt handmatige goedkeuring per nieuwe eigen publicatie | Herbruikbare methodetoestemming met gebonden implementatie, inputs en categorieën; daarnaast controle en ondertekend bewijs per concreet artikel en beeld |
| Technisch | Geen bruikbare eigen autonome route naast geblokkeerde oude bronverzameling | Nieuwe route op vaste toegestane gestructureerde feitenfeeds, zonder onvrijgegeven HTML-scraping |
| Technisch | Nieuwe eigen beelden vereisen externe opslag/extra beeld-API | Eigen Sharp/SVG-renderer en mediaopslag op de bestaande backend; geen betaalde beeld-API nodig |
| Technisch | Productiefouten en herstel van publicatie | Ondertekend pending-record, revisiecontrole, herstart zonder opnieuw model/beeld te genereren en aanvullende duplicaatcontrole |
| Technisch | Intrekking van één automatisch artikel | Aparte geautoriseerde intrekkingsroute; methode- en artikelintrekking blokkeren feed en media |
| Technisch | Twee advertenties en CMP ontbreken | Twee compacte posities, GMA 25.5.0, UMP 4.0.0, actuele toestemmingspoort, privacy-ingang en test-ID's ingebouwd |
| Operationeel | Back-up/restore onbewezen | AES-256-GCM-export en herstel naar lege opslag getest; echte back-upplanning nog niet geconfigureerd |
| Juridisch | Geen aantoonbaar toegestane actuele productie-inputs | Niet extern oplosbaar zonder bron-/eigenaarsbewijs. Geen productiebron of methode fictief goedgekeurd |
| Administratief | Exploitant, privacykeuzes en merkonderzoek | Documenten aangevuld; ontbrekende gegevens en registertoegang blijven open |
| Extern | Contactprovider | Live bevestigd: `RESEND_API_KEY` en `CONTACT_FROM` ontbreken; geen echte verzending mogelijk |
| Extern | Hostingactualisatie, AdMob/Play en signing | Werkelijke hosting deels gecontroleerd; geen productiemutatie. Account-/signingbevestiging ontbreekt |

Ontbrekende toestemming is niet gelijkgesteld aan een bewezen juridische overtreding. Er is geen individuele inbreuk of algemene juridische goedkeuring vastgesteld op grond van alleen broncode. Een concrete rechtsgrond kan toestemming, een passende licentie of een toepasselijke wettelijke uitzondering zijn; deze moet het daadwerkelijke gebruik dekken.

## 3. De eigen autonome redactie

### 3.1 Nieuwe architectuur

Node/Redis op de bestaande Render-API is de primaire backend. Nieuwe modules: `autonomous-editor.js`, `editorial-methods.js`, `editorial-quality-model.js` en `own-editorial-art.js`. De bestaande conceptopslag en `editorial-publication.publishOnce` worden hergebruikt.

De nieuwe methode verwerkt maximaal drie kandidaten per run en maximaal twintig reserveringen per Nederlandse kalenderdag. Falen en twijfel tellen mee voor de daglimiet. Bron- en modelverzoeken hebben time-outs, bronnen hebben een bytegrens en ontvangen inhoud wordt als data behandeld. Dubbele feiten, gelijke of sterk overeenkomende koppen/teksten en herhaalde events worden tegengehouden. De publicatietransactie controleert bovendien of de eerdere duplicaatscan niet door een gelijktijdige publicatie is achterhaald.

Een kandidaat moet bij twee of drie geregistreerde, onafhankelijke broneigenaars dezelfde actuele hoofdgebeurtenis en minimaal vier concrete feiten hebben. Elke gebruikt feit moet door alle opgegeven feeds worden bevestigd. De brondatum moet binnen 24 uur liggen. De categorie moet overeenkomen en binnen de vooraf goedgekeurde bestaande categorieën vallen. Daarna schrijft de bestaande AI-generator de oorspronkelijke tekst en controleert een tweede AI-redacteur iedere tekstcomponent tegen feiten-IDs.

De eerste methode is bewust begrensd tot bevestigde clubmededelingen. Uitslagen, statistieken, citaten, geruchten en transferclaims worden niet via deze methode automatisch vrijgegeven. De eerdere Flashscore-regels blijven voor de bestaande handmatige wedstrijdroute gelden. Deze begrenzing voorkomt dat een algemene nieuws-AI ontbrekende gespecialiseerde wedstrijd- of transfercontrole vervangt.

**Productiestatus: niet geactiveerd.** `editorial-methods.json` en `content-rights.json` bevatten geen actieve productiegoedkeuringen. Er is geen geldig actueel feitenfeedpaar met volledige toestemming ontvangen. De techniek werkt met toegelaten fixtures, maar daarmee is de echte redactie niet operationeel bewezen.

### 3.2 Efficiënte goedkeuring zonder beveiliging te omzeilen

Een beoordelaar kan één concreet productiemodel vrijgeven onder scope `production-method`. De descriptor bindt methode-identiteit, codehashes, bron-URL's, onafhankelijke eigenaars, model, categorieën, gebruiksrechten en limieten. Een wijziging vereist herbeoordeling. De helper `scripts/method-review.js` maakt uitsluitend een **pending**-record; hij keurt niets goed.

Na een echte methodetoestemming hoeft niet elk nieuw eigen artikel opnieuw handmatig te worden vrijgegeven. De server controleert ieder artikel en beeld en maakt vervolgens met een afzonderlijk serversecret een HMAC-receipt. Die bindt tekst, bronhashes, concreet feitenbewijs, afbeeldingbytes, kwaliteitsscore, methodeversie en geldigheid. De publieke feed accepteert uitsluitend passend bewijs. Een ontvangen vinkje of een door de client meegestuurde receipt verleent geen rechten.

De receipt-sleutel blijft uitsluitend op de server. Een aparte schedulercredential kan alleen opdrachten voor de al goedgekeurde methode starten en hun status lezen. Hij kan geen gewone artikelen schrijven, concepten goedkeuren, afbeeldingen wijzigen of intrekkingen uitvoeren. De oude algemene CLI-poorten blijven uit; er is geen brede juridische allowlist heropend.

Het concrete feitenbewijs blijft bewaard zolang het gepubliceerde artikel bestaat. Bewijs voor niet-gepubliceerde pogingen en runrapporten hebben begrensde bewaartermijnen. De publicatie blijft aan de geldigheid van de methodetoestemming gebonden. Verlopen of ingetrokken bewijs maakt een bijdrage onzichtbaar; daadwerkelijke verwijdering of een contractuele wisverplichting vraagt daarnaast een gerichte beheershandeling.

### 3.3 Toetsbaar kwaliteitsmodel

Tien gelijkgewogen dimensies: juistheid, actualiteit, bronkwaliteit, oorspronkelijkheid, Nederlands, leesbaarheid, relevantie, kop, beeld en rechten. Vereist zijn een gemiddelde van minimaal 9/10, geen deelscore onder 8/10, geen open reviewbevindingen en een geldige feitenkoppeling voor kop, intro en elke alinea.

Buiten die score gelden harde controles op rechten, onafhankelijke bronnen, brondata, feitenovereenstemming, namen/cijfers, artikelstructuur, herhaling, bronoverlap, verboden claims en afbeeldingintegriteit. Een hoog cijfer kan geen harde fout opheffen. De AI-score is een operationele beoordelingsuitkomst, geen objectieve garantie van een journalistieke 9/10 of juridische juistheid. Er zijn in deze opdracht geen echte modelartikelen extern beoordeeld.

### 3.4 Herstel en intrekking

Een opdracht krijgt eerst HTTP 202 en een run-ID; dat is uitsluitend startacceptatie. De scheduler leest de uiteindelijke status. Een publicatiefout bewaart een ondertekend pending-pakket en de precieze conceptrevisie. Herstel controleert opnieuw toestemming, wijzigingen, afwijzingen en duplicaten. Het genereert tekst en beeld niet opnieuw. Een inmiddels afgewezen of gewijzigde versie wordt niet stilzwijgend hersteld.

`POST /editorial-revoke` vereist de beheersleutel, een artikel-ID en expliciete intrekking. Een schedulercredential kan dit niet. Intrekking van een methode of artikel blokkeert zowel de actuele publieke feed als het beeld. Afbeeldingen kunnen meerdere geldige artikelreferenties hebben; een nog niet gepubliceerde of ingetrokken verwijzing maakt een ander geldig gebruik niet onterecht onbereikbaar. Oude toegelaten clientcaches kunnen maximaal binnen hun resterende korte geldigheid zichtbaar blijven. Oude externe APK's of publicaties worden niet op afstand gewist.

## 4. Eigen beelden en kosten

De nieuwe automatische route tekent eigen vectorcomposities in zwart/groen met tekstuele clubnamen, veldlijnen en een duidelijke illustratieaanduiding. Zij gebruikt geen spelersfoto's, stadionfoto's, clublogo's, stockbeelden of externe referentiefoto's. Er zijn geen afzonderlijke betaalde beeldgeneratieverzoeken nodig. De reeds aanwezige Node/Sharp-stack verzorgt de rendering; de primaire backend hoeft voor deze route geen Python/Pillow te installeren.

De beeldhash en broncodeversie worden aan de concrete publicatie gebonden. Ontbrekende, gewijzigde of ingetrokken beeldintegriteit wordt geweigerd. De bestaande Python-renderer blijft beschikbaar voor de oude gecontroleerde bouw-/testroute.

Een echte nieuwe WebP-afbeelding is lokaal gerenderd en visueel bekeken. Die controle bewijst opmaak en uitvoer, niet de feitelijke juistheid van de gebruikte fictieve nieuwsfixture. De exacte inventaris van bestaande beelden en de benodigde bevestigingen staat in `Veldio-27-rechtenregister.md`.

Er zijn geen betaalde bronnen, AI-opdrachten, hostingresources of advertentiecampagnes gestart. Twee modelstappen per geschikt concept, daglimieten, hergebruik van concepten en eigen rendering beperken kosten. Een gratis plan of toekomstige advertentieopbrengst is niet gegarandeerd kostendekkend; accountquota, opslaggroei en bezoekersaantallen moeten worden gevolgd.

## 5. Twee advertentieposities en privacy

Er is een compacte positie direct onder het bestaande homegedeelte en een positie na de artikelinhoud. De bannerbreedte is begrensd, de slideshow blijft ongewijzigd en er zijn geen interstitials, app-open-advertenties of verplichte videoadvertenties toegevoegd.

Google Mobile Ads 25.5.0 en UMP 4.0.0 zijn werkelijk ingebouwd. Beide posities gebruiken uitsluitend de officiële Google-test-ID. De test-APK heeft `TEST_MODE=true`, `AUDIENCE_CONFIRMED=false`, `PRODUCTION_APPROVED=false` en `ACCOUNT_VERIFIED=false`. De zichtbare testpositie is geen advertentievertoning, advertentieverzoek of inkomstenbewijs.

De code vereist een actuele succesvolle UMP-update, een toelaatbare `canRequestAds()`-uitkomst, bevestigde doelgroep en een geldige configuratie voordat advertenties worden aangevraagd. Productiemodus vereist daarnaast een bevestigd account, productiegoedkeuring, geldige eigen identificaties en afzonderlijke units. Test-ID's zijn niet bruikbaar als productieconfiguratie. Geen oude lokale toestemmingsboolean vervangt UMP.

Na eventuele activering wordt eerst uitsluitend een tijdelijke bevestiging van 16 jaar of ouder gebruikt. Zonder bevestiging blijven advertenties uit en blijven artikelen toegankelijk. Er worden geen geboortedatum of opgeslagen leeftijdsgegevens gevraagd. Via Meer is advertentieprivacy bereikbaar. Bij gewijzigde keuzes, fouten of het verlaten van de app worden actieve adviews gestopt/vernietigd; verse controles zijn nodig bij terugkeer.

De automatische Ads-initialisatieprovider is uit het manifest verwijderd. Zowel de gewone advertentie-ID-permissie als de optionele AdServices-ID-/attributie-/Topics-permissies zijn uit deze build verwijderd. Dit bewijst geen volledige afwezigheid van Google-netwerkverkeer onder iedere toekomstige configuratie. Een werkelijke UMP-formulier-, advertentie- en netwerkcontrole met het juiste account is nog niet uitgevoerd.

Het AdMob-account moet nog eigen app-/unit-ID's, het privacybericht, doelgroepinstellingen en vereiste verklaringen bevestigen. Google UMP/CMP wordt niet als automatisch bewijs van volledige AVG-naleving gebruikt. De releasepoort weigert de huidige testconfiguratie als productierelease.

## 6. Echte hostingcontrole

Met de door de eigenaar bevestigde Render-workspace zijn bestaande resources alleen-lezen gecontroleerd:

| Controle | Werkelijk vastgesteld |
|---|---|
| Primaire API | `voetbalhub-redactie`, Node, één gratis instance, Frankfurt |
| Bron/deployment | Branch `main`, automatisch deployen op commits aan; daarom is niets gepusht |
| Live deployment | Commit `d4a6e603b3a2498367c2ffccf5c36880ab0d4b88`, status `live`; eerdere contactreparatie |
| HTTP-healthpad | Niet ingesteld; lokale fase 27 levert `/ready` met opslagafhankelijkheid |
| Redis | Beschikbaar, gratis plan, Frankfurt, `noeviction`, persistentie uit |
| Publieke HTTPS-health | Echt opgevraagd met TLS-certificaatcontrole: `ok:true`, opslag verbonden |
| Protocolversies live | Geen fase-26/27-lanceringsprotocol in de health-respons; de nieuwere beveiliging is niet hiermee uitgerold |
| Contact live | `configured:false`, ontbrekend: `RESEND_API_KEY`, `CONTACT_FROM` |

Een live deployment of geslaagde health-respons bewijst geen volledige productiebeveiliging. Secrets, alle toegangsrechten, privacycontracten, daadwerkelijke herstelplanning en de nieuwe codeversie zijn niet operationeel bevestigd. Er zijn geen Render-instellingen gewijzigd.

De lokale broncode heeft readiness, begrensde autonome jobs, gescheiden schedulerrechten en gecontroleerde SIGTERM/SIGINT-afhandeling gekregen. De oude Worker blijft buiten het primaire plan. Zijn bestaande rechtenpoorten blijven behouden; geen oude route is gebruikt om de nieuwe Node-controle te omzeilen.

Nieuw zijn `editorial-backup.js` en `scripts/backup-editorial.js`: versleutelde AES-256-GCM-back-up, integriteitscontrole, behoud van resterende TTL's en herstel zonder bestaande redactionele records te overschrijven. Contactinhoud en providercredentials behoren niet tot die back-up. Het herstel is met echte lokale Redis getest. Productiedata zijn niet geëxporteerd of hersteld. Een daadwerkelijke back-upplanning en veilig bewaren van de afzonderlijke configuratiebestanden, bewijsdossiers en sleutel zijn nog nodig. Herstel van data is geen herstel van hostingaccounts of geheimen.

## 7. Juridisch en administratief

### Bronnen en auteursrechten

Openbare toegankelijkheid is niet als hergebruiktoestemming beschouwd. Geen VI-, VoetbalPrimeur-, Voetbalzone-, Flashscore-, Eredivisie-, ESPN- of clubfeed is opnieuw vrijgegeven. De nieuwe route kan eigen of daadwerkelijk toegestane gestructureerde feiten gebruiken; de eigenaar moet toegang, opslag, AI-verwerking en commerciële afgeleide publicatie onderbouwen.

Wikidata is onderzocht als voorbeeld van gestructureerde CC0-data. Die licentie geldt niet automatisch voor foto's, andere namespaces of voor iedere mogelijke onderliggende aanspraak. Het is geen bewezen actueel onafhankelijk nieuwsfeedpaar en is niet geactiveerd. Zelf verzamelde feiten en vrijwillig toegestane primaire gegevens kunnen een goedkope route zijn; een concreet productie-inputpakket ontbreekt nog.

De actuele Groq-voorwaarden leggen inputrechten en controle van output bij de klant. De concrete account-/modelvoorwaarden en privacy-inrichting moeten worden bevestigd. De nieuwe beeldenroute gebruikt geen externe AI-beelddienst; er is dus geen nieuwe betaalde beeldmodellicentie nodig voor die route. Fonts en bestaande merk-/portretbestanden moeten overeenkomstig hun eigen voorwaarden worden behandeld.

### Merkonderzoek

BOIP en Merkcheck leverden via de beschikbare toegang alleen een invoerveld op. TMview leverde geen leesbare resultaten. KVK-zoeken was niet toegankelijk, EUIPO eSearch gaf 502 en WIPO Global Brand Database toonde een captcha. Daarom is geen afgeronde registercontrole geclaimd.

Gerichte openbare zoekopdrachten op Veldio en enkele schrijfvarianten leverden onder meer signalen voor een meubelserie en een digitale Etsy-winkel op; een zoekresultaat is geen merkregistratie of inbreukbewijs. De zoekingangen, bevindingen en beperkingen zijn in het rechtenregister bewaard. Naam, hoofdlogo en slogan zijn niet gewijzigd. Nog nodig zijn daadwerkelijke registerresultaten voor gelijkende namen/klanken en beeldmerken in passende software-, nieuws-/uitgevers- en eventuele platformdiensten.

### Uitgever, privacy en contact

De juridische pagina's zijn aangepast aan de werkelijke fase-27-code, de eigen redactie, advertentievoorbereiding, tijdelijke leeftijdsbevestiging en bewaarmethode. Zij blijven concepten totdat de echte exploitant, passende contact-/adresgegevens, verwerkingsgrondslagen, bewaartermijnen en accountafspraken zijn bevestigd. Een eerder genoemd privé-adres is niet als zakelijk uitgeversadres gebruikt.

Een extra algemene publieke website is geen voorwaarde voor het gekozen eerste product. Bereikbare juiste privacy-/contactinformatie voor de app blijft wel noodzakelijk. De bestaande juridische webpagina's kunnen daarvoor worden gebruikt.

Het contactformulier blijft via de bestaande HTTPS-serverroute verzenden, zonder mailapp. Live is vastgesteld dat twee providerinstellingen ontbreken. Resend-domein/DNS-status, accountrechten, afzender, privacyactivering en ontvangst in Gmail zijn daarom niet bevestigd. Er is geen echte e-mail verstuurd. Tests met provideracceptatie tellen uitsluitend als functioneel bewijs. Na configuratie moet één eigen niet-gevoelig bericht aantoonbaar door de provider worden geaccepteerd én in `redactie.veldio@gmail.com` aankomen.

## 8. Android en Google Play

De nieuwe APK is werkelijk gebouwd: pakket `nl.voetbalhub.app1`, versie **4.33-veldio**, versionCode **61**, min API 24, target/compile API 36. Het debugcertificaat is hetzelfde als in fase 26: SHA-256 `29cdc56abf94bf4bf43fd9f170dadbaec321112146fe37b54aa55e4a398e82b5`.

GMA 25.5.0 bevat nieuwere Kotlin-metadata. De eerste bouwpoging met de oudere toolchain gaf metadatawaarschuwingen. De buildketen is gericht bijgewerkt naar AGP 8.13.2 en Gradle 8.13, conform de officiële compatibiliteitsinformatie. De uiteindelijke debugbuild en releasecompilatie slagen, inclusief release-lint. Er zijn geen controles uitgezet om de build te forceren.

De bestaande releaseprocedure is verder aangescherpt: zij weigert testadvertentieconfiguratie, ontbrekende signinggegevens, het debugcertificaat en een certificaat dat niet overeenkomt met de vooraf bevestigde uploadcertificaatfingerprint. Hiervoor is aanvullend `RELEASE_CERT_SHA256` nodig. Er is geen vervangende productiesleutel gegenereerd.

Een unsigned releasebundle is lokaal alleen voor compilatiecontrole gemaakt. **Geen `Veldio-27-release.aab` wordt opgeleverd**, omdat de bestaande productie-identiteit niet beschikbaar en gecontroleerd is. Een interne taak met de naam `signReleaseBundle` is geen bewijs van ondertekening. Werkelijke hoogste Play-versionCode, App Signing, accountverificatie, doelgroep, nieuwsverklaring, Data Safety en toestel-/updatetest blijven open.

## 9. Verificatiebewijs

| Controle | Resultaat en grens |
|---|---|
| Nulmeting | 210/210 geslaagd, geen skips |
| Definitieve Node-suite | **221/221 geslaagd, 0 fouten, 0 skips** |
| Nieuwe autonome keten | Echte Redis, echte HTTP-serverroute, werkelijk eigen WebP, HMAC/bron-/inhoudshashes en atomaire publicatie; feeds, rechtenfixtures en AI-antwoorden gesimuleerd |
| Negatieve routes | Geen methodebewijs betekent geen fetch/model; bronuitval, gewijzigde inputs, afkeur, onjuiste coverage, te lage score, duplicaten, intrekking en onbevoegde scheduleracties getest |
| Herstel | Publicatiefout hersteld zonder hergeneratie van tekst/beeld; huidige toestemming/revisie en duplicaten opnieuw gecontroleerd |
| Back-up | Echte Redis-export/herstel, TTL, foute sleutel, gewijzigde ciphertext/tag en weigeren van overschrijven getest |
| Zes browsersuites | Contact, redactiedesk, Eredivisie, voorbeschouwing, persoonlijke omgeving en home geslaagd met fixtures/mocks |
| Advertentieprivacy | Java-test met 64 combinaties en geldige test-ID's geslaagd; echte GMA/UMP-dependencies gecompileerd; geen echt formulier of advertentie ontvangen |
| Navigatie | Java ScreenHistoryTest geslaagd |
| Vormgeving | Slideshowassets, model, hoofdlogo en portret byte-identiek aan fase 26; homeassets ook binnen de gebouwde APK gecontroleerd |
| Workflows | Alle 17 YAML-bestanden en ingebedde Python-blokken geparseerd/gecompileerd; geen live workflow gestart |
| Afhankelijkheden | `npm audit --omit=dev`: 0 bekende kwetsbaarheden op uitvoeringsdatum; dit omvat geen volledige audit van alle Android-transitieven of repositoryhistorie |
| APK | Geldige debughandtekening, geen ingebedde sport-API-sleutel en geen native `.so`; Ads-initprovider en de genoemde ID/AdServices-permissies ontbreken in merged debug/release-manifesten |
| Productiesigning | Huidige testconfiguratie wordt door release-preflight geweigerd; interne AAB is niet productie-ondertekend |
| Niet uitgevoerd | Werkelijke AI-providerproductie, mailaflevering, Google CMP-/ad-netwerkmeting, fysieke toesteltest, Play-indiening en nieuwe productie-uitrol |

De eerdere tests zijn niet verwijderd. De health-versieassertie is naar de nieuwe serverfase aangepast. Nieuwe tests gebruiken nadrukkelijk fictieve toestemmingen uitsluitend binnen geïsoleerde testomgevingen; die staan niet als productiegoedkeuring in de meegeleverde registers.

## 10. Definitieve beoordeling per onderdeel

| Onderdeel | Status | Onderbouwing |
|---|---|---|
| Technische stabiliteit | GO voor lokale testversie | Kritieke tests en builds geslaagd; operationele productie apart beoordelen |
| Eigen AI-redactie | VOORWAARDELIJKE GO | Complete beperkte methode technisch getest; echte toegestane inputs en provideruitvoering ontbreken |
| Automatische publicatie | VOORWAARDELIJKE GO | Serverbewijzen, transacties, herstel en intrekking werken lokaal; geen echte productierun |
| Auteursrechten | NO-GO | Productiebronnen/rechtsgrond nog niet aangeleverd en beoordeeld |
| Afbeeldingen | VOORWAARDELIJKE GO voor eigen nieuwe route | Eigen renderer en integriteit werken; bestaande collectie/merk-/portretdossier niet volledig vrijgegeven |
| Merknaam Veldio | NO-GO | Registeronderzoek niet afgerond |
| AVG en privacy | NO-GO | Uitgever, keuzes en accountafspraken ontbreken |
| Contactformulier | NO-GO | Werkelijke verzending/ontvangst ontbreekt; live ontbreken twee instellingen |
| AdMob | VOORWAARDELIJKE GO | Testvoorbereiding en poorten aanwezig; account, CMP-configuratie en echte netwerktests ontbreken |
| Hosting | NO-GO | Live draait oudere code; readiness/back-upinrichting en volledige beveiligingsconfiguratie nog niet toegepast/gecontroleerd |
| Android-release | NO-GO | Debug gereed, echte productieondertekening niet beschikbaar |
| Google Play | NO-GO | Consolevereisten en productie-identiteit niet bevestigd |

**Geen definitieve of algemene voorwaardelijke GO voor openbare lancering.** De deelstatussen beschrijven technische gereedheid, geen toestemming om de app alvast publiek uit te rollen. De uitsluitend persoonlijke resterende acties staan in `Veldio-27-laatste-acties.md`.

## 11. Oplevering en reproduceerbaarheid

Het bronpakket bevat de volledige eerdere bronset, de nieuwe modules, tests en bouwpatches. Het Android-bouwpad blijft de ingesloten basis-ZIP plus de stappen uit `.github/workflows/build.yml`, inclusief `patch-ads27.py` na de bestaande veiligheids-/vormgevingspatches. AGP 8.13.2, Gradle 8.13, JDK 17 en SDK 36 worden gebruikt. De primaire autonome backend gebruikt alleen de bestaande Node-dependencies; de oude Python-tests vragen nog hun bestaande Pillow-omgeving.

Geen `node_modules`, buildcaches, `.keystore`/`.jks`, productiecredentials, privécontracten of unsigned AAB in het oplever-ZIP. De lege productie-registers zijn bewust leeg.

APK SHA-256: `dbd4f06382729c61bb7295d884f2fcd0695cf51ce3c820ffa9c6d1d96a38be42`.

## 12. Officiële bronnen en onderzoek

Geraadpleegd op 31 oktober 2026. Voorwaarden zijn algemeen; een accountcontract en de concrete toepassing kunnen aanvullende beoordeling vereisen.

- [Google UMP](https://developers.google.com/admob/android/privacy), [testadvertenties](https://developers.google.com/admob/android/test-ads), [SDK-inrichting](https://developers.google.com/admob/android/quick-start): actualiseren van consent, privacy-ingang, SDK-configuratie en officiële testidentificaties.
- [AGP 8.13.2](https://developer.android.com/build/releases/agp-8-13-0-release-notes) en [Kotlin/D8/R8](https://developer.android.com/build/kotlin-support): compatibiliteit van de gebruikte toolchain.
- [Render deployments](https://render.com/docs/deploys) en [health checks](https://render.com/docs/health-checks): auto-deploy en HTTP-readiness. De Markdown-ingangen konden niet worden gelezen; de HTML-referenties wel.
- [Wikidata licensing](https://www.wikidata.org/wiki/Wikidata:Licensing): CC0 voor genoemde gestructureerde namespaces, geen algemene beeldlicentie of actualiteitsgarantie.
- [Groq Services Agreement](https://console.groq.com/docs/legal/services-agreement): verantwoordelijkheid voor inputrechten en outputcontrole, plus afzonderlijke modelvoorwaarden.
- [Resend AVG](https://resend.com/security/gdpr): opslag/doorgifte en retentie; echte accountconfiguratie nog te bevestigen.
- [Uitgevers-/bedrijfsgegevens](https://ondernemersplein.overheid.nl/wetten-en-regels/regels-voor-bedrijfscorrespondentie/): benodigde informatie afhankelijk van exploitatievorm en toepasselijke plichten.
- [BOIP](https://www.boip.int/nl/merkenregister), [Merkcheck](https://www.boip.int/nl/merkcheck), [TMview](https://www.tmdn.org/tmview/), [EUIPO](https://euipo.europa.eu/eSearch/) en [WIPO](https://branddb.wipo.int/): geen volledige resultaten verkregen.
