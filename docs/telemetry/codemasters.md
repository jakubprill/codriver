# Telemetria Codemasters (DiRT 3, DiRT Rally)

Gry Codemasters wysyłają pakiet UDP z tablicą `float32` little-endian.

## Włączenie

`Dokumenty\My Games\<gra>\hardwaresettings\hardware_settings_config.xml` (z OneDrive: `OneDrive\Dokumenty\…`):

```xml
<motion enabled="true" ip="127.0.0.1" port="20777" delay="1" extradata="3" />
```

- Domyślnie gra ma `ip="dbox"` (sprzęt D-Box) i `extradata="0"` – trzeba to zmienić.
- Plik bywa oznaczony „tylko do odczytu”, żeby gra go nie nadpisała: zdejmij atrybut, zmień, możesz założyć ponownie.
- Gra wysyła dane tylko w trakcie jazdy, nie w menu.

## DiRT 3 – zweryfikowane 13.11.2026

Pakiet: **152 B = 38 pól**, ok. 170 pakietów/s. `extradata=3` nie dokłada pól (max obrotów brak).
Nagranie: `test/fixtures/dirt3-2026-11-13.csv` (co 12. pakiet z 30 s jazdy, automatyczna skrzynia, biegi 1–4).

| Indeks | Pole | Jednostka / uwagi |
|---|---|---|
| 0 | czas gry | s |
| 1 | czas okrążenia/odcinka | s |
| 2 | dystans okrążenia | m |
| 3 | dystans całkowity | |
| 4–6 | pozycja x, y, z | m |
| **7** | **prędkość** | m/s (×3,6 = km/h) |
| 8–10 | prędkość x, y, z | m/s |
| 11–16 | wektory obrotu i pochylenia | |
| 17–20 | położenie zawieszenia | |
| 21–24 | prędkość zawieszenia | |
| 25–28 | prędkość kół | m/s |
| **29** | **gaz** | 0..1 |
| 30 | skręt | −1..1 |
| **31** | **hamulec** | 0..1 |
| 32 | sprzęgło | 0..1 |
| **33** | **bieg** | 1..n; luz i wsteczny jeszcze niezweryfikowane |
| 34 | przeciążenie poprzeczne | g; na starcie bywa −inf |
| 35 | przeciążenie wzdłużne | g; na starcie bywa −inf |
| 36 | okrążenie | |
| **37** | **obroty silnika** | **rad/s** (×60/2π = obr/min); 125,66 = 1200 obr/min na biegu jałowym |

Sprawdzenie: zmiany biegów automatu przy ~6400 obr/min, odcięcie 6583 obr/min,
stosunek obrotów do prędkości maleje z każdym biegiem (70 → 26 → 18 → 13 rad/s na m/s).

## DiRT Rally – do sprawdzenia w praktyce

Ten sam układ pierwszych 38 pól; z `extradata=3` pakiet ma **264 B = 66 pól**. Różnice wg opisów społeczności:

| Indeks | Pole | Uwagi |
|---|---|---|
| 37 | obroty silnika | **obr/min ÷ 10** (inaczej niż DiRT 3) |
| 63 | maksymalne obroty | obr/min ÷ 10 |
| 64 | obroty biegu jałowego | obr/min ÷ 10 |
| 65 | liczba biegów | |
| 33 | bieg | wsteczny = 10 |

Parser rozpoznaje DiRT Rally po długości pakietu (≥ 64 pola). Do zrobienia: nagranie z jazdy
(`tools/udp-listen.ps1`) i test na nim, tak jak dla DiRT 3.
