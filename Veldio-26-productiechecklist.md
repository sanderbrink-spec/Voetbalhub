# Veldio fase 26: productiechecklist

31 oktober 2026. **Huidige status: NO-GO. Geen productie-uitrol toegestaan zonder expliciete opdracht.**

Een vinkje betekent aantoonbaar afgerond met vastgelegd bewijs. Een boolean, disclaimer of testfixture is geen bewijs. Bewaar contracten en credentials afzonderlijk van de publieke broncode.

## 1. Rechten en huidige inhoud

| Actie | Wie | Vereist bewijs / acceptatie |
|---|---|---|
| Inventariseer echte feed, externe mediabranche en ingebouwde beelden | Uitgever/beheerder | Lijst van artikelen, gebruikte bronmethode en beeldbestanden met SHA-256, huidige publicatiestatus en eigenaar |
| Beoordeel tekst-/datagebruik per bron | Uitgever, zo nodig IE-jurist/leverancier | Toestemming/licentie of concrete wettelijke grond voor ophalen, bewaren, AI-input, caching en beoogde commerciële publicatie |
| Regel VI/VP/Voetbalzone indien méér dan toegelaten linken nodig is | Uitgever/rechthebbende | Schriftelijke dekking voor daadwerkelijk voorgenomen gebruik; anders link-only houden |
| Bevestig Flashscore-/statistiekmethode | Uitgever/dataleverancier | Geen structurele databankovername zonder toereikende grond; eventueel geschikt gelicentieerd alternatief |
| Controleer API-Football/andere accounts | Accounteigenaar | Abonnement, competitie-/publicatievoorwaarden, caching, attributie en afzonderlijke beeldrechten |
| Beoordeel PSV-stadionfoto, overige covers/logo's en portret | Uitgever/rechthebbende | Bestandshash, herkomst, gebruiksdoel, kanaal, duur, credits, eventuele portret-/fotograafrechten en AI-inputgeschiedenis |
| Stel AI-/modeldossier op | Uitgever | Actuele tool/accountvoorwaarden, inputrechten, noodzakelijkheid persoonsgegevens en outputcontrole |
| Controleer AI-transparantie voor concrete tekst/beelden | Verantwoordelijk redacteur, waar nodig jurist | Besluit over aanduidingen en aantoonbare redactionele verantwoordelijkheid |
| Geef uitsluitend beoordeelde versies vrij | Beheerder | Rechtenregister volgens `RIGHTS_REVIEW.md`, geen contracten of geheimen in het ZIP |
| Trek eventueel oude onrechtmatig gebruikte inhoud in | Uitgever/beheerder | Gericht plan voor echte host/mediafeed en oude distributie; niet alleen verbergen in nieuwe API |

De bestaande renderroute kan eigen eenvoudige voetbalillustraties maken. Dat is een bruikbaar alternatief voor onvrijgegeven foto's, maar het concrete bestand en eventuele externe onderdelen moeten nog steeds worden beoordeeld. Naam, hoofdlogo en slideshow niet wijzigen.

## 2. Naam en uitgever

- [ ] Voltooi BOIP-, KVK-, EUIPO/TMview- en zo nodig internationaal naamonderzoek, inclusief overeenstemmende klank/spelling en beeldmerken. Bewaar resultaten, datum, status, klassen en inhoudelijke conclusie. Laat relevante treffers beoordelen door een merkenprofessional.
- [ ] Bevestig de juridische exploitant en het toepasselijke vestigingsadres. Controleer ondernemingsstatus, KVK/btw en toepasselijke informatieplichten. Publiceer geen privé-adres zonder bevestiging dat dit de juiste uitgeversinformatie is.
- [ ] Werk `/privacy` en `/legal` af met de echte gegevens. Controleer op testtekst, voorbehouden en ontbrekende velden. Het redactiecontact is `redactie.veldio@gmail.com`.

## 3. AVG en verwerking

