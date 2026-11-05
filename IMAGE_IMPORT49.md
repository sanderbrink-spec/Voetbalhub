# Afbeeldingen toevoegen

1. Plaats de eigenaar-goedgekeurde WebP, PNG of JPG in `public/library49/` (maximaal 2 MB). Optimaliseer bij voorkeur naar WebP, 1200 × 675, circa 100–250 kB.
2. Maak JSON met `assets: [...]`. Gebruik een bestaande entry in `image-library49.json` als voorbeeld. Verplichte velden: id, file, categories, subject, clubs (thuis eerst), competitions, daypart (day/twilight/night/neutral), keywords, variant, origin, rights (original-ai/original-vector/licensed), rightsEvidence, approval, reviewer, caption, questionIds, lastUsed (null), sha256.
3. Gebruik alleen `approval: approved` na visuele controle van spelling, kleuren, thuis/uitvolgorde, logo's en rechten. Vermeld bij AI-beelden expliciet dat het illustraties zijn. Geef nooit een dagdeel mee als dat niet gecontroleerd is.
4. Bereken de bestandshash met `sha256sum public/library49/bestand.webp`. Importeer met `node scripts/import-images49.js import.json`. Ontbrekende bestanden, dubbele ID's en ongeldige metadata worden geweigerd. Pending/rejected blijven buiten automatische selectie.
5. Publiceer bestanden en manifest samen via GitHub. De Render-service serveert alleen goedgekeurde beelden. Nieuwe categorieën zijn manifestwaarden; geen nieuw beheersysteem nodig.

Voor quizbeelden: zet de exacte vraag-ID's in `questionIds`, categorie `quiz` en `answerSafe: true` uitsluitend na controle op inhoud en antwoordverklapping. Draai `node scripts/sync-quiz-images49.js` en bouw Android bij gewijzigde gebundelde beelden. Zonder passende goedgekeurde koppeling blijft een vraag beeldloos.

Lichtselectie gebruikt een absolute aanvangstijd en expliciete geverifieerde stadioncoördinaten (`fixture.venue.latitude/longitude`). Zonder deze gegevens kiest de selector uitsluitend neutrale metadata. Seizoen en locatie tellen via de berekende zonnestand mee. Onzekere tijden worden niet geraden.

De acht bestaande fase43-beelden behouden hun goedkeuring, maar zijn nog niet geschikt verklaard als herbruikbaar sjaalsjabloon met gecontroleerde thuis/uitvolgorde en dagdeel. Daarom staan ze apart van automatische wedstrijdselectie. De eigenaar kan ze na controle aanvullen. Er zijn 9 bestaande beelden en 3 nieuwe eigen spelregeldiagrammen geïntegreerd.

Clubnamen en kleuren kunnen exact als SVG-tekst en vlakken in daarvoor ontworpen sjablonen worden toegevoegd. Bestaande fotorealistische gevouwen sjaals hebben geen betrouwbare vaste tekstvlakken of maskers. Daarom worden hier geen namen over bestaande foto's geplakt. Voor combinatorisch hergebruik zijn eerst eigenaar-goedgekeurde sjablonen met vlakke veilige tekstvlakken nodig.
