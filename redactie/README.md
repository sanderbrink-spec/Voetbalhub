# VoetbalHub Redactie — prototype

Deze map bevat een redactiedashboard, een draft-only AI Worker en een review-only feed-inbox.

## Dashboard
Open `dashboard/index.html` in een browser. De lokale demo verzamelt geen nieuws en maakt geen echte AI-output; hij laat de conceptworkflow zien.

## Worker endpoints
- `GET /health`: health/status.
- `POST /inbox`: leest RSS/Atom feeds uit `ALLOWED_FEED_URLS` (komma-gescheiden HTTPS-URL's), haalt maximaal 30 items per feed op en geeft ze terug als `needs_editor_review`. Optioneel slaat het items op in Cloudflare KV via binding `EDITORIAL_KV`. Dit is geen feitencontrole en geen automatische publicatie.
- `POST /draft`: maakt een origineel artikelconcept van aangeleverde feiten met OpenAI Responses API.

## Cloudflare-configuratie
Worker secrets: `HUB_API_SECRET`, `OPENAI_API_KEY`.
Worker variables: `ALLOWED_FEED_URLS` met alleen feeds waarvan gebruiksvoorwaarden commercieel gebruik toestaan; optioneel `OPENAI_MODEL` (standaard `gpt-4.1-mini`). Voor inbox-opslag kun je een KV namespace aan binding `EDITORIAL_KV` koppelen. Bewaar API-sleutels nooit in HTML of APK.

Voorbeeld `POST /draft` body: `{ "topic":"Onderwerp", "category":"Eredivisie", "format":"nieuws", "facts":["Gecontroleerd feit 1","Gecontroleerd feit 2"], "sourceUrls":["https://officiele-bron.example/bericht"] }`.

Voorbeeld `POST /inbox`: stuur `{}` met `Authorization: Bearer <HUB_API_SECRET>`.

## Belangrijke beperkingen
- Worker is NIET uitgerold of getest met echte sleutels.
- Dashboard is niet gekoppeld aan de Worker.
- RSS-items zijn alleen nieuwsaanleidingen; geen gecontroleerde feiten.
- Geen automatische publicatie of onafhankelijke feitencontrole.
- De Android-app is nog NIET aangepast of gekoppeld.
- Gebruik alleen toegestane bronnen en controleer feiten, citaten, data- en beeldrechten vóór publicatie.

## Volgende stappen
1. Configureer/deploy Worker en voer tests uit.
2. Voeg alleen toegestane feeds toe en test de inbox.
3. Voeg een goedkeuringsbackend/auditlog toe.
4. Koppel goedgekeurde artikelen aan Android en bouw/test een APK.