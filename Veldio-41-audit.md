# Veldio fase 41: app-audit en Android-test
Datum: 3 november 2026.

## Oordeel
De testversie is verbeterd. Een algemene 9/10 of commerciële lanceer-GO is niet onderbouwd. Contactbezorging, automatische redactie, wedstrijdgegevens en video's blijven productieblokkades. Fase 41 is daarom niet als volledige productieafronding afgemeld.

## Herkomst en wijzigingen
Uitgangspunt: fase 40, commit dcc93c082b0cb3022ff4b08693ffa1d2e1bc8a4a, met succesvolle Android 16-installatieworkflow 41607245938. De APK en Render bleken verschillende branches te gebruiken. De bestaande Render-backend is live op main, commit 5a24f59819907593ba5bb08a840a6fe3c269e12b. De Android-wijzigingen staan op work/veldio-41; deze audit vervangt geen backendmigratie.

Werkelijk gewijzigd:
- Kopiëren van het redactieadres wist het contactconcept niet meer. Een ontbrekende native verzendbevestiging maakt na 45 seconden opnieuw proberen mogelijk, met hetzelfde verzoeknummer en bewaarde tekst. Het native verzoek heeft een totale deadline van 40 seconden. Afgesloten contactschermen worden opgeruimd.
- Nieuwsafbeeldingen hebben een totale netwerkdeadline van 15 seconden. Een verdwenen kaart krijgt geen late schermupdate. Premium illustraties gebruiken een begrensde bitmapcache van 16 MiB.
- Vernieuwen van video's kan geen wachtrij van gelijktijdige laadverzoeken opbouwen. De interface toont een laadstatus; verlopen vrijgaven worden niet weergegeven. Verlopen statistiekdata wordt niet opnieuw aan het scherm geleverd. Een eindstatus zonder twee geldige scores toont een ontbrekende eindstand, geen verzonnen uitslag.
- Aanvullende formuliertests, scoreweergavetest en geïsoleerde HTTP/Redis-test met twintig gelijktijdige spelers en dubbele antwoordverzoeken toegevoegd. De eerste belastingstest raakte terecht de aanmeldlimiet van twaalf accounts per adres per uur; de test gebruikt nu afzonderlijke gesimuleerde clientadressen. Productiebeveiliging is niet verlaagd.

Het logo, de premium huisstijl, de bestaande slideshow-geometrie en gepubliceerde auteurscolumn zijn behouden. Geen bestaande quizresultaten of productieprofielen gewist. De APK heeft een afzonderlijke testidentiteit; bestaande installaties en hun lokale voorkeuren blijven staan.

