# Fejlrapport: Carlsberg "ikke bekræftet" (2. november 2026)

**Status:** Rettet i version 0.5.1. Årsagen er sandsynlig, men ikke bevist.

## Symptom
I version 0.5.0 viste "Fyld kurv" "ikke bekræftet" ved alle 7 varer hos Carlsberg. Bestillingen blev derfor lavet manuelt.

## Det, vi fandt
- Da favoritlisten blev åbnet kort efter, sendte Carlsberg siden til `/SoldToSelection` ("Vælg kundenummer"), og kurven var tom.
- Efter valg af kundenummer virkede den samme metode: kurven i toppen opdaterede efter 2-4 sekunder, også ved smalle vinduer.

## Sandsynlig årsag
Sessionen hos Carlsberg var udløbet, mens favoritlisten stod åben under optællingen. Siden ser normal ud, men klikkene når ikke frem, så kurven i toppen ændrer sig aldrig. Det er den eneste bekræftelse, knappen har hos Carlsberg.

Selve udløbet er ikke genskabt. Det er kun bekræftet, at siden sender til `/Login`, når der ikke er nogen session.

## Udelukket
- **Ny vare på favoritlisten (varenr. 37268):** Varer findes på varenummer, og alle 7 pegede på den rigtige række.
- **Vinduesbredden:** Kurvbeløbet findes og opdateres, også ved smalle vinduer.

## Rettelsen i 0.5.1
- Før start tjekker knappen sessionen ved at hente siden igen. Ender svaret på `/Login` eller `/SoldToSelection`, beder knappen om genindlæsning.
- Hver vare får ét klik hos Carlsberg og op til 15 sekunders ventetid. Tidligere gav et langsomt svar et ekstra klik, som kunne give dobbelt antal.
- Bliver en vare ikke bekræftet, tjekkes sessionen igen. Er den død, stopper knappen og sender ikke resten.

## Test
| Test | Resultat |
|---|---|
| 7 varer, logget ind, med 0.5.1 | Alle fik ✓, og hver linje i kurven havde det rigtige antal. Kurven blev tømt bagefter |
| Logget ud, mens siden står åben | **Ikke testet** |

## Mangler
Log ud i en anden fane, og tryk "Fyld kurv" i den gamle. Det skal vise "Du er logget ud hos Carlsberg" og ikke lægge noget i kurven. Vises "ikke bekræftet" igen med en levende session, er årsagen en anden.

## Læring
- Hos Carlsberg betyder "ikke bekræftet" ikke nødvendigvis, at varen mangler. Tjek altid kurven.
- Klik aldrig automatisk igen på en vare, medmindre shoppen bekræfter den enkelte vare. Philipson gør det via sin popup, Carlsberg gør det ikke.
