# Fyld kurv – prøveversion

En gratis udgave af bestillingssystemet, der kan bruges af andre restauranter (fx LUPO) uden betalt Claude og uden din computer.

**Påvirker ikke MKA's system.** Kælderlisten på claude.ai, `/bestilling`, `/kaelder` og varefilen er urørte. Alt herinde er separat.

## Sådan virker det

1. **I kælderen:** personalet tæller på en telefonside (Google Apps Script). Antallet gemmes i et Google Sheet.
2. **Ved computeren:** de åbner leverandørens favoritliste i Chrome og trykker på den røde knap **Fyld kurv** nederst til højre. Varerne lægges i kurven.
3. **De tjekker kurven og bestiller selv.** Knappen bestiller aldrig.

Knappen virker hos **Carlsberg**, **Philipson** og **Sigurd Müller** – på hver shops favoritliste:

| Shop | Side med knappen | Sådan genkendes varen |
|---|---|---|
| Carlsberg | Favoritter → jeres liste | Varenummer |
| Sigurd Müller | Kundecenter → Favoritlister → jeres liste (ikke "Vinkort") | Varenummer – alle vine lægges i kurven med ét klik |
| Philipson | Mine favoritter → jeres liste | Varens navn på listen (årgang ignoreres) |

Varer, der ikke står på favoritlisten, lægger knappen ikke i kurven – den siger hvilke, så man kan tage dem selv.

| Fil | Hvad |
|---|---|
| `google/Kode.gs` | Gemmer og henter optællingen (Google Apps Script) |
| `google/Telefon.html` | Telefonsiden, man tæller på |
| `tampermonkey/fyld-kurv.user.js` | "Fyld kurv"-knappen i Chrome |

## Opsætning – del 1: telefonsiden (ca. 10 min, gøres én gang)

1. Gå til [sheets.new](https://sheets.new) og opret et Google Sheet. Kald det fx **Kælderliste – prøve**.
2. I arket: **Udvidelser → Apps Script**.
3. Slet alt i `Code.gs` og indsæt indholdet af `google/Kode.gs`.
4. Klik **+** ved "Filer" → **HTML** → navngiv den præcis **Telefon** → indsæt indholdet af `google/Telefon.html`.
5. Vælg funktionen **opsaet** i menuen øverst og tryk **Kør**. Godkend adgangen til dit eget regneark, når Google spørger.
   Arket får nu fanen "Varer" med Carlsbergs 9 varer.
6. **Implementer → Ny implementering → (tandhjul) Webapp**
   - Udfør som: **Mig**
   - Hvem har adgang: **Alle**
   - Tryk **Implementer** og kopiér **webapp-adressen** (slutter på `/exec`).
7. Åbn adressen på telefonen og læg den på hjemmeskærmen.

> "Alle" betyder, at enhver med adressen kan se og ændre optællingen. Adressen er lang og umulig at gætte, og der står kun varenavne og antal – men del den kun med personalet.

## Opsætning – del 2: "Fyld kurv"-knappen (ca. 5 min pr. computer)

1. Installer **Tampermonkey** fra Chrome Web Store (gratis).
2. Gå til `chrome://extensions` → **Tampermonkey → Detaljer** → slå **Tillad brugerscripts** til.
   (Ses den ikke, så slå **Udviklertilstand** til øverst til højre på `chrome://extensions`.)
3. Åbn **[installationslinket](https://raw.githubusercontent.com/LasseBlom/madklubben-fyld-kurv/main/tampermonkey/fyld-kurv.user.js)** og tryk **Installér**.
   Scriptet opdaterer sig selv fra GitHub, når der kommer nye versioner.
4. Åbn Carlsbergs favoritliste. Den røde knap **Fyld kurv** dukker op nederst til højre.
5. Første gang beder knappen om webapp-adressen fra del 1. Indsæt den – den huskes.

> **Hurtigere opdateringer:** Tampermonkey tjekker som standard for nye versioner én gang i døgnet. Vil man have en rettelse med det samme: Tampermonkey-ikonet → **Søg efter brugerscriptopdateringer**.

## Prøvetur

1. Tæl et par Carlsberg-varer på telefonsiden.
2. Åbn Carlsbergs favoritliste på computeren og tryk **Fyld kurv** → **Læg i kurven**.
3. Tjek kurven. Var det kun en test, så tøm den.

Ligger der allerede varer i kurven, advarer knappen først – den fjerner aldrig noget.

## LUPO

`lupo/varer-lupo.csv` er LUPO's vareliste bygget ud fra `drikkerkort/lupo_drikkekort_spring-ny-1.pdf` – samme kolonner som arket "Varer". Brug den i LUPO's eget Google Sheet: **Filer → Importér → Upload → "Erstat det aktuelle ark"** på fanen "Varer" (kør først `opsaet`).
Varer med leverandør "Uden leverandør" vises på telefonsiden, men "Fyld kurv" rører dem ikke.

## Senere

- **Nye versioner:** ret scriptet, hæv `@version` i toppen af `fyld-kurv.user.js`, og push til GitHub. Tampermonkey henter kun en ny version, når versionsnummeret er højere.
- **Ny restaurant (fx LUPO):** eget Google Sheet + egen telefonside med deres varer; samme script.
- **Varer** rettes direkte i arket "Varer" (én række pr. vare). `varenr` er webshoppens varenummer – hos Philipson varens navn præcis som på favoritlisten.
