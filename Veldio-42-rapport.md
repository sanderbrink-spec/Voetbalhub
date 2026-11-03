# Veldio fase 42

Datum: 3 november 2026. Status: implementatie en verificatie in uitvoering. Geen volledige productieafronding geclaimd.

## Uitgangspunt en herstelpunt

Android-basis: work/veldio-41, 5b1796812a13324e8baf50ed6776cd7fcef03b73. Laatste geslaagde volledige fase41-workflow: 41670194925, APK-bron ef5b304995c0b1bf7b194f4ba2fcdcc7974efaa1. Laatste branchcommit voegt het auditrapport toe. Herstelbranch: recovery/veldio-41-5b17968. Fase42 staat afzonderlijk op work/veldio-42.

Render-backend draait op main, 5a24f59819907593ba5bb08a840a6fe3c269e12b, deployment dep-dbkf76c9v7es73bt9rag (live). De frontendbranch bevat wijzigingen uit oudere fasen die niet integraal over deze backend mogen worden gezet. Geen ongeteste backendmigratie uitgevoerd.

## Geïmplementeerd

- Nieuwe eigen fotorealistische AI-illustratie voor FC Groningen–Sparta: bal, groen-witte en rood-witte sjaals, fictief gevuld voetbalstadion. Geen tekst, logo's, herkenbare spelers of verzonnen wedstrijdmoment. 1920×1080 en kaartvariant 960×540. Asset en herkomsthash geregistreerd; originele generatie 1672×941, grotere variant is herschaald en bevat geen extra oorspronkelijk detail.
- Onderwerpselectie voor match/community/club/transfer/interview/speler/trainer/stadion, inhoudshash en controle van geregistreerde assethash, afmetingen, entropie en scherpte. Bestaande relevante goedgekeurde foto's blijven beschikbaar. Bij ontbreken van geschikt beeld volgt een eerder goedgekeurde, expliciet als AI-sfeerillustratie omschreven stadionfallback. Dit mag zich herhalen; het is geen nieuw uniek beeld per artikel.
- De Android-presentatie kiest het nieuwe Groningen–Sparta-beeld na de oude afbeeldingsregisters. SVG-standaarden bij nieuws worden vervangen door een herkenbare voetbalillustratie. Slideshow toont expliciet AI-illustratie. Geen automatische visuele veiligheidsbeoordeling geclaimd: semantische vrijgave van nieuwe assets blijft verplicht.
- Afzonderlijke NOS-pagina SAMENVATTINGEN, bereikbaar via het bestaande videomenu. Externe afspeelroute opent de officiële YouTube-app/browser. Zonder gecontroleerde selectie blijft NOS Sport direct bereikbaar; er verschijnen geen verzonnen wedstrijden of rondegetallen.
- Voorbereide YouTube Data API v3-collector: officiële handle nossport via channels, uploads via playlistItems, openbare video's via videos. Vereist twee clubnamen, expliciete speelronde, seizoen en recente publicatie; kanaalcontrole, deduplicatie, maximaal negen duels, behoud vorige selectie bij onvolledige nieuwe ronde, vervaltermijn en caching. Strikte criteria kunnen ook relevante video's uitsluiten. Een bestaande YOUTUBE_API_KEY is vereist. Er wordt geen abonnement geactiveerd. De uurtaak wordt pas automatisch actief wanneer de workflow op de standaardbranch is ingericht.
- Grote lege wedstrijdstrip van home verwijderd. Wedstrijden blijft als bestaande menuroute bereikbaar. Geen Flashscore-data geïntegreerd.
- Competitietegels behouden twee kolommen en bestaande achtergrond. Lettercirkels vervangen door zes eigen vectorillustraties. Dit zijn nadrukkelijk geen officiële logo's of nagebootste merken.
- Meer bestaat uit compacte klikbare lijstregels, drie secties, zeven regels: Over Veldio, Contact, App-instellingen, Meldingen, Advertentievoorkeuren, Privacyverklaring, Juridische informatie. Meldingen blijft behouden omdat het bestaande functionaliteit is. Dubbele grote quiz-, stadion- en columntegels zijn verwijderd. Origineel Veldio-logo en overige menu's blijven behouden.

## Nog open: doorlopende AI-generatie

De ingebouwde beeldgenerator is voor deze ene gecontroleerde illustratie gebruikt. Deze chatfunctie is geen achtergrond-API voor de Render-redactie. Er is geen operationele automatische provider voor 450 unieke beelden per maand aangetoond of geactiveerd. De nieuwe resolver werkt automatisch met goedgekeurde assets en fallback; een nieuwe unieke generatie voor elk toekomstig artikel blijft open. Ook de bestaande autonome tekstredactie is door deze wijziging niet hersteld of vrijgegeven.

Raming OpenAI GPT Image 2, 1536×1024, volgens geraadpleegde officiële prijstabel: medium $0,041 × 450 = $18,45/maand; high $0,165 × 450 = $74,25/maand. Jaarlijks $221,40 respectievelijk $891,00. Exclusief prompttokens, eventuele beeldcontrole, opslag, btw en hergeneraties. Bij 20% hergeneraties: $22,14 tot $89,10/maand. Dit is een raming voor een eventuele API, geen geactiveerde dienst en geen prijs voor 4K-generatie. De bestaande assets/fallbacks hebben geen nieuwe API-kosten per weergave. Voor activatie zijn een concreet maandbudget en veilig ingestelde servercredentials nodig.