- [ ] Leg per gegevensstroom doel, grondslag, categorieën, ontvangers, rechten en passende bewaartermijn vast: hosting/logs, Redis, Gmail, Resend, media, YouTube en redactionele AI.
- [ ] Controleer contracten, actuele verwerkersrollen, regio's, subprocessors en toepasselijke doorgiftewaarborgen. Download de echte accountdocumenten waar nodig.
- [ ] Leg verwijdering vast voor mailbox, spam/prullenbak, providerlogs, back-ups, hosting- en beveiligingslogs. Test een niet-gevoelig verwijderverzoek en de uitvoerbaarheid van de termijn.
- [ ] Voer een netwerkcontrole uit op de uiteindelijke Android-release. Controleer vooral Google vóór/na videotoestemming, advertentieverkeer, oude caches en verzoeken aan beeldhosts.
- [ ] Vul Play Data Safety op basis van de gecontroleerde release in. Geen algemene claim 'geen gegevens verzameld' zonder die controle.

## 4. Contactformulier echt werkend maken

| Nodig | Concrete uitvoering |
|---|---|
| Resend-account en geverifieerd afzenderdomein | Verifieer DNS/DKIM/SPF en toepasselijke afzenderrechten in de providerconsole. Gmail-redactieadres is de ontvanger, niet automatisch een geverifieerde afzender. |
| `RESEND_API_KEY` | Alleen als serversecret; niet in APK, workflowoutput, rapport of broncode |
| `CONTACT_FROM` | Werkelijk geverifieerde afzender, bijvoorbeeld een toegestaan adres op het eigen domein; geen fictief domein overnemen |
| `CONTACT_PUBLIC_ORIGIN` / `ALLOWED_ORIGINS` | Exacte werkelijke HTTPS-origin(s), gescheiden door komma's indien nodig; geen `null` of wildcard |
| `REDIS_URL` | Werkende beschermde opslag; controleer privé netwerk/TLS, toegangsrechten en restorebeleid |
| `CONTACT_TRUST_PROXY` | Alleen `1` bij een bekende, gecontroleerde proxyketen; verifieer de gebruikte laatste forwarding-hop |
| `CONTACT_PRIVACY_READY` | Pas `1` nadat de echte privacy-inrichting en bewaartermijnen zijn bevestigd |
| Werkelijke verzendproef | Eén eigen testbericht zonder gevoelige gegevens via de app/webpagina. Bevestig provider-ID/status en ontvangst/spam in de echte Gmail-mailbox. Controleer dat geen mailapp opent. |
| Misbruik/fouten | Test verkeerde origin, ongeldige invoer, herhaalde klik, zelfde request-ID, providerfout, netwerkuitval, te groot bericht en rate limit. Laat een mislukking geen succesmelding tonen. |

## 5. YouTube en advertenties

- [ ] Onderbouw de verkrijgingsroute van videometadata: toegestane API/accountmethode of andere aantoonbaar toegestane route. XML/RSS-bereikbaarheid is geen vrijgave op zichzelf.
- [ ] Controleer de geselecteerde video-ID's, herkomst, toegestane embedding, beschikbaarheid en kindercontentstatus. Bevestig doelgroepinstellingen bij YouTube waar van toepassing.
- [ ] Geef alleen beoordeelde snapshots vrij. Test weigeren, toestaan, sluiten, terugnavigatie, achtergrondgedrag en een verwijderde/geblokkeerde video op een echt toestel.
- [ ] Houd AdMob uit voor deze release. Wanneer advertenties later expliciet worden toegevoegd: geschikte gecertificeerde CMP/UMP, toestemming en intrekking, doelgroep en netwerkgedrag afzonderlijk implementeren en testen. Niet alleen een 'niet-gepersonaliseerd'-vlag gebruiken als volledige AVG-oplossing.

## 6. Hosting en productiebeveiliging

