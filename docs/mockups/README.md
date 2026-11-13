# Makiety

Pierwsze propozycje wyglądu (13.11.2026), zrobione na płótnie projektowym w Claude:
https://claude.ai/artifact/Pz8XmYx3AyuoECnrD39tKu

| Plik | Wariant | W aplikacji |
|---|---|---|
| `Main.dc.html` | A – Odcinek, rajdowy cyfrowy (wybrany jako główny) | `public/themes/odcinek.js` |
| `Zegary.dc.html` | B – Zegary, analogowe tarcze | `public/themes/zegary.js` |
| `Kierownica.dc.html` | C – Kokpit, wyświetlacz z kierownicy | `public/themes/kokpit.js` |
| `Neon.dc.html` | D – Neon, tylko najważniejsze | `public/themes/neon.js` |

Warianty E (Papier) i F (LCD) powstały od razu w kodzie – ich wygląd jest w `docs/screens/`.

Pliki `.dc.html` to źródła artboardów płótna (format Design Component); otwierają się poprawnie na płótnie,
nie samodzielnie w przeglądarce. Aktualny wygląd każdego wariantu: `docs/screens/*.png`.
