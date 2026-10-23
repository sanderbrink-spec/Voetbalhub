# VoetbalHub Redactie — prototype

Deze map bevat een eerste redactie-dashboard en een draft-only AI Worker.

## Dashboard
Open `dashboard/index.html` in een browser. De lokale demo verzamelt geen nieuws en maakt geen echte AI-output; hij laat de conceptworkflow zien.

## Worker
`worker/index.js` biedt `GET /health` en `POST /draft`. Configureer in Cloudflare Worker secrets `HUB_API_SECRET` en `OPENAI_API_KEY`; optioneel `OPENAI_MODEL` (standaard `gpt-4.1-mini`). API-sleutels nooit in HTML of APK plaatsen.

Voorbeeld body: `{ "topic":"Onderwerp", "category":"Eredivisie", "format":"nieuws", "facts":["Gecontroleerd feit 1","Gecontroleerd feit 2"], "sourceUrls":["https://officiele-bron.example/bericht"] }`.

## Status en beperkingen
- De bestanden zijn in GitHub opgeslagen.
- De Worker is NIET uitgerold of getest met echte sleutels.
- Het dashboard is een lokale demo, niet aan de Worker gekoppeld.
- Er is geen automatische nieuwsverzameling, onafhankelijke feitencontrole, opslag of publicatie.
- De Android-app is nog NIET aangepast of gekoppeld.
- Gebruik alleen officiële/toegestane bronnen en controleer feiten, citaten, data- en beeldrechten vóór publicatie.

## Volgende stappen
1. Test dashboard op mobiel en desktop.
2. Deploy Worker met secrets en test een conceptrequest.
3. Bouw een backend/inbox die toegestane bronfeeds verwerkt, bronnen vastlegt en dubbele items voorkomt.
4. Voeg redactionele goedkeuring en auditlog toe.
5. Koppel goedgekeurde artikelen aan de Android-app en bouw/test een APK.