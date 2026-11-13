# Redactionele kwaliteitscontrole | Veldio interlandweek | 13 november 2026

**Resultaat: feitelijke controle uitgevoerd; publicatie NIET vrijgegeven.**

## Controle per concept

1. **Nederland – Griekenland, voorbeschouwing:** speeldatum 13 november 2026, Nations League groep A2, aanvang 20.45 CET, Griekenland ongeslagen en eerder gelijkspel 2-2 geverifieerd in officiële UEFA-preview. Geen uitslag in een voorbeschouwing plaatsen. UEFA: https://www.uefa.com/uefanationsleague/news/02ab-220793bfb8a3-00d5842942af-1000--uefa-nations-league-matchday-5-preview-harry-kane-set-for-en/
2. **Italië – Frankrijk, verslag:** 3-1, vroege Olise-goal, gelijkmaker Pio Esposito, gemiste penalty Sebastiano Esposito, Frattesi en tweede Pio Esposito vanaf stip gecontroleerd. UEFA: https://www.uefa.com/uefanationsleague/news/02ab-220e66a3c090-9304054ed1ca-1000--uefa-nations-league-matchday-5-highlights-harry-kane-sends-/
3. **Engeland – Kroatië, verslag:** 2-1, Rogers, Sučić, Kane vanaf de stip, 126e interland Kane en kwartfinaleplaats gecontroleerd. Zelfde UEFA-bron.

## Niet aantoonbaar afgerond
- Centrale productie feed (`GET /articles?view=all`) was via beschikbare webtoegang niet leesbaar; doublurecheck niet afgerond.
- `GET /editorial-drafts` en `POST /publish` vereisen `HUB_API_SECRET` Bearer-toegang. De aangesloten GitHub/Render-acties bieden geen toegestane, geautoriseerde HTTP-publicatieactie; nooit credentials in repository of chat plaatsen.
- Definitieve rechtenvrije beeldselectie en vereiste productie-metadata/Flashscore-controle (bij wedstrijdresultaten) zijn niet afgerond.
- De artikelen zijn PR-concepten, geen productiedata. Een merge van deze Markdown-bestanden publiceert niets in de app.

## Publicatieprocedure via bestaande desk
- Controleer live feed/drafts op doublures en de drie bronbewijzen. Controleer per alinea claims, wedstrijdverificatie en rechtenveilige cover.
- Leg review vast in `/editorial-drafts` met huidige revisie en juiste payload. Laat centrale preflight alles controleren; bij match_reports geen ongekeurde handmatige publicatie.
- Publiceer alleen via bestaande `POST /publish`, controleer antwoord `status: published`, daarna dat alle drie unieke IDs in `GET /articles` verschijnen, en leg productiebewijs vast.

**Nooit aangeven dat deze drie live staan zonder productie-IDs en succesvolle feedcontrole.**
