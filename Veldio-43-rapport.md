# Veldio fase 43

Status: GEDEELTELIJK. Werkbranch `work/veldio-43`, basis `67b37771a9e8619fb8ab5fe68a4722c91c1c4062`. Geen volledige acceptatie geclaimd voordat de daadwerkelijke player-, build- en deploymentresultaten bekend zijn.

## Uitgevoerde wijzigingen

- VOLTOOID, code: geïsoleerde officiële YouTube IFrame Player API in een schermvullend native venster. Liggende oriëntatie, herstel oorspronkelijke oriëntatie, Android-terugknop, onShowCustomView/onHideCustomView, pauzeren bij achtergrond, één speler, bewaarde lijstpositie. Officiële bediening, branding en advertenties blijven bij YouTube. Veldio vraagt toestemming voordat de player laadt. Autoplay wordt niet omzeild; bij blokkade wordt de officiële afspeelknop gebruikt.
- VOLTOOID, metadata: vijf NOS Sport-video’s door officiële oEmbed gecontroleerd, met originele titels en thumbnails. Geen verzonnen publicatiedatums. De aangeleverde korte playlist `PLNykxTr12Azs` is niet als werkende lijst bevestigd: lokaal ontbreekt een Data API-sleutel. Alternatief is expliciet gelabeld als geselecteerde archiefvideo’s. Data API-collector controleert officiële NOS-kanaal-ID, publicatiestatus en embeddable. oEmbed biedt een insluitaanwijzing, geen garantie voor regio- of apparaatgebonden afspelen. Playerfouten behouden een externe YouTube-fallback.
- VOLTOOID, beeld: acht nieuwe eigen AI-illustraties, elk 1664×936 WebP, circa 184–308 KiB. Groningen–Sparta bevat leesbare clubnamen, clubkleuren en beweegmateriaal. Overige composities verschillen: doelnet, tribune, kleedkamer, entree en veld. Alle beelden zijn contextillustraties, geen werkelijke wedstrijdmomenten, echte stadionfoto’s of spelersportretten. De twee bestaande columns houden het eigen auteursportret. Hiermee zijn de tien actuele feedartikelen beoordeeld en de acht reguliere nieuwsbeelden vervangen in de nieuwe apppresentatie. Geen artikelteksten of datums aangepast.
- VOLTOOID, pipelinecode: onderwerp- en clubselectie, artikelinhoudshash, SHA-256, 64-bit perceptuele hash, bestandsgrootte, formaat en afmetingen; dubbele en bijna identieke afbeeldingen worden tegengehouden. Metadata overleeft conceptopslag. Beide automatische scripts gebruiken dezelfde resolver. Atomische Redis-publicatie voorkomt gelijktijdige toekenning van hetzelfde of vrijwel identieke goedgekeurde beeld. Ontbreekt passend vrijgegeven beeld, dan blijft het artikel `needs_review`; de algemene stadionfallback is uit deze automatische route verwijderd.
- GEDEELTELIJK, autonome redactie: geen betaalde beeldprovider geactiveerd. De tijdens deze opdracht gemaakte assets zijn vooraf gecontroleerd; ze vormen geen onbeperkte automatische generatiedienst. Nieuwe onbekende onderwerpen blijven ter beoordeling staan. De productiebackend heeft een andere, oudere architectuur dan de appbranch. Deze wordt uitsluitend met afgebakende, geteste mediaweergave bijgewerkt; geen integrale migratie van honderden branchbestanden.

## Officiële logo’s

VOLTOOID: beslisregister `logo-rights43.json`, zes competities en alle 38 ondersteunde clubs geïnventariseerd. Geen officiële logo’s toegevoegd zonder toepasselijke toestemming. De bestaande eigen emblemen en monogrammen blijven behouden.

| Onderdeel | Beslissing | Concrete oorzaak |
|---|---|---|
| Eredivisie | C, alternatief | Brand assets zijn beschikbaar; toepasselijke commerciële appvrijgave en goedkeuringsvoorwaarden niet onvoorwaardelijk bevestigd. |
| KKD | C, alternatief | Geen toepasselijke vrije licentie vastgesteld; voorwaardenpagina niet uitleesbaar. |
| CL, EL, Conference League | B, alternatief | UEFA-voorwaarden verlenen geen algemene merklicentie; schriftelijke toestemming ontbreekt. |
| Premier League | C, alternatief | Logoportal biedt beperkte redactionele licentie aan kwalificerende Media Users; persistent navigatiegebruik en correcte portalasset niet bevestigd. Geen algemene onrechtmatigheid van redactioneel gebruik geclaimd. |
| Sparta Rotterdam | B, alternatief | Club verlangt vooraf schriftelijke toestemming, nadrukkelijk voor commerciële online platforms. |
| Overige 37 clubs | C, alternatief | Geen per-club toestemming aangetoond. Een openbare download is niet als licentie behandeld. |

