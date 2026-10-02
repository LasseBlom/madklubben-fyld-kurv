# Sikkerhed – Fyld kurv

Dette repo er **offentligt**, så Tampermonkey kan hente opdateringer. Derfor gælder:

## Må aldrig ligge i repoet
- Adressen på telefonsiden (webapp-adressen, `…/exec`) – den giver adgang til at ændre optællingen.
- Adgangskoder, login-links, tokens eller kundenumre fra webshoppene.
- Navne, mailadresser eller telefonnumre på personale.
- Priser, rabataftaler eller fakturaer.
- Drikkekort som PDF (de ligger kun lokalt).

`.gitignore` holder `*adresse*.txt` og PDF'er ude. Tjek altid `git status`, før der pushes.

## Hvad systemet gemmer
| Hvor | Hvad | Følsomt? |
|---|---|---|
| Google Sheet (ejers konto, ikke delt) | Varenavn, leverandør, varenummer, antal, tidspunkt | Nej |
| Tampermonkey (på computeren) | Webapp-adressen | Lidt – del den kun med personalet |
| GitHub (offentligt) | Kode, vejledning, varelister | Nej |

Der gemmes **ingen** persondata, ingen logins og ingen priser nogen steder.

## Hvad koden må og ikke må
- **Google-scriptet** har kun adgang til sit eget regneark (`@OnlyCurrentDoc`) – ikke resten af ejerens Google Drev. Antal er begrænset til 0–99 pr. vare, og ukendte vare-id'er afvises.
- **Fyld kurv-knappen** kører kun på leverandørernes favoritlister. Den læser varenumre og knapper på siden, henter optællingen fra webappen og udfylder antal. Den sender **aldrig** noget fra webshoppen videre, rører aldrig kassen og bestiller aldrig. Data fra kælderlisten tjekkes (varenumre skal være tal, antal 1–99), og antal over 30 vises som advarsel, før noget lægges i kurven.
- Personalet tjekker altid kurven og trykker selv "bestil".

## Kendte risici og hvad vi gør
| Risiko | Afhjælpning |
|---|---|
| Nogen får fat i webapp-adressen og ændrer optællingen | Lang, ugættelig adresse; loft på 99; advarsel ved store antal; mennesket tjekker kurven. Ved mistanke: lav en ny implementering (ny adresse). |
| Nogen overtager GitHub-kontoen og ændrer knappen | **Totrinsbekræftelse (2FA) på GitHub-kontoen er et krav.** Kun ejeren har skriveadgang. Knappen kan kun kontakte `script.google.com`. |
| Følsomme data pushes ved en fejl | `.gitignore`, denne tjekliste, og GitHubs indstilling "Block command line pushes that expose my email". |
