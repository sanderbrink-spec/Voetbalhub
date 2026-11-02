# Veldio fase 27: rechtenregister en goedkeuringsprocedure

31 oktober 2026. Dit is het feitelijke onderzoeks-/beheerregister, geen juridische vrijwaring. De machine-registers `content-rights.json` en `editorial-methods.json` zijn **leeg voor productie**. Testfixtures zijn geen licenties.

## 1. Bron- en productiemethoden

| Bron of methode | Onderbouwing | Toegestaan/actief in oplevering | Nog nodig |
|---|---|---|---|
| Eigen oorspronkelijke tekst uit zelf verzamelde en gecontroleerde feiten | Mogelijke eigen journalistieke route; feiten onderscheiden van beschermde formulering/selectie | Nieuwe technische methode beschikbaar, niet productie-actief | Concrete herkomst, rechtsgrond en onafhankelijke actuele feitenbasis |
| Door bronhouder toegestane gestructureerde feitenfeed | Toestemming moet daadwerkelijk ophalen, bewijsopslag, AI-input en commerciële afgeleide publicatie dekken | Geen feed fictief goedgekeurd | Twee onafhankelijke broneigenaars en exact toegestane URL's/gebruiksvormen |
| Wikidata gestructureerde data | [Officieel licentiebeleid](https://www.wikidata.org/wiki/Wikidata:Licensing) noemt CC0 voor specifieke gestructureerde namespaces | Onderzochte optie, geen actieve nieuwsfeed | Concrete records/verkrijging, actualiteit en onafhankelijke tweede bevestiging. Geen foto-/logo-overname afleiden uit CC0 |
| Openbare club-/KNVB-/competitiewebsites | Bereikbaarheid en primaire herkomst geven geen generieke automatiserings-/publicatietoestemming | Bestaande brede routes blijven geblokkeerd | Concrete rechtmatige methode of toestemming |
| VI / VoetbalPrimeur / Voetbalzone | Geen licentie voor vervangende artikelen ontvangen | Bestaand link-only-beleid; niet heractiveerd als grondtekst | Alleen als daadwerkelijk extra gebruik wordt gewenst: specifieke dekking of concrete wettelijke grond |
| Flashscore | Geen toestemming voor structurele databankextractie vastgesteld | Geen automatische scraper geactiveerd; bestaande handmatige feitencontrole blijft | Toegestane wedstrijdgegevensroute en werkelijk controlebewijs |
| Eredivisie / ESPN / API-Football / overige statistiekfeeds | Contract-/databank-/beeldrechten niet voldoende bewezen | Oude statistiek- en beeldpoorten behouden | Accountvoorwaarden en concrete publicatie-/cache-/beelddekking |
| Groq tekstgeneratie | [Services Agreement](https://console.groq.com/docs/legal/services-agreement) laat verantwoordelijkheid voor inputs/output bij klant | Adapter aanwezig; geen betaald of echt productieconcept gestart | Werkelijk account/model, quota, privacyafspraken en toegestane inputs |
| Eigen Node/SVG/Sharp-illustratie | Nieuwe eigen geometrie, tekstuele namen en veldlijnen; geen externe foto of logo | Technisch gerenderd en gecontroleerd; automatische vrijgave mogelijk binnen echte methodetoestemming | Methodebeoordeling, fontvoorwaarden en merk-/presentatiecontext |
| Externe AI-beeldgeneratie | Bestaande route vereist eigen invoer-/dienstbewijs | Niet nodig voor nieuwe goedkope beeldenroute; niet geactiveerd | Alleen bij later gebruik: dienst-/input-/outputrechten afzonderlijk |
| YouTube | Officiële embed behouden; metadata-/selectie- en privacyvoorwaarden afzonderlijk | Geen nieuwe videofeed vrijgegeven | Toegestane verkrijgingsroute, concrete video-/doelgroepstatus en echte netwerkcontrole |

Een gegeven dat 'feitelijk' heet kan nog op een onrechtmatige manier zijn verkregen. Een model dat nieuwe zinnen maakt, bewijst niet dat de inputmethode, selectie of output rechtmatig is. Daarvoor blijft de uitgever verantwoordelijk.

## 2. Herbruikbare goedkeuring en concrete publicatie

De methodeconfiguratie staat in een afzonderlijk beheerbestand via `EDITORIAL_METHODS_FILE`. Elke methode moet een vaste identiteit, model, bestaande categorieën en twee of drie onafhankelijke feitenfeeds hebben. De gebruiksrechten zijn expliciete onderdelen van de descriptor: `fetch`, `store-evidence`, `ai-input`, `publish-derived`, `commercial` en `own-artwork`. Dit zijn te onderbouwen bevoegdheden, geen vinkjes die vanzelf rechten geven.

Bron-URL's zijn vaste HTTPS-adressen zonder credentials of querytokens. Een eventueel feedtoken wordt alleen via een daarvoor benoemde serveromgevingvariabele gebruikt. Eigenaarsgroepen moeten werkelijk onafhankelijk zijn; twee domeinen van dezelfde bron tellen niet automatisch als onafhankelijk.

1. Leg het echte dossier vast, met bronhouder, rechtsgrond, contract/voorwaarden, toepassingsbereik, duur, bewijsopslag, attributie, AI-gebruik en intrekking. Bewaar geen privécontracten in de publieke repository.
2. Vul de methodeconfiguratie met uitsluitend geverifieerde gegevens. `node scripts/method-review.js METHODE_ID` berekent de exacte implementatie-/beleidsdescriptor en een **pending**-goedkeuringsrecord.
3. Na echte beoordeling kan de beheerder dat specifieke record als `approved` opnemen in het beschermde `CONTENT_RIGHTS_FILE`, met dossierverwijzing, beoordelaar, datum en einddatum. Een tekstuele verwijzing zonder werkelijk dossier bewijst niets.
4. De server valideert daarna elke concrete bronversie, alle feiten, tekst, kwaliteit, categorie, beeldbytes en duplicaten. Alleen na succes wordt een ondertekende receipt gemaakt. Er is geen clientroute om zo'n receipt zelf te maken.
5. Bij code-, model-, bron-, rechten- of categorie-aanpassing verandert de descriptor. Dan is nieuwe goedkeuring nodig. Verval of intrekking maakt nieuwe en bestaande betrokken publieke inhoud niet meer toegelaten.

Het oorspronkelijke per-artikelregister blijft bruikbaar voor afzonderlijk beoordeelde handmatige content. Een expliciet ingetrokken record krijgt voorrang op een dubbel bestaand goedkeuringsrecord. Operationele artikelintrekking via `POST /editorial-revoke` wordt eveneens afgedwongen. Oude clientcaches kunnen nog maximaal binnen hun geldigheidsvenster zichtbaar blijven; elders opgeslagen oude publicaties moeten afzonderlijk worden beoordeeld.

### Feitenfeedcontract

De adapter verwacht JSON met `schemaVersion:1` en een lijst `events`. Een event bevat een gedeelde `eventId`, `kind:announcement`, titel, afgesproken categorie, geldige actuele `publishedAt` en vier tot tien feiten met een eigen `id` en korte zelfstandige feittekst. De feiten moeten in de onafhankelijk geregistreerde feeds overeenkomen. Dit is een uitwisselingscontract, geen reden om artikelen van derden naar dit formaat te kopiëren.

Alleen de categorieën die de bestaande app begrijpt en de methodebeoordeling heeft toegestaan worden gebruikt. Bij onvoldoende onafhankelijke feiten, conflict, veroudering of gebrek aan nieuwswaarde hoort de route te stoppen. De eerste methode dekt geen uitslagen, citaten, transfergeruchten of wedstrijdanalyse.

## 3. Lokale beeldinventaris

Status 'behouden in testpakket' is geen vrijgave voor openbare verspreiding. De afbeeldingbestanden hieronder zijn geïnventariseerd met hash. Het nieuwe productiemodel kan dure externe beelden vermijden; het hoofdlogo en het bestaande portret zijn conform opdracht niet gewijzigd.

| Bestand | SHA-256 | Status |
|---|---|---|
| `public/article-covers/emmen-den-bosch-2026-11-01.webp` | `a00bee2a9803eb67ef2d3c883280dfca930b59f05b77a202f449390ff75d42a5` | Niet algemeen vrijgegeven; concrete herkomst/rechten nodig. Oude beeldpoorten blijven gelden |
| `public/article-covers/groningen-emmen-2026-10-29.webp` | `470eda17010b72410daa6585f6139ae9db7278cb6432d209b462d66c124ca02d` | Niet algemeen vrijgegeven; concrete herkomst/rechten nodig. Oude beeldpoorten blijven gelden |
| `public/brand/veldio-logo.png` | `efc63ba8d212c9c953295d171ff9cf2ffa01c993dec4ec872ecb1bf53f643ccc` | Behouden, byte-identiek; eigen herkomst en merkonderzoek nog bevestigen |
| `public/editorial/football-background.webp` | `096cbefaf4efe666faf7a99f93500c61c9fd43a8f6d9ef8619eb13268292e268` | Niet algemeen vrijgegeven; concrete herkomst/rechten nodig. Oude beeldpoorten blijven gelden |
| `public/stadiums/philips-stadion.jpg` | `cb5779d1d74c08da86fc9ae7feda5ca5f4aa73f0b9b0276dc41f3ca75515a0b2` | Niet vrijgegeven; toestemming of gerichte vervanging nodig vóór openbaar gebruik |
| `android-ui/drawable-nodpi/column_sander_brink_clean.webp` | `c9bdb426e3b7e6f34cd4a33c916205d1d128ae39bdbf5cdda42bf67b26f7d4c3` | Behouden, byte-identiek; fotograaf-/inputrechten bevestigen |
| `android-ui/drawable-nodpi/veldio_logo.png` | `efc63ba8d212c9c953295d171ff9cf2ffa01c993dec4ec872ecb1bf53f643ccc` | Behouden, byte-identiek; eigen herkomst en merkonderzoek nog bevestigen |

De eigen nieuwe renderer gebruikt geen clubbeeldmerken. Tekstuele clubnamen kunnen redactioneel identificeren, maar vormen geen algemene toestemming voor iedere commerciële presentatie. De fontkeuze en distributiewijze moeten de relevante [DejaVu-voorwaarden](https://dejavu-fonts.github.io/License.html) respecteren. Het bronpakket levert geen nieuw fontbestand mee.

## 4. Merken- en handelsnaamonderzoek

| Ingang / zoekopdracht | Werkelijk resultaat | Conclusie |
|---|---|---|
| BOIP Merkenregister en Merkcheck | Pagina geopend; alleen invoerveld leesbaar | Geen afgeronde resultaatzoeking |
| EUIPO eSearch | 502 | Geen resultaatset |
| TMview | Geen leesbare regels | Geen resultaatset |
| KVK-zoeken op Veldio | URL niet toegankelijk via de beschikbare toegang | Geen afgerond handelsregisteronderzoek |
| WIPO Global Brand Database | Captcha | Niet doorzocht; geen bypass toegepast |
| Openbare zoekopdrachten Veldio, Veldia, Veldyo en domeinbeperkte BOIP/EUIPO/KVK-queries | Signalen voor onder andere Veldio-meubelen en een Veldio-Etsy-winkel; geen bruikbare complete registerresultaten | Signalen nader onderzoeken; geen bewijs van registratie, beschikbaarheid of inbreuk |

Vastgelegde publieke signalen: [Selsey-meubelvermelding](https://www.bol.com/nl/nl/p/selsey-veldio-schoenenkast-drie-niveaus-wandmontage-50-cm-zwart/9300000194600290/), [Veldio by Selsey](https://www.home24.nl/product/tv-meubel-veldio-731e) en [Etsy Veldio](https://www.etsy.com/shop/Veldio). Deze links zijn onderzoekssignalen, geen officiële merkenregisterbewijzen of juridische conclusie.

Nog vereist: actuele registerexports met naamdelen, gelijkende klank/spelling, beeldmerkvergelijking, territorium, houder, status en relevante software-/nieuws-/uitgeversdiensten. Beoordeel betekenisvolle treffers op daadwerkelijke verwarringskans en diensten. Er wordt geen naamswijziging of nieuw hoofdlogo voorgesteld zonder besluit van de eigenaar.

## 5. Bewijs dat nog ontbreekt

Het minimale externe pakket bestaat uit: de echte exploitant en privacykeuzes; twee onafhankelijke toegestane actuele feitenkanalen of een andere concreet beoordeelde productie-inputmethode; herkomst-/gebruiksbevestiging voor eigen logo/portret; volledige merk-/handelsnaamresultaten; toepasselijke Groq-/hosting-/mail-/Google-accountafspraken. Er is niet automatisch een dure nieuws- of beeldlicentie nodig. Onnodige externe content kan geblokkeerd blijven terwijl de eigen methode wordt vrijgegeven.

Geen van deze stukken is in deze opdracht verzonnen, ondertekend namens de eigenaar of bij een rechthebbende aangevraagd/verstuurd. De concrete eigenaarshandelingen staan in `Veldio-27-laatste-acties.md`.
