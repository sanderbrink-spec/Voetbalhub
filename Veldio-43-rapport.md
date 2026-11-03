# Veldio fase 43: gecontroleerde oplevering

3 november 2026. **GEDEELTELIJK**: de ondertekende APK en productiebeelden zijn beschikbaar. YouTube-weergave binnen de app is nog niet vrijgegeven: de vijf gecontroleerde video's geven in de emulator fout 150. De externe YouTube-fallback werkt. Geen volledige fase-43-acceptatie geclaimd.

| Onderdeel | Status | Resultaat en bewijs |
|---|---|---|
| 1. GitHub en implementatie | VOLTOOID | Gepubliceerd via de verbonden GitHub-integratie op `work/veldio-43`. De lokale shell heeft geen GitHub-pushcredential; de verbonden integratie heeft de commits en branchupdates aantoonbaar opgeslagen, zonder force-push. Alle lokale codewijzigingen behouden. |
| 2. Commit-SHA en bestanden | VOLTOOID | APK-code: `65a2c9c1eedd2bf2357fef99783edf6e2523b6ec`. Productiemedia: `7835ada2aef937ef84e7d29c8d425bfdea3b2c10`. Bestanden en verschillen: onderstaande verwijzingen. |
| 3. Video | GEDEELTELIJK | Officiële IFrame API, fullscreen, liggende oriëntatie, terug naar dezelfde lijstpositie, lifecycle en bronlinks geïmplementeerd. Vijf NOS-video’s met officiële oEmbed-metadata en thumbnails. De aangeleverde playlist is niet bevestigd: `YOUTUBE_API_KEY` ontbreekt. Het alternatief is als archiefselectie gelabeld. |
| 4. Logo’s | VOLTOOID | Zes competities en 38 ondersteunde clubs geïnventariseerd. Geen officiële emblemen toegevoegd zonder aantoonbare toepasselijke vrijgave. Eigen alternatieven behouden. Sparta verlangt vooraf schriftelijke toestemming; UEFA verleent geen algemene merklicentie. Eredivisie, KKD, Premier League en overige clubs blijven onzeker voor deze specifieke toepassing. Details en primaire bronnen: `logo-rights43.json`. |
| 5. Nieuwsbeelden | VOLTOOID | De tien actuele feedartikelen gecontroleerd: acht reguliere artikelen hebben ieder een eigen AI-contextillustratie; twee columns behouden het auteursportret. Acht unieke WebP-bestanden, 1664×936, 185–313 kB. Groningen–Sparta bevat leesbare clubnamen en beweegmateriaal. In de echte Android-weergave visueel gecontroleerd. Alle acht live bestanden geven HTTP200 en de geregistreerde SHA256. |
| 6. Tests | GEDEELTELIJK | GitHub Actions: 340 Node/Redis-tests geslaagd, nul fouten, nul overgeslagen. Python-regressies en bestaande browsercontroles geslaagd. Android16/API36: installatie, twaalf menuroutes, zes competities, meerdere favorieten selecteren/verwijderen, behoud na procesherstart, offline quiz, terugnavigatie en vijf fullscreen-openingen geslaagd. Afspelen, pauzeren, hervatten en zoeken zijn niet bevestigd wegens YouTube-fout150. Geen fysieke Galaxy S23-test. |
| 7. Beeldpipeline en resterend werk | GEDEELTELIJK | SHA256, perceptuele duplicaatcontrole, inhoudelijke club-/categorieselectie en atomische Redis-controle geïmplementeerd en getest. Zonder passend vrijgegeven beeld blijft een artikel `needs_review`. Geen betaalde generator geactiveerd. De bestaande productiebackend heeft automatische broninname en publicatie nog uitstaan; deze fase heeft die zelfstandige redactie niet geactiveerd. |
| 8. Render | VOLTOOID | Mediadeployment `dep-dbl28u3ncjis73flcjh0` is live. `/health`, `/ready`, `/articles`, `/integrations/videos43` en de acht beeldbestanden gecontroleerd. Tien artikelen en vijf videometadatarecords. Geen nieuwe fouten in de gecontroleerde deploymentlogs. De productiebackend is afzonderlijk bijgewerkt; geen integrale frontendbranch-migratie of databasemigratie. |
| 9. Android-build | VOLTOOID | Workflow `41695500870`, broncommit `65a2c9c`, beide jobs `api-test-and-build` en `android-brand-smoke`: success. APK onafhankelijk gedownload; ZIP-integriteit, pakket, acht beeldhashes en debugondertekening gecontroleerd. |
| 10. Download | VOLTOOID | Artifact `13261106316`, bestand `Veldio-43-install.apk`. Directe verwijzing hieronder. |