- [ ] Kies één actueel backendpad. Node en oude Worker hebben eigen bewijsconfiguratie; neem niet aan dat een fix in de ene al in de andere draait.
- [ ] Zet `NODE_ENV=production`; configureer een willekeurige `HUB_API_SECRET` van minimaal 32 tekens. Beperk beheerrechten en leg sleutelrotatie vast. Sleutels die ooit publiek waren moeten worden vervangen.
- [ ] Plaats de Node-rechtenregistratie in een beschermd bestand via `CONTENT_RIGHTS_FILE`; configureer Worker-bewijs uitsluitend als beschermd serversecret `CONTENT_RIGHTS_JSON` indien deze nog wordt gebruikt.
- [ ] Verifieer dat geen production database of redactieroute publiek zonder juiste autorisatie schrijfbaar is. Controleer ook hostingaccounts, GitHub-rechten en branchbescherming.
- [ ] Controleer TLS, proxyketen, private database, back-up en herstel, externe originlijst, logtoegang en bewaartermijn. Stel bij meerdere instanties een gedeelde/WAF-beperking in; de algemene Node-limiter is per proces.
- [ ] Laat cron-/bronpoorten uit totdat de methode werkelijk is vrijgegeven. Verander geen gate om een foutmelding weg te krijgen.
- [ ] Rol pas uit na expliciete opdracht. Controleer daarna `/health`: `launchPolicyVersion:26`, opslag verbonden, automatische verwerking overeenkomstig goedgekeurd beleid. Controleer dat ook de juiste bronversie draait.
- [ ] Controleer `/privacy`, `/legal`, contact en onvrijgegeven routes op echte HTTPS-hosting. Voer daarna één toegestane publicatie uit en verifieer de publieke feed en gekoppelde afbeelding. Controleer ook dat een geweigerde publicatie niets schrijft.

## 7. Android-productierelease

- [ ] Stel in Play Console de echte hoogste versionCode en pakketidentiteit `nl.voetbalhub.app1` vast. Code 60 in deze APK is alleen hoger dan de aangeleverde fase-25-code 59; de echte storehistorie kan afwijken.
- [ ] Bevestig de bestaande productie/uploadkey en Play App Signing-status. Gebruik geen nieuwe willekeurige sleutel ter vervanging van een bestaande identiteit.
- [ ] Configureer uitsluitend server-/CI-secrets: `RELEASE_KEYSTORE_BASE64`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`. Geen waarden in dit document zetten.
- [ ] Bouw een releasebundle met bestaande identiteit; controleer de werkelijke handtekening, certificaatfingerprint, pakket, versienummer, API-target en dependency-/manifestinhoud. Een succesvolle taak `signReleaseBundle` bewijst geen handtekening.
- [ ] Test de ondertekende release op minimaal de ondersteunde relevante toestellen/Android-versies, inclusief Android 16, en actualiseer platformvereisten bij indiening. Controleer installatie/update, home, categorieën, favorieten, backgedrag, contact, video, privacy en netwerkuitval.
- [ ] Controleer de uiteindelijke release op native libraries en toepasselijke 16-KB-eisen. Deze debug-APK bevat geen `.so`, maar een toekomstige dependency kan dit veranderen.
- [ ] Rond Play-ontwikkelaarsverificatie, nieuwsverklaring, contentrating, doelgroep, contact/privacy-URLs en toepasselijke gesloten test af. De eigen bestaande testgroep bewijst niet automatisch productietoegang in Play.

## 8. Laatste lanceerbesluit

- [ ] Alle kritieke rijen in het fase-26-rapport zijn met bewijs naar GO gewijzigd.
- [ ] De exact te publiceren backend, feed/media en ondertekende app zijn samen getest. Het test-APK is geen productierelease.
- [ ] De resterende juridische conclusies zijn door de daarvoor verantwoordelijke uitgever/deskundige bevestigd. Merkonderzoek is daadwerkelijk afgerond.
- [ ] Expliciete toestemming voor productie-uitrol is verkregen. Bewaar versie, certificaat, checksums, beslisdatum en terugrolplan.

Tot die tijd: **NO-GO voor openbare lancering; wel bruikbaar voor gecontroleerde technische tests met aantoonbaar toegelaten of fictieve inhoud.**
