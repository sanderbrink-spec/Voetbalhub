# Rechtencontrole voor beheerders

De lege `content-rights.json` keurt niets goed. Gebruik in productie een afzonderlijk, afgeschermd bestand via `CONTENT_RIGHTS_FILE`. Dit bestand is geen HTTP-resource. Alleen de beheerder met toegang tot de hostingconfiguratie mag vrijgaven aanpassen. Contracten, namen van private contactpersonen en geheime sleutels horen niet in het broncodearchief. Een bewijsverwijzing verwijst naar een afzonderlijk bewaard dossier.

`node scripts/rights-review.js SCOPE PRIVATE_INPUT.json` berekent uitsluitend een SHA-256 en een record met status `pending`. Het script verleent geen rechten. Laat eerst het dossier beoordelen, vul vervolgens de onderbouwde rechtsgrond (`basis`), dossierverwijzing (`evidenceRef`), verantwoordelijke beoordelaar (`reviewer`), datum (`reviewedAt`) en einddatum (`validUntil`) in. Alleen een record met `status: approved` en een overeenstemmende inhoudshash wordt toegelaten. Een jurist of rechthebbende hoeft niet elk artikel opnieuw goed te keuren als een toereikende bestaande toestemming of wettelijke grond aantoonbaar de concrete toepassing dekt. De uitgever moet die beoordeling wel vastleggen. Een fictief ingevulde verwijzing bewijst juridisch niets.

Scopes en exacte invoer:

| Scope | Invoer voor de hash |
|---|---|
| `publication` | Definitief artikelobject zoals de server het opslaat/toont, inclusief auteur, kop, intro, tekst, categorie, bron- en beeldgegevens. De module selecteert de relevante velden. ID, publicatiedatum en de automatisch toegevoegde `imageReview.reviewedAt` vallen erbuiten. De server voegt geen ongecontroleerde cover aan een vrijgegeven artikel toe: ook de uiteindelijke weergave wordt gehasht. |
| `ai-input` bij `/draft` | Object met `topic`, `facts` en `sourceUrls`, overeenkomstig de door de route begrensde invoer. Verifieer ook de AI-dienst en verwerking van persoonsnamen. |
| `ai-input` bij `/auto-inbox` | Het voorbereide bronitem inclusief `sourcePolicy`. Link-only-items worden niet aan AI aangeboden. |
| `image-input` | Volledige JSON-invoer voor `/generate-article-image`. |
| `asset-access` | Object met `url`: toestemming om een eigen externe beeld-URL op te halen. |
| `asset` | Object met `url` en `sha256` van de oorspronkelijke beeldbytes; voor lokale covers het pad `/article-covers/bestand.webp`, voor externe beelden de exacte bron-URL. Gewijzigde bytes vereisen een nieuwe vrijgave; ook bij een cachehit controleert de server de oorspronkelijke beeldhash. Gebruik daarnaast bij voorkeur onveranderlijke, eigen URLs. |
| `snapshot-access` | Object met `url` van de vaste statistiek- of videofeed. Dekt het ophalen en verwerken van de bron. |
| `snapshot-content` | Object met dezelfde `url` en de volledige JSON onder `data`. Dekt de concrete getoonde versie, met logo-/beeldrechten waar aanwezig. |
| `feed-access` | Worker: object met exacte feed-`url`; naast de bestaande feedpoort. |

De Worker gebruikt zijn eigen serversecret `CONTENT_RIGHTS_JSON` in hetzelfde registerformaat. De Worker-hash voor `ai-input` omvat de volledige daar ontvangen request-JSON. De Node-route gebruikt het hierboven beschreven kleinere object. Publiceer geen contracten in een Worker-variabele die als publieke configuratie wordt beheerd.

Bij intrekking: zet het record op `revoked` of verwijder het. De Node-server leest het bestand per beslissing opnieuw. Publieke artikelen en snapshots worden vervolgens geweigerd. Android accepteert uitsluitend antwoorden met beleidsversie 26; toegelaten caches verlopen uiterlijk na vijf minuten of eerder bij het verlopen van een vrijgave. Dit wist geen persoonlijke favorieten en verwijdert geen oude externe publicaties. Publicaties/media die al elders staan moeten afzonderlijk worden geïnventariseerd en ingetrokken. Oudere APK's handhaven dit beleid niet.

De automatische CLI-poorten blijven uit zolang de onderliggende bronmethode niet is vrijgegeven. Het inschakelen van een boolean vervangt het bewijsregister niet. Bestaande kwaliteits-, feiten-, revisie- en dubbelingscontroles blijven gelden. Zonder aantoonbaar vrijgegeven bronnen is geen automatische productieredactie geactiveerd.
