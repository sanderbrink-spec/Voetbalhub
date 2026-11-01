# Beheer van de eigen redactiemethode

Lees eerst Veldio-27-rechtenregister.md. De registers zijn bewust leeg. De nieuwe route heeft geen extra beeldservice en geen Python-runtime nodig: Node/Redis/Sharp is de primaire stack.

Configureer echte methoden in een beschermd bestand via `EDITORIAL_METHODS_FILE`. Maak per methode velden `id`, `model`, `allowedCategories`, `permissions` en `feeds`. Categorieën zijn beperkt tot de bestaande Eredivisie/Buitenland/Voetbal-routes; feeds moeten dezelfde categorie bevestigen. Elke feed bevat een vaste HTTPS-`url`, een werkelijk onafhankelijke `ownerGroup`, een private `evidenceRef` en eventueel een servercredentialnaam `authEnv` beginnend met `FEED_`. Geen token in de URL.

De permissies `fetch`, `store-evidence`, `ai-input`, `publish-derived`, `commercial`, `own-artwork` mogen pas true zijn wanneer de werkelijke rechtsgrond dit dekt. `node scripts/method-review.js ID` produceert een descriptor/hash en pending record; geen toestemming. Zet na echte beoordeling uitsluitend het exacte bijbehorende bewijsrecord in het via `CONTENT_RIGHTS_FILE` beschermde register. Codewijzigingen veranderen de descriptor.

Benodigde afzonderlijke serversecrets: de bestaande beheersleutel `HUB_API_SECRET`, een sterke `HUB_AUTOMATION_SECRET` voor alleen de scheduler, `EDITORIAL_RECEIPT_SECRET` van minimaal 32 tekens voor serverbewijzen en het daadwerkelijke `GROQ_API_KEY`. Bewaar ze niet in broncode of APK. Gebruik afzonderlijke willekeurige waarden. `/automation/status` is geautoriseerd en toont methode-/configuratiestatus; een true route-status is geen algemene lanceer-GO.

`POST /automation/run` accepteert uitsluitend een bestaande methodId. HTTP 202 betekent gestart, niet gepubliceerd. Lees daarna `GET /automation/runs/RUN_ID`. De opt-in workflow autonomous-own-editorial.yml werkt pas na `VELDIO_AUTONOMY_APPROVED=1` en een juiste `EDITORIAL_METHOD_ID`; stel die pas in na echte vrijgave en deploymenttoestemming. De oude algemene bronpoorten blijven dicht.

Herstel bewaart precieze concepten en pending-bewijzen. Afwijzingen of gewijzigde teksten worden niet automatisch overruled. `POST /editorial-revoke` met de beheersleutel, articleId, approved:true en een reden trekt een concrete bijdrage in. De scheduler kan dit niet. Bewaar de rechten-/methodebestanden, dossiers en secrets afzonderlijk veilig voor herstel; zij zitten niet als geheime accountconfiguratie in de data-back-up.

`node scripts/backup-editorial.js export PRIVATE_FILE` maakt met `REDIS_URL` en een afzonderlijke base64 AES-256-`EDITORIAL_BACKUP_KEY` een versleutelde back-up. Herstel gebruikt `restore-empty PRIVATE_FILE` en vereist `CONFIRM_EMPTY_RESTORE=1`; stop de schrijvende app en gebruik een lege gecontroleerde doelomgeving. Er wordt niets overschreven. Alleen uitvoeren binnen expliciet geautoriseerde productiehandelingen. Bewaar back-up en sleutel gescheiden en test herstel. Geen productieback-up is tijdens deze opdracht gemaakt.
