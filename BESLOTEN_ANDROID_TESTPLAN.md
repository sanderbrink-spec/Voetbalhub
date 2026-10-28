# VoetbalHub — besloten Android-test (100 testers)

Status: **voorbereiding, nog niet vrijgegeven**. Dit document is een releasepoort; het publiceren van een APK of uitnodigen van testers vereist een geslaagde controle.

## 1. Technische releasepoort
- [ ] GitHub Actions `Node.js tests` is groen op de exacte releasecommit.
- [ ] GitHub Actions `VoetbalHub API test and APK build` is groen op dezelfde commit; download de APK uit het build-artifact.
- [ ] Installeer de APK op minimaal twee Android-toestellen en test een schone installatie én upgrade.
- [ ] Test op beide toestellen: starten, navigatie, scrollen, terugknop, netwerkverlies/herstel, tekstbreedte en crashvrij gebruik.
- [ ] Controleer dat de APK met de juiste productie-API communiceert en alleen handmatig goedgekeurde artikelen toont.
- [ ] Controleer dat de backend `/articles` geen concepten, privésleutels of niet-goedgekeurde inhoud teruggeeft.
- [ ] Controleer dat uitslagen, externe RSS-teksten, beelden en clublogo's niet zonder geldige rechten in de testversie worden aangeboden.
- [ ] Controleer dat betaalde AI-beeldgeneratie niet automatisch wordt aangeroepen.
- [ ] Verifieer de signing, package-ID, versionCode en upgradepad. De bestaande build-workflow wijzigt de applicationId naar `nl.voetbalhub.app1` en de appnaam naar `VoetbalHub 1`; bevestig of dat de gewenste testidentiteit is.

## 2. Privacy, advertenties en distributie
- [ ] Publiceer een bereikbare privacyverklaring en contactadres vóór uitnodigingen.
- [ ] Leg vast welke analytics/crashrapportage en advertentie-SDK's werkelijk in de APK aanwezig zijn.
- [ ] Schakel bij de eerste technische test liever advertenties uit of gebruik officiële testadvertenties; geen eigen klikken op echte advertenties.
- [ ] Als advertenties/analytics aan staan: toets toestemming in EER, Play Data safety en toepasselijke SDK-/AdMob-regels.
- [ ] Kies distributie: Google Play interne/gesloten test met juiste testers en vereisten, of tijdelijk directe APK-distributie met duidelijke installatie-instructies.
- [ ] Deel geen redactiegeheimen, API-sleutels of beheerlinks met testers.

## 3. Gefaseerde uitrol naar 100 testers
1. **5 technische testers**: 48 uur; blokkades oplossen.
2. **20 betrokken voetbalfans**: 5–7 dagen; leesbaarheid, inhoud en terugkeer testen.
3. **100 testers totaal**: uitnodigen zodra fase 2 stabiel is; wekelijkse feedbackronde.

## 4. Meetplan (zonder persoonsgegevens onnodig te verzamelen)
- Installaties en succesvolle eerste start.
- Crashvrije sessies en opstartproblemen.
- Dagelijks actieve gebruikers (DAU), 7-daagse terugkeer en artikelopeningen per actieve gebruiker.
- Feedback op nieuwsbetrouwbaarheid, snelheid, pushmeldingen en advertentie-ervaring.
- Maak vóór livegang een nulmeting; verzin geen meetwaarden.

## 5. Go/no-go
**GO** uitsluitend als: build en tests groen zijn; geen kritieke crashes; handmatige publicatie werkt; geen ongeautoriseerde content; privacy en distributie gereed; testerfeedbackkanaal beschikbaar.

**NO-GO** bij: falende build, onbedoelde automatische publicatie, lek van secrets, auteursrechtelijk risicovolle inhoud, crash bij opstarten of onduidelijkheid over de APK-versie.

## 6. Bekende aandachtspunten uit repositorycontrole op 27 oktober 2026
- De repository bevat een Android-project als `VoetbalHub-4.22-API-Football.zip`, dat door de build-workflow wordt uitgepakt; de Android-broncode staat dus niet als normale `app/`-map in de root.
- De build-workflow bevat omvangrijke automatische wijzigingen aan Android-broncode tijdens het bouwen. Daarom is een groene build alleen niet voldoende als functionele acceptatie.
- De Render-backend had recent een `live` deployment, maar dit bevestigt niet de end-to-end Android-werking.
- Publicatie blijft handmatig; betaalde AI-beeldgeneratie is geen voorwaarde voor de test.

## 7. Wekelijkse Eredivisie-column — redactionele pilot
- [ ] Pilot van vier speelronden: iedere maandag na afloop van de volledige speelronde een column, uitsluitend als er een duidelijke invalshoek is.
- [ ] Werktitel: **De Derde Helft**; definitieve rubrieksnaam door de eigenaar goed te keuren.
- [ ] **Auteur: Sander Brink, met eigen naamsvermelding.** Sander schrijft de column volledig zelf, inclusief stelling, observaties, mening en formulering. AI doet alleen op verzoek een lichte nacontrole op spelling, grammatica, leesbaarheid en verifieerbare feiten; geen ongevraagde herschrijving of verandering van toon, argumenten of standpunten.
- [ ] Richtlengte 600–800 woorden; liever korter en scherp dan opgevuld. Geen verplicht wedstrijd-voor-wedstrijd overzicht.
- [ ] Opbouw: centrale stelling, opvallende winnaar/verliezer, een tactisch of individueel inzicht, aandacht voor minder belichte clubs, afsluitende scherpe conclusie.
- [ ] Controleer uitslagen, standen, spelersnamen, quotes en wedstrijdfeiten onafhankelijk (Flashscore als wedstrijdreferentie); scheid feit en mening duidelijk.
- [ ] Alleen eigen formuleringen en rechtenvrij of gelicentieerd beeld; geen overgenomen columns of uitgeversteksten.
- [ ] Elke column blijft concept totdat Sander de lichte nacontrole heeft bekeken en zelf expliciet goedkeurt; geen automatische publicatie.
- [ ] Meet na vier edities: kwaliteit (doel >= 8/10 bij menselijke review), lezersreacties, leestijd/uitgelezen percentage indien privacyvriendelijk meetbaar, en tijdsinvestering per editie.
- [ ] Stop of wijzig de rubriek als de columns generiek worden, te veel tijd kosten of de gewone nieuwsredactie vertragen.
