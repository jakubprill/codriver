# codriver

Dashboard z gry wyścigowej na telefonie, tablecie albo drugim monitorze.
Prędkość, obroty, bieg i lampki zmiany biegu – w przeglądarce, bez instalowania aplikacji.

![Ekran wyboru wyświetlacza](docs/screens/wybor.png)

Sześć wyglądów do wyboru; każde urządzenie zapamiętuje swój.

| ![Odcinek](docs/screens/odcinek.png) | ![Papier](docs/screens/papier.png) | ![LCD](docs/screens/lcd.png) |
|---|---|---|
| Odcinek | Papier | LCD |

Działa z **DiRT 3**. **DiRT Rally** ma ten sam format telemetrii – wsparcie czeka na test w praktyce.

## Uruchomienie

1. **Włącz telemetrię w grze.** W `Dokumenty\My Games\DiRT3\hardwaresettings\hardware_settings_config.xml` ustaw:
   ```xml
   <motion enabled="true" ip="127.0.0.1" port="20777" delay="1" extradata="3" />
   ```
2. **Uruchom codriver** na tym samym komputerze:
   pobierz `codriver.exe` z [Releases](https://github.com/jakubprill/codriver/releases),
   albo z kodu: `bun src/main.js` (lub `node src/main.js`, Node 18+).
3. **Podłącz telefon:** zeskanuj kod QR z okna codriver (albo ze strony, która otworzy się na komputerze)
   lub wpisz **`http://codriver.local`**. Telefon musi być w tej samej sieci Wi-Fi;
   przy pytaniu zapory zezwól dla sieci prywatnej. Dane pojawiają się po starcie odcinka.

   `codriver.local` działa na iPhonie, iPadzie i komputerach; na części Androidów trzeba użyć adresu IP z kodu QR.

> **DiRT 3 Complete Edition** z włączoną telemetrią potrafi pokazać błąd „sendto failed 10038” na mecie – to znany błąd gry.
> codriver ma przełącznik, który wyłącza telemetrię, gdy grasz bez dashboardu; jest też poprawka społeczności.
> Szczegóły: [docs/telemetry/codemasters.md](docs/telemetry/codemasters.md).

Bez gry: `bun run replay` odtwarza nagranie z jazdy, a `http://localhost:8080/?demo` pokazuje dane przykładowe.

## Dla programistów

Bez zależności – wystarczy [Bun](https://bun.sh) albo Node 18+.
`bun test` uruchamia testy, `bun run build:windows` buduje `codriver.exe`.
Jak dodać grę albo wygląd: [docs/architecture.md](docs/architecture.md).

## Licencja

[Unlicense](LICENSE) – domena publiczna. Kopiuj, zmieniaj, używaj do czego chcesz.