Bronnen, geraadpleegd 3 november 2026:
- https://developers.google.com/youtube/iframe_api_reference
- https://developers.google.com/youtube/terms/required-minimum-functionality
- https://eredivisie.nl/meer/merk/
- https://eredivisie.nl/meer/merk/logo/
- https://keukenkampioendivisie.nl/algemene-voorwaarden
- https://www.uefa.com/termsconditions/
- https://logo.premierleague.com/
- https://www.sparta-rotterdam.nl/copyright-clublogo/

## Tests en beperkingen

VOLTOOID, lokaal: volledige Node-suite en Python-regressies; exacte aantallen worden na CI vastgelegd. Android-project uit bestaande ZIP voorbereid met alle opeenvolgende productiepatches 31 t/m 43. Geen lokale Java/Gradle-compilatie: Java en Android SDK zijn hier niet geïnstalleerd; de bestaande GitHub Actions-toolchain voert deze uit. Geen fysieke Samsung Galaxy S23-test.

Nieuwe tests behandelen officiële API-filtering, verval van metadata, bronvervalsing, foutafhandeling, inhoudelijke beeldselectie, onveranderlijke afbeeldingskoppelingen, checksums, perceptuele duplicatie en behoud van beeldreview in concepten. Redis-test controleert atomische dubbelebeeldblokkering. Het apparaatscript maakt onderscheid tussen succesvolle fullscreen/navigatietests en daadwerkelijk afspelen bij YouTube.

## Productie-uitgangspunt

Render: `voetbalhub-redactie`, werkruimte `My Workspace`, service `srv-dbdn1duq1p3s73965iq0`. Live basis `5a24f59819907593ba5bb08a840a6fe3c269e12b`, deployment `dep-dbkf76c9v7es73bt9rag`. `main` bevat niet dezelfde backend als de frontendbranch. Logs bevatten historische fouten van een mislukte vorige deployment; de latere live deployment vervangt deze. Geen destructieve Git-actie of databasemigratie uitgevoerd.

## Build en oplevering

NIET UITGEVOERD bij aanmaak van dit rapport: definitieve CI/build-, APK-, emulator- en Render-resultaten. Deze sectie wordt vervangen door gemeten resultaten. Vereiste APK: `Veldio-43-install.apk`, aparte debugtestapp `nl.voetbalhub.app1.test43`, versie `4.51-phase43` (83), target API36. Deze aparte testapp deelt geen lokale voorkeuren met fase42; opslag wordt binnen de eigen installatie getest. Geen bestaande productiesleutel vervangen.

## Bestanden

Speler: `android-ui/java/YoutubePlayerView.java`, `VideoShelf40.java`, `HomeFeatureView.java`, `android-ui/assets/youtube-player43.html`, `scripts/patch-phase43.py`.

Metadata: `youtube-catalog43.js`, `scripts/youtube-catalog43.js`, `videos/catalog43.json`, `android-ui/assets/youtube-catalog43.json`, `.github/workflows/youtube43.yml`.

Beeld: `editorial-pipeline43.js`, `editorial-images43.json`, `media43.js`, `public/news43/`, `android-ui/assets/news43/`, `presentation-covers43.json`, `EditorialImages43.java`, `Branding.java`, `EditorialPhotos.java`, redactie-entrypoints en atomische publicatie.

Verificatie: fase43-tests, `scripts/android-phase43.py`, `.github/workflows/build.yml`. Generaties via ingebouwde beeldgeneratie, prompts: clubspecifiek fotorealistisch voetbalstilleven met sjaals in clubkleuren, passende compositie, geen officiële logo’s, herkenbare personen of wedstrijdfoto-claim. Groningen–Sparta is een bewerking van het goedgekeurde fase42-beeld met clubnamen en beweegmateriaal. Bronhashes en vrijgave staan in het beeldregister. Alle gebruikte eindassets staan in bovenstaande projectmappen.