## Controles
Broncommit voor de APK: [ef5b304995c0b1bf7b194f4ba2fcdcc7974efaa1](https://github.com/sanderbrink-spec/Voetbalhub/commit/ef5b304995c0b1bf7b194f4ba2fcdcc7974efaa1).
[Workflow 41670194925](https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41670194925): **success**, zowel api-test-and-build als android-brand-smoke.

- Automatisch: **323 Node/Redis-tests geslaagd, nul fouten, nul overgeslagen** in de volledige Redis-run; zes Python-tests; Java-controles voor navigatie, kolomgoedkeuring, invoergrenzen, advertentiegates en totale HTTP-deadlines.
- Browser: 320/393/480px voor menu en lokale tools; 320/393px voor veertien samengestelde WebView-layouts. Contactvalidatie, conceptbehoud, ontbrekende native bevestiging, hergebruik van verzoeknummer, providerfouten, naamfiltering, volledige online quizronde, ranglijsten en foutieve scoredata getest.
- Android: **API 36 / Android 16-emulator**, 1080×2340 met dichtheid 440. Werkelijke APK-installatie, starten, alle twaalf menuroutes, terugnavigatie, opgeslagen meldingsvoorkeuren, favorieten na offline procesherstart en offline quiz met vier antwoorden en feedback geslaagd. Geen waargenomen appcrash tijdens deze test.
- Meting op die emulator: één koude start **2.842 ms**; geheugenopname circa **102,7 MiB PSS**. Dit is geen vergelijking met fase 40 en geen fysieke S23- of batterijbenchmark. Geen fysieke Android-praktijktest uitgevoerd.
- Handmatig: visuele steekproef van de daadwerkelijke fase 41-emulatorschermafbeeldingen; logo, nieuws, home, quiz en Meer blijven consistent. Grote lettergroottes, alle geneste routes en twee-keer-terug-afsluitgedrag zijn niet volledig handmatig gevalideerd.
- APK: **Veldio-41-install.apk**, 18.393.805 bytes, versie 4.49-audit41 (81), targetSdk 36, afzonderlijk pakket nl.voetbalhub.app1.test41audit. APK Signature Scheme v2 geldig, certificaat CN=Android Debug; secret-scan geslaagd. Het gedownloade artifact bevat de gevraagde APK en de SHA-256 is onafhankelijk vergeleken.
- SHA-256: `b039ea8a02ba409be51400a2741751b8f7a3419d044c2a222dfef4c55bdd91ff`.
- [APK-artifact](https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41670194925/artifacts/13247848061) · [Android-testbewijzen en schermbeelden](https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41670194925/artifacts/13249510276) · [Ondertekening en manifest](https://github.com/sanderbrink-spec/Voetbalhub/actions/runs/41670194925/artifacts/13249300943).


## Productiebevindingen
Render is daadwerkelijk gecontroleerd via services, deploymentstatus, logs en openbare endpoints:
- /health en /ready: HTTP 200; Redis verbonden. Live revisie: 5a24f59819907593ba5bb08a840a6fe3c269e12b.
- /articles: tien gepubliceerde artikelen, geen dubbele IDs. Nieuwste publicatie: 2 november 2026, 19:46:31 UTC. Dat bewijst geen productie van vijftien kwaliteitsartikelen per dag.
- Contactconfiguratie meldt ontbrekende RESEND_API_KEY en CONTACT_FROM. Echte mailbezorging kan daardoor niet worden aangetoond. Testverzending gebruikt een nagebootste provider; er is geen echte testmail bezorgd.
- /integrations/statistics en /integrations/videos: HTTP 404. Wedstrijden, standen, voorspellen en videoafspelen zijn daardoor niet volledig operationeel. De huidige schermen tonen een expliciete beschikbaarheidsmelding; voorbeeldgegevens zijn niet toegevoegd.
- De onderzochte productie-uitvoering 41609146053 van de automatische publicatieworkflow publiceerde nul artikelen en stopte met provider_daily_limit: negen onderwerpen overgeslagen en acht bronfouten. De broncontrole wees ook onvolledig onderbouwde voorstellen af. De voorbereide fase 41-configuratie bevat daarnaast gesloten rechtenpoorten; dat is een afzonderlijke bevinding en niet de oorzaak van deze productierun. Vijftien originele artikelen per dag zijn niet aangetoond. Er zijn geen betaalde quota verhoogd of publicatiepoorten omzeild.
- Steekproef van primaire bronnen: FC Groningen bevestigt het beweegplein vanaf 14.45 uur en de aftrap om 16.45 uur; Heerenveen en NEC bevestigen 1-0 en Dylan Vente als doelpuntenmaker. De Heerenveenbron ondersteunt de combinatie Kersten–Smans–Vente. Dit is geen hercontrole van alle historische artikelen of alle 655 quizvragen.
- Render gaf geen bruikbare HTTP-latentiereeks terug; een eerdere geheugencall gaf HTTP 400. Geen productie-p95, batterijbenchmark of prestatietest op een fysieke S23 geclaimd.

De advertentiecontroller van deze technische test vraagt geen advertenties of advertentie-ID op. Daarmee zijn er nul feed-/artikeladvertenties, geen interstitials en geen nieuwe betaalde diensten. Verdienmodel en echte advertentiebezorging zijn nog niet getest.

## Kwaliteitscijfers
Dit zijn conservatieve beoordelingen van de onderzochte testversie en huidige productie, geen certificering. Ongeteste onderdelen begrenzen het cijfer.

| Onderdeel | Cijfer | Onderbouwing en grens |
|---|---:|---|
| Visuele uitstraling | 8 | Premium huisstijl en schermbeelden consistent; meerdere onderdelen tonen nog beschikbaarheidsmeldingen. |
| Gebruiksvriendelijkheid | 6 | Conceptbehoud, retries en offline oefenen verbeterd; kerngegevens en mail ontbreken. |
| Navigatie | 8 | Twaalf routes en terugnavigatie gecontroleerd; niet iedere mogelijke geneste route handmatig doorlopen. |
| Nieuws en redactie | 3 | Bestaande feed werkt; dagelijkse productie en autonome keten niet operationeel aangetoond. |
| Clubquiz | 8 | Serverpunten, tijd, replaybescherming, naamfiltering en gelijktijdigheid getest; geen onafhankelijke hercontrole van ieder feit. |
| Technische stabiliteit | 8 | Regressies en emulatorcontroles; geen langdurige fysieke duurtest. |
| Prestaties | 6 | Bounded requests/cache en emulatormeting; geen representatieve hardware- of batterijbenchmark. |
| Contentkwaliteit | 6 | Bronverwijzingen en steekproef kloppen; actualiteit en volledige feitencontrole niet dekkend aangetoond. |
| Veiligheid en privacy | 6 | Afgeschermde quizbrug, naammoderatie, secret-scan en gates getest; geen volledige penetratietest of privacyvrijgave. |
| Commerciële gereedheid | 3 | Ontbrekende contentketen, gegevens, mailbezorging en advertentietest blokkeren lancering. |

Totaal: **6,2/10**, het ongewogen gemiddelde van bovenstaande tien cijfers. Doel 9/10 niet bereikt.

## Nog noodzakelijk
Werkende mailconfiguratie en een echte bezorgtest; gecontroleerde productie-inrichting voor wedstrijddata en video's; een aantoonbaar vrijgegeven eigen redactiemethode met geslaagde publicatieruns; fysieke Android 16-duurtest inclusief batterij/meting; advertentie- en privacyafronding. Dit zijn concrete openstaande onderdelen, geen afgeronde functionaliteiten.

## Bronnen van de inhoudssteekproef
- https://www.fcgroningen.nl/nieuws/beweegplein-speciale-aanvoerdersband-en-lancering-maatschappelijke-bal-zondag-rond-duel-met-sparta/
- https://www.sc-heerenveen.nl/nieuws/sc-heerenveen-verslaat-nec-nipt-en-houdt-voor-vijfde-keer-de-nul
- https://www.nec-nijmegen.nl/nieuws/nieuws/n.e.c.-onderuit-bij-sc-heerenveen.htm
