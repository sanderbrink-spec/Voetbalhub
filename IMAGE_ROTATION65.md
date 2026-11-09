# Veldio | Beeldbibliotheek en rotatie v65

## Vastgelegde ontwerpafspraken
1. Premium 3.0, fotorealistische eigen AI-illustraties, verhouding 16:9, mobiele WebP met leesbare typografie.
2. Doel is **zes visueel verschillende, beoordeelde illustraties per exact onderwerp**. Roulatie bij het opnieuw openen of verversen. Gebruik minder dan zes totdat er zes veilige varianten bestaan; vul de ontbrekende plaatsen nooit met onjuiste foto's.
3. Voor wedstrijden moeten **thuisclub, uitclub en hun volgorde exact overeenkomen** met de gecontroleerde wedstrijdregistratie. Een afbeelding van Groningen-Ajax hoort nooit bij Groningen-PSV, ook niet als beide groen of rood dragen.
4. Alleen de originele V op de bal en het originele Veldio-beeldmerk subtiel als watermerk. Geen officieel club- of competitielogo. Namen van beide clubs leesbaar; tenues zijn eigen clubkleur-illustraties.
5. Stadionarchitectuur mag op het thuiskader lijken, maar een AI-illustratie mag niet als echte wedstrijdopname worden gepresenteerd. Geen echte of herkenbare speler simuleren. Vermijd fictieve uitslagen, doelpunten, weer-/tijdclaims en sponsor-/merklogo's.
6. Kies een dagdeel uitsluitend bij een gecontroleerde aftraptijd én locatie. Bij ontbrekende gegevens alleen beeld met dagdeel 'neutral'. Een beeld met kunstlicht bij een middagduel wordt niet gekozen.
7. Voor transfers, geruchten, contracten, blessures, tactiek, clubnieuws, jeugd en supporters **eigen categorie-illustraties**, niet een willekeurige wedstrijdposter. Geen beeld dat suggereert dat een contract is getekend of een blessure is bevestigd zonder journalistieke basis.
8. Alleen bibliotheekbeelden met goedgekeurde rechten, betrouwbare metadata en kloppende SHA-256 mogen verschijnen; extern gelicenseerde of handmatig goedgekeurde artikelbeelden niet overschrijven.
9. De API past de veilige varianten ook toe op reeds gepubliceerde items in current/archive/all. De inhoud van historische artikelen en hun feitencontrole blijft ongewijzigd.
10. Geen nieuwe betaalde API's, geen nieuwe externe beeldservice. Bewaak snelheid, bandbreedte, beeldkwaliteit en toegankelijkheid.

## De tien gegenereerde afbeeldingen van 9 november 2026
De beelden zitten in het aparte overdraagbare ZIP-pakket **Veldio_matchbeelden_10_en_rotatieregels.zip**, samen met `manifest.json` en SHA-256-controles. De pakketinformatie is nog **niet** hetzelfde als productie-installatie: de binaire assets moeten op hun definitieve GitHub-bestemming worden geüpload, individueel visueel/juridisch worden nagekeken en vervolgens als `approved` worden geregistreerd. Tot dat moment blijft het huidige goedgekeurde beeld in gebruik.

| Beeld | Combinatie | Referentie / licht |
| --- | --- | --- |
| 01 | FC Groningen - Ajax | Euroborg, avond |
| 02 | PSV - FC Twente | Philips Stadion, avond |
| 03 | Feyenoord - AZ | De Kuip, schemer |
| 04 | FC Utrecht - sc Heerenveen | Galgenwaard, regenavond |
| 05 | Go Ahead Eagles - NEC | De Adelaarshorst, schemer |
| 06 | Ajax - PSV | Johan Cruijff Arena, avond |
| 07 | AZ - FC Groningen | AFAS Stadion, dag |
| 08 | FC Twente - Feyenoord | De Grolsch Veste, avond |
| 09 | sc Heerenveen - PEC Zwolle | Abe Lenstra Stadion, winteravond |
| 10 | NEC - FC Utrecht | Goffertstadion, avond |

**Belangrijk:** dit zijn tien verschillende wedstrijdparen, dus nog geen reeks van zes per afzonderlijke combinatie. Vul maximaal aan met vijf extra onderling afwijkende, gecontroleerde versies per paar. Dezelfde logica geldt per niet-wedstrijdonderwerp.

## API
- `image-rotation65.js` kiest maximaal zes goedgekeurde bestanden uit `image-library49.json`, met exact onderwerp en dagdeel.
- `GET /articles` past rotatie toe in current, archive en all, ook bij `?id=...`. De Redis-artikelen worden niet aangepast.
- Elke API-respons bevat bij beschikbare varianten `imageVariants`, `imageRotation`, een expliciete illustratiecaption en bestaande rightsvelden.
- Als geen veilige variant beschikbaar is, wordt niets vervangen. De bestaande beeldroute en offline fallback blijven actief.
- `image-rotation65.test.js` toetst onderwerp, rechten, dagdeel, beperking tot zes en bestaande artikelen.

## Volgende veilige importstap
Plaats de tien WebP's vanuit de ZIP onder `public/match-rotations65/`. Voeg per bestand een exact `image-library49.json`-record toe met `file`, `sha256`, `categories: ['preview','report']`, `clubs`, `daypart`, `reviewer`, `rightsEvidence`, `caption` en `approval: 'approved'` **pas na** beoordeling. Noem de afbeelding een AI-illustratie, geen authentiek fotoverslag. Test de exacte clubkoppeling en verversing in de API en op het Android-toestel voordat de nieuwe app-build als GO wordt gemeld.
