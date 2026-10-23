# VoetbalHub Redactie — prototype

Deze map bevat een redactiedashboard, een AI Worker, een RSS/Atom-inbox en een eenvoudige artikelen-API. De Worker moet nog in een Cloudflare-account worden uitgerold en getest met echte configuratie.

## Worker endpoints
- `GET /health`: status en beschikbare functies.
- `POST /inbox`: leest RSS/Atom-feeds uit `ALLOWED_FEED_URLS` (komma-gescheiden HTTPS-URL's), haalt maximaal 30 items per feed op en geeft ze terug als `needs_editor_review`. Optioneel slaat het de inbox op in Cloudflare KV via binding `EDITORIAL_KV`. Dit is geen feitencontrole.
- `POST /draft`: maakt een origineel artikelconcept op basis van aangeleverde feiten met de OpenAI Responses API. Minimaal twee feiten zijn verplicht.
- `GET /articles`: geeft artikelen met status `published` terug uit KV. Dit endpoint is bedoeld als lees-API voor een app.
- `POST /publish`: bewaart een artikel als gepubliceerd in KV, maar alleen met geldige `HUB_API_SECRET`, `approved: true`, minimaal twee als gecontroleerd aangeleverde feiten en minimaal één HTTPS-bron. Dit is een expliciete goedkeuringspoort, geen automatische feitenchecker.

## Cloudflare-configuratie
Worker secrets: `HUB_API_SECRET`, `OPENAI_API_KEY`. De repo bevat nu ook `wrangler.toml` met een Cloudflare Cron Trigger elke 15 minuten. Dit schema gaat pas lopen nadat de Worker in jouw Cloudflare-account is uitgerold en de configuratie is ingevuld.
Worker variables: `ALLOWED_FEED_URLS` met uitsluitend feeds waarvan de gebruiksvoorwaarden het beoogde gebruik toestaan; optioneel `OPENAI_MODEL` (standaard `gpt-4.1-mini`). Maak een KV namespace en koppel die aan de Worker-binding `EDITORIAL_KV`. Bewaar API-sleutels nooit in HTML of APK.

Voorbeeld concept-aanvraag:
```json
{"topic":"Onderwerp","category":"Eredivisie","format":"nieuws","facts":["Gecontroleerd feit 1","Gecontroleerd feit 2"],"sourceUrls":["https://officiele-bron.example/bericht"]}
```

Voorbeeld inbox-aanvraag: stuur `{}` naar `POST /inbox` met `Authorization: Bearer <HUB_API_SECRET>`.

Voor publicatie moet de server een artikelconcept, expliciete goedkeuring, gecontroleerde feiten en bron-URL's ontvangen. Bijvoorbeeld:
```json
{"approved":true,"category":"Eredivisie","verifiedFacts":["Gecontroleerd feit 1","Gecontroleerd feit 2"],"sources":[{"name":"Officiële bron","url":"https://example.org/bericht"}],"draft":{"headline":"Kop","standfirst":"Intro","body":["Alinea één","Alinea twee","Alinea drie"],"why_it_matters":"Waarom dit ertoe doet"}}
```

## Huidige beperkingen — belangrijk
- De Worker is **niet uitgerold** en niet getest met echte API-sleutels of echte feedbronnen. `wrangler.toml` is een startconfiguratie; voeg echte toegestane feeds en een KV-binding toe voordat je live gaat.
- Het dashboard is nog niet gekoppeld aan de Worker.
- RSS-items zijn nieuwsaanleidingen, geen geverifieerde feiten.
- De Worker heeft nog geen automatische geplande taak die feeds periodiek verwerkt.
- `/publish` controleert dat goedkeuring en bronvelden zijn aangeleverd; het verifieert niet zelfstandig of feiten waar zijn. Gebruik dit endpoint pas na redactionele controle.
- De Android-app is nog niet aangepast of gekoppeld aan `GET /articles`.
- Gebruik alleen bronnen met passende gebruiksrechten en controleer feiten, citaten en beeldrechten vóór publicatie.

## Volgende stappen
1. Configureer en deploy de Worker in het Cloudflare-account; zet secrets veilig.
2. Configureer toegestane feeds en KV, test met echte bronnen.
3. Voeg periodieke ingestie, deduplicatie en een controle-/auditlog toe.
4. Bouw een veilige redactionele goedkeuringsinterface.
5. Koppel de app aan `GET /articles` en bouw/test een nieuwe APK.
