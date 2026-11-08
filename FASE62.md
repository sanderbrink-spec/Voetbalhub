# Fase 62: centrale redactionele AI-router

De automatische redactie gebruikt één router voor feitenextractie, schrijven, revisie en onafhankelijke beoordeling. De handmatige conceptfunctie en bestaande taalbewerking gebruiken dezelfde interface. De oude transportfuncties blijven compatibel voor callers die een eigen fetcher injecteren; productie injecteert steeds de router.

| Provider | Model | Activering | Kostenbewaking |
|---|---|---|---|
| Groq | openai/gpt-oss-120b | Bestaande GROQ_API_KEY | Bestaande gratis toegang, lokale conservatieve dagbudgetten en providerlimieten |
| OpenRouter | openai/gpt-oss-120b:free | Bestaande OPENROUTER_API_KEY, live nulprijscontrole | Vast model, alle catalogusprijzen exact nul, max_price prompt/completion nul, geen automatische upstreamfallback |
| Gemini | gemini-2.5-pro | GEMINI_API_KEY of GOOGLE_API_KEY plus GEMINI_FREE_TIER_CONFIRMED=true | Blijft uit zonder expliciet bevestigde gratis projecttoegang; geen facturering activeren |

Een sleutel maakt een provider niet vanzelf geschikt. OpenRouter vereist een aanwezige, gratis modelvariant; ontbrekende, betaalde en onbekende prijzen blokkeren generatie. Gemini blijft uit zolang gratis projecttoegang en toepasselijke voorwaarden niet zijn bevestigd. De productiesleutels moeten in GitHub Actions staan; voor de backendconceptfunctie ook in Render. OPENAI_API_KEY wordt nooit gebruikt als tekstfallback.

De Nederlandse kwaliteitscontrole, onafhankelijke bewijsbeoordeling en publicatiedrempels 85 totaal, 85 journalistiek en 90 betrouwbaarheid blijven ongewijzigd. De beoordelaar krijgt de oorspronkelijke bronpassages opnieuw en kiest bij voorkeur een andere provider en modelfamilie. Dezelfde GPT-OSS-familie op een andere host wordt als dezelfde familie geregistreerd. Afwijzingen worden nooit technisch omgezet in goedkeuring.

Elke routeraanroep probeert maximaal eenmaal per provider, met uitsluitend de al bestaande ene GPT-OSS JSON-herstelpoging. Quota worden niet opnieuw geprobeerd. Retry-After en cooldowns blijven in de bestaande mediabranch bewaard. Verzoek- en tokenverbruik worden afzonderlijk bijgehouden; twee verzoeken en 10.000 tokens worden waar mogelijk vrijgehouden voor beoordeling. Deze lokale plafonds zijn aanvullende conservatieve beschermingen, geen garantie over accountbrede quota buiten deze keten. Werkelijk providerverbruik kan ook door andere diensten worden beïnvloed.

AES-256-GCM-checkpoints bewaren bewijs, kandidaat, concept, schrijver en aantal revisies versleuteld met HUB_API_SECRET. Alleen bij ongewijzigde broninhoud en binnen 24 uur wordt hervat. Iedere hervatting doorloopt de bewijs- en kwaliteitscontroles opnieuw. De bestaande maximale twee externe revisies blijven over procesherstarts heen gelden. Sleutelwisseling maakt oude checkpoints onbruikbaar; dan wordt opnieuw geverifieerd. Openbare wachtrijen bevatten geen leesbare bronpassages of concepten.

Het redactierapport bevat configuratie en providerTrace met taak, model, uitkomst en artikelwachtrij-ID. Geheimen, providerfoutteksten en prompts worden niet in de routertrace opgenomen. Een quotablokkade blijft een expliciete mislukte productieproef, nooit een GO.

Validatie: npm test omvat de bestaande regressies en 19 nieuwe routertests. De preflight in de Node-workflow controleert alleen sleuteltoegang en kosteloze metadata, zonder generatietokens. Een geslaagde test of preflight bewijst geen productiepublicatie. De bestaande live-article60-workflow verifieert Android pas na een werkelijk gepubliceerd artikel.

Geverifieerde primaire documentatie, 8 november 2026:

- https://openrouter.ai/openai/gpt-oss-120b:free
- https://openrouter.ai/docs/api/reference/limits
- https://openrouter.ai/terms/
- https://openai.com/open-models/
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/terms?authuser=00

OpenRouter vermeldt voor deze vaste variant nulprijzen en afzonderlijke gratis requestlimieten. Het GPT-OSS-model heeft een Apache-2.0-licentie voor commercieel gebruik, onder de modelgebruiksvoorwaarden. Gemini vermeldt een gratis modeltier, maar daarnaast voorwaarden voor API-clients in de EER en de koppeling met Paid Services; daardoor is een sleutel alleen onvoldoende om Gemini hier te activeren. Er is geen betaalde dienst aangezet.
