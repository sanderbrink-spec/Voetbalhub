# Veldio: gerichte audit van broncodepakket 23

Datum: 31 oktober 2026.
Uitgangspunt: `Voetbalhub-main (23).zip`.

## Resultaat

De ontbrekende Android-contactbridge is hersteld. De broncode en een gebouwde test-APK zijn beschikbaar. Live e-mailverzending is nog geblokkeerd: de Render-service mist `RESEND_API_KEY` en `CONTACT_FROM`. Er is geen echte aflevering in Gmail aangetoond.

De goedgekeurde slideshow, huisstijl, column, startpagina en artikelkaarten zijn niet aangepast. Alle acht bestanden in `android-ui/assets` zijn byte voor byte gelijk aan de aangeleverde ZIP. De presentatiescripts zijn eveneens ongewijzigd.

## Inventarisatie vóór wijzigingen

| Onderdeel | Al aanwezig | Bewijs en begrenzing |
| --- | --- | --- |
| Slideshow en startpagina | Drie onderwerpen, tekst op beeld, eigen presentatie en links | Bestaande browsertest geslaagd bij 320–768 px. Code en assets behouden. |
| Contactpagina | Formulier, validatie, conceptbehoud, laadstatus, verzoek-ID en aanroep `ContactHub.submit` | HTML aanwezig en correct gekoppeld aan servercontract. De native methode ontbrak daadwerkelijk. |
| Mailserver | `/contact`, `contact-mail.js`, vaste ontvanger, Resend-verzoek | Bestaande unit- en HTTP-tests slagen met gesimuleerde provider. Live configuratie is onvolledig. |
| Redactiedesk | Concepten, revisies, broncontroles, expliciete publicatie, herstel en filters | Node-tests, echte lokale Redis-tests en browserflow slagen. Geen productieberichten aangemaakt. |
| Automatische publicatie | Aparte geplande workflow, bronbewijs, publicatievoorwaarden en duplicaatcontrole | Bestaande tests voor primaire bronnen, actualiteit, bewijs, herhaalde runs en onbewezen claims slagen. Geen volledige live geplande run gestart. `autoPublish:false` in `/health` beschrijft niet de afwezigheid van deze aparte workflow. |
| Afbeeldingen | Eigen covers, wedstrijdidentiteit, bronbeperkingen en beeldcontrole | Bestaande tests voor covers, toegestane hosts, stadion en beeldkoppeling slagen. Geen volledige visuele feitencontrole van alle live afbeeldingen uitgevoerd. |
| Navigatie | Vorig scherm, interne geschiedenis, terugknop en afsluiten | Java-geschiedenistest, browsergeschiedenistests en mobiele browserflows slagen. |
| YouTube | Selectie uit officiële feeds, actualiteitsfilter en rail | Bestaande tests voor kanaalidentiteit, unieke actuele video's en bronuitval slagen. Geen nieuwe live YouTube-verversing gestart. |
| Android en Actions | ZIP-project plus bestaande bouw- en patchworkflow | Dezelfde lokale extractie- en patchstappen uitgevoerd; Gradle-build geslaagd. Geen nieuwe GitHub Actions-run gestart en niets naar GitHub gepusht. |

## Aangetoonde problemen

1. **Ontbrekende Android-bridge.** De HTML roept `ContactHub.submit(payload)` aan, maar `ContactView.Bridge` had uitsluitend de oudere acties. Daardoor valt Android terug op een browserverzoek naar `/contact` vanuit een lokaal `file:`-document. Dat is geen verzoek naar de redactie-API. Dit is hersteld.
2. **Ontbrekende productieconfiguratie.** Live `GET /health` meldt `contact.configured:false`, met ontbrekende `RESEND_API_KEY` en `CONTACT_FROM`. Een geldig technisch testverzoek naar live `POST /contact` retourneert HTTP 503 zonder `accepted:true`. Dit is een blijvende blokkade waarvoor geldige accountgegevens en een toegestane afzender ontbreken.
3. **Verouderde browsertest.** Deze verwachtte een knop 'Open e-mailbericht', een `compose`-actie en een kopieerknop die niet meer overeenkomen met het huidige formulier. De test is bijgewerkt naar directe verzending.
4. **Historische dubbele publicaties.** De openbare feed bevat 11 records, met unieke IDs maar vier exemplaren van 'FC Groningen ziet voorsprong verdwijnen bij N.E.C.'. De vier berichtteksten zijn identiek en dateren van 26 en 28 oktober. De huidige broncode bevat al een blokkade voor identieke koppen en sterk overlappende artikelen. Deze audit bewijst geen nieuwe fout in die huidige route. Historische records zijn behouden; er zijn geen live gegevens verwijderd of verborgen.

## Uitgevoerde wijzigingen

| Bestand | Gerichte wijziging |
| --- | --- |
| `android-ui/java/ContactView.java` | `@JavascriptInterface submit(String)` toegevoegd. Native HTTPS-POST op een achtergrondthread, vaste `/contact`-route op dezelfde server als de geconfigureerde artikelen-API, tijdslimieten, begrensde respons, geen redirects, dubbele klik geblokkeerd en alleen succes bij een positieve serverbevestiging. Verzenden opent geen e-mailapp. |
| `scripts/patch-navigation-contact.py` | Geeft de bestaande `EDITORIAL_API_URL` door aan `ContactView`, zodat de contactroute dezelfde server gebruikt. |
| `scripts/browser/contact.cjs` | Controleert huidig verzendcontract, validatie, dubbel klikken, verzoek-ID bij herhalen, conceptbehoud, succesreset, smalle schermen en HTTP-afhandeling met gesimuleerde Resend-reactie. |
| `test/contact-bridge.test.js` | Regressietest die controleert dat iedere door de pagina gebruikte bridge-actie daadwerkelijk als Android-interface bestaat en de API-configuratie wordt doorgegeven. |

