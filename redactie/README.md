# VoetbalHub Redactie — prototype

Deze map bevat een redactiedashboard, een AI Worker, een RSS/Atom-inbox en een eenvoudige artikelen-API. De Worker moet nog in een Cloudflare-account worden uitgerold en getest met echte configuratie.

## Worker endpoints
- `GET /health`: status en beschikbare functies.
- `GET /inbox`: haalt opgeslagen nieuwsleads op (vereist Bearer-token).\n- `POST /inbox`: leest RSS/Atom-feeds uit `ALLOWED_FEED_URLS` (komma-gescheiden HTTPS-URL's), haalt maximaal 30 items per feed op en geeft ze terug als `needs_editor_review`. Optioneel slaat het de inbox op in Cloudflare KV via binding `EDITORIAL_KV`. Dit is geen feitencontrole.
- `POST /draft`: maakt een origineel artikelconcept op basis van aangeleverde feiten met de OpenAI Responses API. Minimaal twee feiten zijn verplicht.
- `GET /articles`: geeft artikelen met status `published` terug uit KV. Dit endpoint is bedoeld als lees-API voor een app.
- `POST /publish`: bewaart een artikel als gepubliceerd in KV, maar alleen met geldige `HUB_API_SECRET`, `approved: true`, minimaal twee als gecontroleerd aangeleverde feiten en minimaal één HTTPS-bron. Dit is een expliciete goedkeuringspoort, geen automatische feitenchecker.

## Dashboard online zetten
De workflow `.github/workflows/redactie-pages.yml` maakt een downloadbaar dashboardpakket als GitHub Actions-artifact; deze workflow host de pagina niet live. Het pakket staat bij de workflow-run onder **Artifacts**. Voor live gebruik moet het dashboard nog worden gehost op een vaste HTTPS-origin.
Zet vervolgens in Cloudflare de variabele `ALLOWED_ORIGINS` op de exacte origin `https://sanderbrink-spec.github.io` (zonder pad of afsluitende slash). De dashboard-URL en de Worker-URL zijn verschillend; zonder deze allowlist werkt de browserkoppeling niet. Voer de API-sleutel alleen in op het dashboard wanneer je de pagina vertrouwt; de sleutel wordt niet door de pagina opgeslagen.

## Cloudflare-configuratie
Worker secrets: `HUB_API_SECRET`, `OPENAI_API_KEY`. De repo bevat nu ook `wrangler.toml` met een Cloudflare Cron Trigger elke 15 minuten. Dit schema gaat pas lopen nadat de Worker in jouw Cloudflare-account is uitgerold en de configuratie is ingevuld.
Worker variables: `ALLOWED_ORIGINS` (komma-gescheiden exacte origins die de API mogen aanroepen, bijvoorbeeld `https://sanderbrink-spec.github.io`; voeg geen wildcard toe), `ALLOWED_FEED_URLS` met uitsluitend feeds waarvan de gebruiksvoorwaarden het beoogde gebruik toestaan; optioneel `OPENAI_MODEL` (standaard `gpt-4.1-mini`). Maak een KV namespace en koppel die aan de Worker-binding `EDITORIAL_KV`. Bewaar API-sleutels nooit in HTML of APK.

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
- Het dashboard heeft nu CORS-ondersteuning nodig via `ALLOWED_ORIGINS`; vul daar de exacte origin in waarop je het dashboard host. Het dashboard is nog niet live gehost of getest tegen een gedeployde Worker.
- RSS-items zijn nieuwsaanleidingen, geen geverifieerde feiten.
- De Worker bevat een scheduled handler en `wrangler.toml` plant de inbox elke 15 minuten in; opgeslagen leads zijn nu via `GET /inbox` met Bearer-token op te halen. Dit werkt pas na een succesvolle Cloudflare-deploy met juiste variabelen en KV-binding.
- `/publish` controleert dat goedkeuring en bronvelden zijn aangeleverd; het verifieert niet zelfstandig of feiten waar zijn. Gebruik dit endpoint pas na redactionele controle.
- De Android-app is nog niet aangepast of gekoppeld aan `GET /articles`; dit is nog een afzonderlijke bouwstap.
- Gebruik alleen bronnen met passende gebruiksrechten en controleer feiten, citaten en beeldrechten vóór publicatie.

## Volgende stappen
1. Configureer en deploy de Worker in het Cloudflare-account; zet secrets veilig.
2. Configureer toegestane feeds en KV, test met echte bronnen.
3. Voeg periodieke ingestie, deduplicatie en een controle-/auditlog toe.
4. Bouw een veilige redactionele goedkeuringsinterface.
5. Koppel de app aan `GET /articles` en bouw/test een nieuwe APK.
