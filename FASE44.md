# Veldio fase 44

De automatische publicatie en nieuwe wedstrijdbeelden gebruiken `editorial-image44.js`.
De bestaande geselecteerde beelden en columns worden niet gemigreerd of overschreven.

## Beeldcategorieën

- Wedstrijd: twee sjaals, gecontroleerde clubkleuren en volledige leesbare clubnamen op de stof.
- Transfer: tunnel/documenten voor onzeker nieuws; een lege presentatieruimte uitsluitend bij een expliciet geverifieerde bevestiging. Geen echte of nagebootste speler.
- Club: stadion, lege supportersplekken, trainingsveld, bestuurskamer of zakelijke voetbalomgeving. Maatschappelijk nieuws over twee clubs wordt geen wedstrijdbeeld.

AI-beelden gebruiken geen bestaande foto's, logo's, sponsors of herkenbare personen. De omgeving is fictief en de bronvermelding noemt AI-illustratie. Een modelcontrole is geen juridische garantie: geen claims over licenties op officiële merkbeelden worden afgeleid uit AI-generatie.

## Uitvoering en kosten

GitHub Actions gebruikt `OPENAI_API_KEY` voor generatie en pixelcontrole; bestaande redactiesleutels blijven `GROQ_API_KEY` en `HUB_API_SECRET`. Zonder eigen beeldsleutel gebruikt de workflow de beveiligde Render-beeldroute, zodat een bestaande Render-beeldsleutel niet hoeft te worden gekopieerd. Render reserveert maximaal twintig pogingen per Amsterdamse kalenderdag atomair in Redis. Geen sleutels in code of rapporten. Standaardmodellen: `gpt-image-1.5` en `gpt-4.1-mini`. Als ook Render geen beeldsleutel heeft, volgt expliciet de eigen neutrale illustratie, geen fotorealistisch beeld.

Elke unieke artikelversie krijgt een inhoudshash, eigen WebP en bewijsbestand op `editorial-media`. De pixelcontrole beoordeelt de uiteindelijke uitsnede, spelling op de sjaals, kleuren, relevantie, herkenbare personen, logo's en misleiding. Bij een kwaliteitsfout volgt maximaal één hergeneratie. Providerfouten krijgen geen blinde betaalde retries. Maximaal twintig generatiepogingen per redactieronde, maximaal vijftien publicaties per ronde en twintig per dag. Goedgekeurd identiek beeld wordt uit de gecontroleerde cache gebruikt. Een perceptuele hash blokkeert sterk gelijkende nieuwe AI-beelden.

De neutrale fallback is een zelf ontworpen veldillustratie met controleerbare tekst, geen nep-foto of beweerde gebeurtenis. Het rapport maakt AI-beeld en fallback afzonderlijk zichtbaar. Onbekende clubkleuren of een verkeerde clubkoppeling gebruiken geen verzonnen identiteit.

## Nieuws en Android

De bestaande bron-, actualiteits-, duplicaat-, Flashscore- en tweede redacteurscontrole blijven actief. Vijftien artikelen zijn een doel bij voldoende verifieerbare bronnen; controles worden niet verlaagd om het aantal te halen. Extra officiële ingangen bieden KKD- en internationale dekking.

Na publicatie wordt het artikel inclusief beeld opnieuw uit de openbare `/articles`-feed opgehaald. De Android-lijst is verhoogd van twaalf naar dertig kaarten zodat een ronde van vijftien artikelen zichtbaar kan zijn. De APK-workflow levert `Veldio-44-install.apk`, controleert debugondertekening en voert de bestaande installatietest uit op Android API 36. Een emulator vervangt geen fysieke Samsung S23-test.

## Validatie

`npm test` bevat categorisatie, clubkleuren, tekst-QA, één hergeneratie, kostenlimiet, provideruitval, mobiele WebP, visuele duplicaten en gecontroleerd cachehergebruik. Productiepublicaties, Render-revisie, APK-ondertekening en Android-resultaten moeten daarnaast aan de concrete run worden getoetst; alleen een gestarte workflow is geen geslaagde oplevering.
