# Veldio beeldredactie, fase 32

Standaardnieuwsbeelden zijn echte geregistreerde foto's; een afzonderlijk goedgekeurd AI-stilleven is alleen een alternatief wanneer passend rechtmatig fotomateriaal ontbreekt. De negen foto’s in `news-photo-catalog.json` zijn afzonderlijk gecontroleerd op stadionidentiteit, beeldkwaliteit, bronmetadata en hergebruiklicentie. De primaire Commons-metadata staat in `news-photo-rights-evidence.json`. De bewerkte WebP-bestanden in `public/news-photos` behouden de per beeld genoemde CC BY- of CC BY-SA-licentie. Deze beeldlicenties verlenen geen licentie op de applicatiecode.

De maker, oorspronkelijke bron, licentielink en de bewerking (uitsnede en WebP-conversie) staan in de catalogus, het meegeleverde attributiebestand en de artikelreader. Dit zijn archieffoto’s van de genoemde stadions. Zij documenteren geen wedstrijd van dit weekend en tonen geen specifieke speler die in een kop genoemd wordt. Context wordt ook op de slideshow vermeld. Er zijn geen nieuwe clublogo’s overgenomen en geen fictieve personen of wedstrijdsituaties gegenereerd.

`newsroom-images.js` kiest eerst een inhoudelijk passend geregistreerd beeld en weigert afbeeldingen met ontbrekende rechten/maker, ingetrokken toestemming, verkeerde club, onjuiste hash, ontbrekende voorafgaande visuele beoordeling, te lage resolutie, afwijkende verhouding of onvoldoende technische detailmetingen. SHA-256 voorkomt herhaling van dezelfde foto in toekomstige autonome artikelpublicaties. De beeldredactie maakt onderscheid tussen wedstrijd, transfer, interview, maatschappelijk nieuws en clubnieuws. Een stadionfoto blijft bij transfers/interviews herkenbaar contextbeeld, geen portret van de genoemde persoon.

`own-editorial-art.js` en `scripts/render-editorial-cover.py` zijn compatibiliteitsingangen voor dezelfde fotografische selectie. Er is geen scorebord- of vectorfallback meer voor gewone artikelen. Ook nieuwe weekverslagen gebruiken een foto, met de uitslag in HTML/apptekst en gescheiden feitelijke metadata.

De catalogus is een begrensde beginvoorraad, geen onbeperkte fotobron. Als alle passende beelden al zijn gebruikt, blijft het artikel ter beeldbeoordeling staan. Er wordt dan geen nep-wedstrijdfoto gemaakt. Uitbreiding vereist aanvullende relevante foto's met vastgelegde rechten en een echte visuele controle. Een betaald AI-beeldmodel of automatische visuele AI-keurder is niet geconfigureerd; er worden geen modelkeuringen verzonnen en geen nieuwe betaalde diensten aangezet.

De negen echte foto’s hebben geen licentiekosten. Daarnaast is één AI-stilleven gemaakt met de ingebouwde imagegen-tool voor de Willem II-voorbeschouwing, omdat de gevonden vrije stadionfoto’s te klein zijn. Dit is een afzonderlijke creatie binnen deze opdracht; er is geen betaalde beeld-API aan de automatische backend gekoppeld. Het beeld heeft een zichtbare AI-vermelding, geen spelers of logo’s, en documenteert geen echte gebeurtenis. Het generatiebewijs en de exacte prompt staan in `news-photo-ai-provenance.json`. Een 1280 × 720 WebP kost ongeveer 113–221 KiB; netwerkverkeer en opslag blijven afhankelijk van hosting en publiek. Lokale appbundeling en bitmapcaching vermijden herhaalde downloads van de huidige acht vervangingen. Het is geen onbeperkte gratis fotodienst en geen algemene juridische lanceringstoestemming voor alle bestaande content.

## Nieuwe beelden toevoegen

1. Controleer de primaire bestandsbeschrijving, maker, commerciële hergebruikrechten en eventuele beperkingen. Bewaar de bronmetadata.
2. Controleer stadion/persoon, datum, scherpte en uitsnede visueel. Gebruik een echte nieuwsfoto uitsluitend voor de gedocumenteerde gebeurtenis; anders expliciet archief/context.
3. Exporteer ten minste 1280 × 720 zonder opschalen van een te kleine uitsnede. Registreer bron- en uitvoerhash, maker, licentie, bewerkingen en concrete onderwerpen. Publiceer gewijzigde CC BY-SA-beelden onder dezelfde licentie.
4. Voeg de goedgekeurde foto aan de catalogus toe en voer de beeldtests uit. Een ingetrokken of gecorrigeerde bron wordt uitgesloten en onderzocht.

Referentie: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/licenses
