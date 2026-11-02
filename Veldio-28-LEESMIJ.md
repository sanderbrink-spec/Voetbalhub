# Veldio fase 28

Wedstrijd-van-de-week-follow-up, 1 november 2026: de bestaande statistiekpublicatie bewaart de laatste volledige wedstrijdinhoud, genereert na bevestigde eindstatus een eigen resultaatverslag met scoreillustratie en bereidt de volgende vooruitblik voor. De overgang ligt op de geselecteerde aftrap minus 72 uur. Home en detailreader ondersteunen beide publicatiefases. De volledige suite telt 241 geslaagde tests; de zeven browsersuites slagen. Zie `Veldio-wedstrijd-van-de-week-testrapport.md` in de afzonderlijke oplevering. Geen nieuwe APK of live uitrol uitgevoerd.

Follow-up 1 november 2026: opslaguitval tijdens rechten-/bewijscontrole geeft nu HTTP 503 voor de hele feed. Een mislukte of onleesbare duplicaatscan stopt automatische artikelproductie vóór modelgebruik. De redactie-CI installeert vastgelegde dependencies met `npm ci`. Zie het afzonderlijke `Veldio-28-follow-up.md` en het bewijsarchief voor de actuele eindcontrole (229/229 Node-tests, inclusief Redis en browserketen). Android-bronnen en test-APK zijn ongewijzigd; er is geen nieuwe Android-build of productie-AAB gemaakt. Het lanceringsbesluit blijft NO-GO.

31 oktober 2026. NO-GO voor publieke commerciële lancering.

Deze broncode bevat gerichte herstelmaatregelen voor de actuele nieuwsselectie, controle van de contexttoelichting, afbeeldingsgeheugen, advertentie-lifecycle en releasepoorten. De goedgekeurde slideshow, het portret en het bronlogo blijven ongewijzigd.

Gebruik de afzonderlijk opgeleverde fase-28-rapportage als actuele beoordeling. Fase-23 tot en met fase-27-documenten in deze repository zijn historische rapporten. Persoonlijke juridische en financiële rapportage is afzonderlijk opgeleverd.

## Verificatie

- Installeer de vastgelegde Node-dependencies met `npm ci --ignore-scripts`.
- Gebruik een geïsoleerde Redis-testomgeving en stel `REDIS_TEST_URL` in. `npm test` mag niet als volledige ketentest worden opgevoerd als Redis-tests worden overgeslagen.
- Voor de volledige zichtbare ketentest: zet ook `EDITORIAL_BROWSER_TEST=1`, installeer de bestaande Pillow-afhankelijkheid en de in CI gebruikte Playwright/Chromium-versie.
- Browserprogramma's staan onder `scripts/browser`. UI-testfixtures zijn synthetisch en worden nooit in productie geïmporteerd.
- De Android-voorbereiding en bouwvolgorde staan in `.github/workflows/build.yml`: JDK 17, Gradle 8.13, AGP 8.13.2 en SDK/build-tools 36. Voer de patchstappen eenmaal op een vers uitgepakt Android-basisproject uit.
- De pure Java-tests en Python-releasepoorttests worden in die workflow uitgevoerd. `python3 scripts/release-preflight.py` en `node scripts/release-backend-check.js` weigeren de huidige onvolledige productieconfiguratie terecht.
- Storeexports: `node scripts/prepare-play-assets.js OUTPUT_DIRECTORY`. Begrotingsscenario: `python3 scripts/exploitation-plan.py`.

## Productie blijft geblokkeerd

De lege rechten-/methoderegisters mogen niet met fictieve toestemmingen worden gevuld. De testadvertentieconfiguratie is geen productieconfiguratie. Gebruik uitsluitend de bestaande bevestigde productie-uploadidentiteit; genereer daarvoor geen vervangende sleutel. Zonder passende broninputs, exploitant-/privacygegevens, echte mail-/CMP-/toesteltests en herstelinrichting bestaat geen GO.

Er is geen nieuwe commit naar de automatisch deployende hoofdbranch gepusht, geen betaalde instelling gewijzigd en niets bij Google Play ingediend. De daadwerkelijke versiecodes en signingidentiteit van Play moeten nog worden bevestigd.
