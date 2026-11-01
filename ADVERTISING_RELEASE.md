# Advertentie- en Android-releaseprocedure

De testbuild bevat GMA 25.5.0 en UMP 4.0.0. `AdSettings.java` bevat uitsluitend officiële testidentificaties en standaard geen doelgroep-/productiegoedkeuring. Twee native posities worden door `patch-ads27.py` toegevoegd nadat alle bestaande patches zijn toegepast. De slideshowassets worden niet aangepast.

Gebruik JDK 17, Gradle 8.13, AGP 8.13.2, SDK 36 en Build Tools 36.0.0. Volg de exacte stappen van `.github/workflows/build.yml`. De debugbuild mag nooit echte advertenties aanvragen. Voor daadwerkelijke UMP-/testadvertentiecontrole zijn een geschikte eigen accountconfiguratie, doelgroepbevestiging en privacybericht nodig; test-ID's zijn geen bewijs van een werkend CMP-account.

Laat vóór productie eigen app-ID en twee afzonderlijke bannerunits, CMP/UMP, doelgroep, tijdelijke leeftijdsbevestiging, weigeren/intrekken, netwerkverkeer en Data Safety controleren. `scripts/release-preflight.py` weigert de huidige testconfiguratie. Verander geen vlaggen uitsluitend om de controle groen te maken. De app blijft gratis en zonder advertenties leesbaar bij ontbrekende toestemming of configuratie.

Productiesigning gebruikt uitsluitend de bestaande keystore en veilige `RELEASE_KEYSTORE_BASE64`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD` en `RELEASE_CERT_SHA256`. De fingerprint moet uit de bevestigde upload-identiteit komen. De workflow controleert die identiteit en weigert een debugcertificaat. De echte Play-versionCode en App Signing-status moeten nog worden vastgesteld. Er is geen productie-AAB vrijgegeven en geen nieuwe productiesleutel aangemaakt.
