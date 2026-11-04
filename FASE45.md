# Veldio fase 45: validatie en resterend werk

Basis: `eb373c27dda60292f21f43eaa0a2a9bb87cfccfd`, de succesvolle herstelbuild 41817250475. Herstelbranch: `backup/veldio-45-base-eb373c27`. De Android-bron wordt rechtstreeks uit Git gebouwd. Geen ZIP-invoer. Alle 134 goedgekeurde assets blijven byte voor byte gelijk.

## Uitgevoerd

- Daglimiet 15 artikelen, maximaal 4 per run. Prioriteit Ajax, Feyenoord, PSV; daarna Twente, AZ, Groningen. Bestaande landelijke relevantie- en KKD-poorten blijven actief.
- Zes gewogen journalistieke criteria. Publicatie vereist minimaal 85/100, minimaal 90 voor betrouwbaarheid en minimaal 70 per criterium. Ontbrekende, ongeldige of onvoldoende beoordelingen blokkeren publicatie. Letterlijk bronbewijs, twee onafhankelijke primaire bronnen, originaliteit en de tweede feitenredactie blijven afzonderlijk vereist. De AI-beoordeling is geen garantie op juistheid.
- Wachtrij op de bestaande mediabranch. Bronverwijzingen en bronhashes blijven over runs behouden. Maximaal vier pogingen met oplopende vertraging. Redactionele afkeuring gaat naar review; tijdelijke providerfouten worden later opnieuw geprobeerd. Checkpoints gebruiken de actuele GitHub-bestands-SHA; mislukte opslag blokkeert verder werken. Geen bronteksten of geheime sleutels in deze publieke wachtrij.
- Bestaande beeldpipeline met benoemde clubsjaals en varianten voor club- en transfernieuws blijft intact. Budget verlaagd naar acht beeldproviderverzoeken per run. Geen nieuwe diensten.
- Wedstrijdkaart bewaart de laatste geldige inhoud afzonderlijk. Bij ontbreken daarvan verschijnt een FC Groningen-clubspotlight met een werkende route naar het Eredivisie-overzicht. Netwerkverzoek heeft nu een totale deadline van 18 seconden.
- Package `nl.voetbalhub.app1`, appnaam Veldio, versie `4.45-test`, versiecode 85. Build verifieert assets, manifest, signatuur en herkomst. Android 16-test rapporteert de juiste versie.

## Validatie

Lokale controles: 247 tests, 239 geslaagd, acht bestaande Redis-integratietests overgeslagen zonder testdatabase. Broncontrole en diffcontrole slagen. GitHub-build en Android 16-resultaat moeten nog worden toegevoegd. Een fysieke Samsung Galaxy S23 is niet getest.

## Blokkades en beperkingen

- De live API meldde op 4 november 2026 revision `fd9b760e11d5226850754d14e24b1ee31d3b0ee5`. De herstelcommit staat nog buiten main. Deze wijziging wordt eerst als aparte branch aangeboden.
- Render heeft geen geselecteerde werkruimte. Enige gevonden werkruimte: My Workspace, `tea-dbdn0ba9lscs73cau5q0`. Expliciete selectie ontbreekt; er is niets op Render gewijzigd.
- Het contactformulier mist `RESEND_API_KEY` en `CONTACT_FROM`. Er is geen werkende mailbezorging aangetoond. Sleutels moeten via beveiligde instellingen worden geconfigureerd.
- `AdController` schakelt alle slots uit en bevat geen AdMob-SDK. Test-ID's in AdSettings vormen geen werkende advertentie-integratie. Publieke advertenties zijn niet vrijgegeven.
- Productieondertekening en installatie over een bestaande APK zijn niet bevestigd. De workflow bouwt een debug-APK; een andere debughandtekening kan een rechtstreekse update verhinderen.
- Er is geen volledige productieproef van de nieuwe redactie uitgevoerd. Vijftien artikelen is een maximum en doel, geen gegarandeerd aantal. Wachtrijitems met status review worden in het runrapport en de mediabranch bewaard; er is nog geen nieuwe reviewpagina.
- Privacy-, rechten- en Play Store-controle en een volledige visuele eindcontrole moeten nog worden afgerond. Bestaande bron-whitelists zijn geen bewijs van gebruiksrechten.

## Voorlopige lanceringsbeoordeling

5/10. De herstelbasis en geteste publicatiepoorten bieden een bruikbare basis. Een gecontroleerde productieproef, mailconfiguratie, advertentiebesluit, releaseondertekening en Android-eindcontrole ontbreken nog. Geen publieke lancering uitgevoerd of vrijgegeven.