## APK en bewijs

Pakket `nl.voetbalhub.app1.test43`; versie `4.51-phase43` (83); minimum API24; doel API36. Bestand: **21.025.281 bytes**. APK Signature Scheme v2 geldig, certificaat `CN=Android Debug`, RSA2048.

SHA256: `338e2bb5053d01bedd6e7cb0982172e6c7707dc0c107a8a3bf1425498c84a1ae`.

Deze afzonderlijke testapp installeert naast eerdere fasen. Voorkeuren worden binnen de eigen installatie bewaard; bestaande fase42-voorkeuren worden niet automatisch overgezet.

[APK-artifact](https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41695500870/artifacts/13261106316) · [Geslaagde build en Android16-controle](https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41695500870) · [Ondertekening en manifest](https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41695500870/artifacts/13262330673) · [Apparaatbewijzen](https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41695500870/artifacts/13260294945).

De testworkflow kan technisch slagen terwijl afspelen geblokkeerd blijft. Het meegestuurde `interface39-result.json` vermeldt daarom expliciet `videoPlaybackAcceptance:false`. De screenshots tonen YouTube-fout150; geen oorzaak zoals regio of account als bewezen aangemerkt. De fallback is daadwerkelijk als Android-intent naar de officiële YouTube-app waargenomen. Er zijn geen embedbeperkingen omzeild.

## Belangrijkste bestanden

Speler: `android-ui/java/YoutubePlayerView.java`, `VideoShelf40.java`, `HomeFeatureView.java`, `android-ui/assets/youtube-player43.html`, `scripts/patch-phase43.py`. Officiële links behouden hun oorspronkelijke bestemming; thumbnails gebruiken hoge resolutie met een kleinere fallback.

Beeld: `editorial-pipeline43.js`, `editorial-publication.js`, `editorial-drafts.js`, beide automatische redactie-entrypoints, `media43.js`, `editorial-images43.json`, `android-ui/assets/presentation-covers43.json`, `EditorialImages43.java`, `Branding.java`, `EditorialPhotos.java`, `public/news43/` en de overeenkomstige Android-assets. Exacte prompts: `image-prompts43.json`. Alle beelden zijn met ingebouwde imagegen gemaakt; bron- en eindhashes zijn geregistreerd. Geen extra betaalde API aangesloten.

Metadata: `youtube-catalog43.js`, `scripts/youtube-catalog43.js`, `videos/catalog43.json`, `.github/workflows/youtube43.yml`. Officiële API-route met kanaal-ID-controle; zonder sleutel uitsluitend gecontroleerde oEmbed-selectie. Metadata wordt gecachet; geen beeldgeneratie bij appstart.

[Volledige implementatieverschillen](https://github.com/sanderbrink-spec/Voetbalhub/compare/67b37771a9e8619fb8ab5fe68a4722c91c1c4062...65a2c9c1eedd2bf2357fef99783edf6e2523b6ec).

## Concrete open punten

Voor betrouwbare selectie van insluitbare playlistvideo’s is een veilig ingestelde YouTube Data API-sleutel en een daadwerkelijk afspeelbare selectie nodig. Fout150 mag niet worden omzeild; tot bevestiging blijft de externe YouTube-knop beschikbaar. Automatische unieke generatie voor nieuwe onderwerpen vereist een vrijgegeven provider en budget; onbekende onderwerpen worden vastgehouden. De bestaande blokkade voor autonome tekstpublicatie blijft apart zichtbaar.
