# Veldio fase 34: audit en herstel

Datum: 2 november 2026. Fase 35 is niet gestart. Dit rapport onderscheidt geteste code, productie en ontbrekend bewijs.

## Herstelde projectstatus

Bij aanvang stond main op `4c2f54a550ac2edd6e5f43b61bd5b4c520c7f82b`. Render draaide nog `d4a6e603b3a2498367c2ffccf5c36880ab0d4b88`, deploy `dep-dbiqal7b9u1s73c7q080`. De appwijzigingen van fase 31, 32 en 33 stonden in opeenvolgende concept-PR's. Fase 33 eindigde op `7fbb19b9325255b6e658da60c2982a8afbc5bf0f`.

De live API leverde 16 artikelen, waaronder zeven al voor archivering aangewezen berichten. `/ready` en `/integrations/statistics` gaven 404. `/health` meldde verbonden opslag en AI-configuratie, maar ontbrekende mailconfiguratie. Deze meldingen bewijzen geen succesvolle AI-publicatie of e-mailbezorging.

## Daadwerkelijke wijzigingen

[PR 43](https://github.com/sanderbrink-spec/Voetbalhub/pull/43) bevat de beperkte productieherstelronde:

- `/articles` begrenst wachten op opslag tot negen seconden en geeft bij mislukking 503. Een opslagfout wordt geen succesvolle lege feed.
- `/ready` controleert een echte Redis-PING met een limiet van 1,5 seconde. `/health` en `/ready` vermelden een gevalideerde productiecommit.
- Een expliciet uitgeput Groq-dagquotum stopt de redactieronde met `provider_daily_limit`. Nieuwe modelverzoeken binnen dezelfde ronde worden tegengehouden. Korte minutelimieten houden begrensde retries. Annulering blijft werkzaam. Er is geen ander model of betaald abonnement geactiveerd.
- Bestaande browserchecks verwachtten een inmiddels verlopen live voorbeschouwing en een verwijderde externe e-mailhandoff. Zij gebruiken nu vaste wedstrijddata en de werkelijke directe verzendroute. Productiecontrole is afzonderlijk uitgevoerd.

De aanleiding voor de quotareparatie is aantoonbaar in [redactierun 41393927649](https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41393927649): nul publicaties, veertien tegengehouden onderwerpen, zeven bronfouten en herhaalde HTTP 429 gedurende ruim twintig minuten. Een groene workflow was hier geen publicatiebewijs.

[Concept-PR 44](https://github.com/sanderbrink-spec/Voetbalhub/pull/44) integreert alle bestaande appwijzigingen met de latere backendcode. De stadionworkflow gebruikt de bron van zijn eigen commit in plaats van een vastgezette andere revisie. Huisstijl, slideshow, columnfoto en overige appassets zijn behouden.

## Validatie

| Onderdeel | Bewijs |
|---|---|
| Beperkte backendcode | 193 tests met echte Redis; nul mislukt of overgeslagen |
| Geïntegreerde app/backendcode | 269 tests met echte Redis; nul mislukt of overgeslagen |
| Redactieketen | Drie aanvullende tests met echte Redis en een browser, inclusief afgewezen publicatie en behoud van conceptstatus |
| Browser | Zes bestaande suites op backendbranch; negen suites op integratiebranch; mobiel en desktop, inclusief 320–768 px |
| Python | Vier controles geslaagd |
| Nieuwe runtimefouten | Gezonde, defecte en vastlopende Redis-probe; vastlopende feedread; dagquotum; korte quota; annulering; behoud foutsignaal door tekstgeneratie |
| Android-build | [Run 41405125812](https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41405125812), bron `acdfca810b48616c33593408c2295740d7e5d81e`; APK-build geslaagd en v2-handtekening gecontroleerd |
| APK-assets | 23 scherm- en fotoassets byte-identiek aan de finale integratiebron |

De finale geïntegreerde code-tree is `1124e404ec4a986fca339f58e2282a773d82b9da`. De backendtree na correctie van de bestaande browsertests is `345dc1b45bc6ef3b12697e1eb3aa9013a77ef757`. Testdata zijn uitsluitend lokaal of in CI gebruikt; niet als nieuws gepubliceerd.

## APK

`Veldio-4.38-test.apk`: versie `4.38-veldio`, versiecode 66, pakket `nl.voetbalhub.app1.test33`, launcherlabel **Veldio 33 test**. Dit label en de pakketidentiteit zijn overgenomen uit de bestaande fase-33-build. Dit is een afzonderlijke testapp, geen update met de oorspronkelijke productiesleutel.

SHA-256: `5e1e10cbb57a0752eb941a4e1e361f0d8130a71f49c399c1cf9b030fa2de0cd8`.

Ondertekeningscertificaat SHA-256: `f412c579d6db2b40851891bc1c33ffebde8b6fec363ec3cc4cc5ed5f9d1b82b4`.

## API's, opslag en kosten

| Koppeling | Vastgesteld |
|---|---|
| Render Node-API | Bestaande gratis webservice in bevestigde werkruimte My Workspace |
| Render Key Value | Bestaande gratis Redis-compatibele opslag, beschikbaar; `noeviction`, persistentiemodus uit |
| PostgreSQL | Geen Render-instanties gevonden |
| GitHub | Broncode, Actions, nieuws- en stadionmomentopnamen op editorial-media |
| Groq | Configuratie aanwezig; recente productieaanroepen liepen tegen quota; geen nieuwe publicatie bewezen |
| Resend | Serverroute aanwezig; live RESEND_API_KEY en CONTACT_FROM ontbreken |
| YouTube | Laatste onderzochte mislukte run: alle kanalen onbereikbaar; bestaande selectie blijft behouden. De geïntegreerde app gebruikt de bestaande oorspronkelijke quiz |
| Wedstrijddata en externe beelden | Koppelingen aanwezig in broncode; beschikbaarheid en toestemming blijven afzonderlijke voorwaarden, geen nieuwe licenties aangeschaft |
| Advertenties | Testidentificaties en afgeschermde toestemming/configuratie; geen bewezen productie-inkomsten |

Geen betaalde dienst, betaald abonnement of nieuwe infrastructuur aangemaakt. Werkelijke verbruikskosten van bestaande accounts zijn niet financieel gecontroleerd. Een succesvol lokaal back-up-/hersteltestresultaat bewijst geen bestaande productieroutine; een recente versleutelde productieback-up en herstelprocedure zijn niet aangetoond.

## Openstaande blokkades

De integratie bevat een leeg `content-rights.json` en een leeg `editorial-methods.json`. Ongewijzigd uitrollen zou bestaande artikelen verbergen. Daarom blijft PR 44 concept. Er zijn geen rechtenbewijzen verzonnen en geen controles uitgezet.

Voor volledige afronding ontbreken operationele mailconfiguratie plus bezorgbewijs, de oorspronkelijke Android-updatesleutel, concrete inhoudelijke en methodische vrijgaven, aantoonbare autonome productiepublicatie, productie-advertentieconfiguratie en een fysieke S23-test. De mobiele browsercontroles zijn geen fysieke toesteltest.

De voorbereiding voor een volgende API-strategie is daarom: één interne API als toegang voor de app; begrensde provideradapters op de server; gedeelde momentopnamen en caching; expliciete quota- en foutstatus; geen sleutels in de APK; per bron aantoonbare gebruiksrechten. Er is geen nieuwe externe API geselecteerd of geactiveerd.

## Uitrolbewijs

PR 43 is na vier geslaagde GitHub-workflows samengevoegd in main op `05fa06835620e1d5409f82299f08d81983f6fa49`. De geautomatiseerde commituitrol bleek in de praktijk stil te staan sinds 31 oktober: geen recente events en geen lopende deploy. Daarom is één handmatige deploy gestart: `dep-dbk3lik9v7es73bjs6e0`, bron exact dezelfde main-commit. De deploy werd op 2 november 2026 om 08:25:22 Nederlandse tijd live. De aansluitende HTTP-controles bevestigden de juiste commit in zowel `/health` als `/ready`, een succesvolle Redis-probe, negen zichtbare artikelen, zeven gearchiveerde artikelen en zestien behouden artikelen via `view=all`. De verzamelingen zijn expliciet op volledigheid en onderlinge scheiding gecontroleerd. Er zijn geen artikelen fysiek verwijderd. De gemeten volledige verzoeken duurden ongeveer 5,7–5,9 seconden; dit is geen bewijs voor een algemene latentiedoelstelling. De geraadpleegde Render-errorlogs na uitrol bevatten geen nieuwe fouten.

GitHub-run 41405125812 is volledig geslaagd, inclusief Android API-35-emulator: installatie, starten, navigatie, column-/nieuwsreader, live feed, werkelijk pull-to-refresh, behoud van cache bij offline gebruik, begrensd wachten en stadion-/quizcontroles uit het bestaande testschema. Geen fysieke S23-test uitgevoerd. De finale backendbranch slaagde voor alle vier GitHub-workflows vóór de merge. De geïntegreerde branch slaagde voor alle negen browsersuites.

**Conclusie: beperkte productiereparatie uitgevoerd en live gecontroleerd. Fase 34 als geheel blijft onvoltooid; geen lancerings-GO.**