## Rechten per competitie

| Competitie | Officieel logo | Uitvoering |
|---|---|---|
| Eredivisie | Merkpagina staat redactioneel gebruik toe, maar noemt ook voorafgaande goedkeuring van officiële merkcommunicatie. Geen specifieke vrijgave voor Veldio vastgesteld. B: onzeker binnen deze toepassing. | Eigen visualisatie; competitienaam ter identificatie. |
| Keuken Kampioen Divisie | Geen toepasselijke vrije logolicentie aangetoond. Publieke voorwaarden leesbaar op staging, productievoorwaarden niet uitleesbaar. B: onzeker. | Eigen visualisatie. |
| Champions League | UEFA verleent geen algemeen recht voor hergebruik van merken; schriftelijke toestemming nodig voor beoogd merkgebruik. C. | Eigen visualisatie. |
| Europa League | Zelfde UEFA-beperking. C. | Eigen visualisatie. |
| Conference League | Zelfde UEFA-beperking. C. | Eigen visualisatie. |
| Premier League | Officiële logoportal verleent mediaorganisaties een beperkte redactionele licentie, uitsluitend portalassets, ongewijzigd, met copyrightvermelding. Toepasbaarheid en beschikbaarheid juiste portalasset voor Veldio niet bevestigd; geen algemene vrije licentie. B. | Eigen visualisatie. Officiële externe verwijzing naar homepage, geen deeplink. |

De competitienaam ter feitelijke identificatie, het kopiëren van een beschermd logo, een externe verwijzing en het suggereren van een samenwerking zijn verschillende toepassingen. Namen worden uitsluitend identificerend gebruikt; Veldio noemt zichzelf onafhankelijk. Een publieke downloadknop is op zichzelf geen onbeperkte commerciële licentie. Voor eventuele logo-/datalicenties zijn geen verifieerbare openbare tarieven gevonden; kosten zijn onbekend en er wordt geen gratis toestemming geclaimd.

Bronnen:
- https://eredivisie.nl/meer/merk/ en https://eredivisie.nl/meer/merk/logo/
- https://eredivisie.nl/algemene-voorwaarden/
- https://keukenkampioendivisie.nl/algemene-voorwaarden (inhoud niet uitleesbaar)
- https://kkd-staging.southfields.digital/algemene-voorwaarden (alleen aanvullende aanwijzing; geen bewezen productiebeleid)
- https://www.uefa.com/termsconditions/
- https://www.premierleague.com/en/terms-and-conditions
- https://logo.premierleague.com/

## NOS en Flashscore

NOS bevestigt publicatie van Eredivisiesamenvattingen op NOS Sport YouTube. Dat is geen algemene licentie om video's te downloaden of herpubliceren. Alleen externe officiële YouTube-links zijn nu geïmplementeerd. Er is geen ingebedde speler op deze pagina; fullscreen, advertenties, regio- en afspeelbeperkingen worden door YouTube afgehandeld. Daardoor is fout 153 in de nieuwe route niet van toepassing. Geen geslaagde NOS-WebView-embedtest geclaimd. Voor toekomstige embeds: YouTube vereist clientidentificatie via Referer, correcte Android-WebView-inrichting en respect voor status.embeddable; deze vlag garandeert geen afspeelbaarheid. Geen thumbnails op eigen servers gekopieerd. De voorbereide metadata bevat officiële YouTube-thumbnail-URL's; de huidige fallbackpagina toont geen videominiaturen.

Flashscore-voorwaarden beperken gebruik tot persoonlijk gebruik en verbieden onder meer ongeautoriseerd embedden, aggregatie, scraping en hergebruik van de database. Geen gratis officiële commerciële widget/API met Eredivisiedekking aangetoond. Scenario C toegepast: groot blok verwijderd. Geen endpoints onderzocht of reverse-engineering uitgevoerd. Geen exacte licentieprijs gepubliceerd aangetroffen, dus geen prijs verzonnen.

Bronnen:
- https://over.nos.nl/nieuws/nos-start-aan-nieuw-eredivisieseizoen/
- https://www.youtube.com/@nossport
- https://developers.google.com/youtube/terms/required-minimum-functionality
- https://developers.google.com/youtube/iframe_api_reference
- https://developers.google.com/youtube/data/reference/rest/v3/videos
- https://www.livesport.eu/terms-of-use/en
- https://developers.openai.com/api/docs/guides/image-generation
- https://openai.com/policies/eu-terms-of-use/

## Teststatus

Lokaal: 329 Node-tests, 294 geslaagd, 35 Redis-afhankelijke tests overgeslagen; geen fouten. Zes nieuwe tests voor inhoudelijke beeldselectie, deterministische beeldidentiteit, gecontroleerde fallback, NOS-kanaal/ronde/seizoen en behouden vorige ronde. Volledige Android-projectvoorbereiding uit de bestaande ZIP en alle opeenvolgende productiepatches inclusief 41 en 42 geslaagd. De CI controleert aanvullend Redis, browser, Java, Android-build, ondertekening en API36-emulator. De uitkomst en APK-link worden na de workflow toegevoegd. Geen fysieke Galaxy S23-test uitgevoerd.