Geen wijzigingen in mailserver, redactionele logica, afhankelijkheden, afbeeldingsgeneratie of visuele bestanden. Geen nieuwe functies toegevoegd.

## Testresultaten

| Controle | Resultaat |
| --- | --- |
| Bestaande Node-suite vóór wijzigingen | 182 geslaagd, 0 mislukt, 0 overgeslagen, inclusief echte lokale Redis-integratie. |
| Volledige suite na wijzigingen | 183 geslaagd, 0 mislukt, 0 overgeslagen. |
| Contact-browsertest | Geslaagd, inclusief HTTP-route en positieve/negatieve providerreacties met testprovider. |
| Redactiedesk-browserflow | Geslaagd. |
| Eredivisie-browserflow | Geslaagd. |
| Wedstrijdvoorbeschouwing en vertraagde navigatie | Geslaagd. |
| Persoonlijke clubs, zoeken, opgeslagen artikelen en interne navigatie | Geslaagd. |
| Veldio-homepage en slideshow | Geslaagd. |
| Java `ScreenHistoryTest` in Android-voorbereiding | Geslaagd. |
| Bestaande workflow-extractie en Android-patches | Geslaagd. |
| `gradle :app:assembleDebug --offline --no-daemon` | Geslaagd: 32 taken uitgevoerd. |
| APK-handtekening met `apksigner verify` | Geldig, APK Signature Scheme v2. |
| Contact-asset in APK versus gecontroleerde broncode | Exact gelijk. |
| Alle acht oorspronkelijke Android UI-assets versus invoer-ZIP | Exact gelijk. |
| `npm audit --omit=dev --json` | 0 bekende kwetsbaarheden gemeld. |
| Gerichte scan op Resend-, GitHub-, Google- en private sleutelformaten in uitgepakte broncode | Geen overeenkomsten gevonden. Dit is geen garantie dat iedere mogelijke geheime waarde ontbreekt. |
| Live `/health` | HTTP 200, Redis verbonden, Resend-configuratie onvolledig. |
| Live `/articles` | HTTP 200, 11 records; geen ontbrekende koppen of berichtteksten. Historische dubbele tekst zoals hierboven vermeld. |
| Live `/contact` met geldig testverzoek | HTTP 503; correcte foutmelding, geen onterechte succesbevestiging. |

De eerste twee testpogingen konden de apart gestarte lokale Redis niet bereiken. Na het starten van Redis binnen dezelfde procesomgeving slaagden zowel de basismeting als de eindmeting volledig. De oorspronkelijke contact-browsertest was inhoudelijk verouderd; de bijgewerkte test slaagt. Er staan geen mislukte geautomatiseerde eindtests open.

## Nog nodig voor daadwerkelijke e-mailaflevering

In de Render-service `voetbalhub-redactie` moeten deze bestaande instellingen geldig worden ingevuld:

- `RESEND_API_KEY`: een werkelijke Resend-sleutel met verzendrechten, uitsluitend als servergeheim.
- `CONTACT_FROM`: een bij Resend toegestane afzender op een geverifieerd domein. De domeinnaam en afzender zijn niet aangeleverd. Er is geen verzonnen waarde ingevuld.

`CONTACT_PUBLIC_ORIGIN` wordt live niet als ontbrekend gemeld. De ontvanger blijft vast `redactie.veldio@gmail.com`; het bezoekersadres wordt als `reply_to` gebruikt.

Na instelling en herstart: controleer dat `/health` de configuratie herkent, verstuur één formulierbericht vanuit de APK en controleer zowel Resend-afleverstatus als Gmail-inbox en spammap. Een API-bevestiging bewijst acceptatie door Resend; die bewijst op zichzelf geen aflevering in de inbox.

Officiële toelichting over afzenderdomeinen en foutdiagnose: https://resend.com/changelog/improved-logs-visibility

## Beperkingen en oplevering

Er is geen aangesloten Android-toestel of emulator aangetroffen. Native code is gecompileerd en de APK is gecontroleerd, maar bediening en aflevering op een echt toestel zijn niet aangetoond. De browsercontrole gebruikt een gesimuleerde bridge en mailprovider; er is geen claim dat dit een echte Gmail-aflevering is.

De APK is een debug-testbuild, geen productieondertekende release. De aangeleverde snapshot 23 bevat intern `versionName=4.26-veldio` en `versionCode=58`; die metadata is behouden. De pakketnaam is volgens de bestaande workflow `nl.voetbalhub.app1`. Installatie over een bestaande APK vereist dezelfde ondertekening. De bestaande signingconfiguratie is niet gewijzigd.

Er is geen live serverdeploy uitgevoerd. De drie gewijzigde oorspronkelijke bestanden betreffen alleen Android en tests; de bestaande serverroute is behouden. De daadwerkelijke afzenderverificatie, geldigheid van een nieuwe Resend-sleutel, providerlimieten, toekomstige geplande runs en feitelijke juistheid van alle live artikelen zijn niet aantoonbaar getest.

APK SHA-256: `3a37b185a3e54e75385de4d057f5bebe9c3056226ed30f4a0a9668c16008647b`.
