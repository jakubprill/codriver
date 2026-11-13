# codriver – wskazówki dla agentów

- Język: dokumentacja, komentarze, komunikaty i interfejs po polsku. Nazwy w kodzie po angielsku.
- Zero zależności npm. Tylko moduły `node:*`; kod musi działać na Bun i Node 18+ (`node --test` i `bun test` przechodzą).
- Architektura i jak dodać grę lub wygląd: `docs/architecture.md`. Mapa pól telemetrii: `docs/telemetry/`.
- Serwer nie pisze do konsoli w pętli (status idzie do `process.title`) – klik w konsolę Windows zamraża proces.
- Motywy rysują na planszy 1600×800; strefy obrotów tylko z `ZONES`/`rpmInfo()` w `public/lib/util.js`.
- Każdy nowy wygląd: wpis w `public/themes/index.js` i zrzut `docs/screens/<id>.png` (`?demo&theme=<id>`).
- Nowe pole telemetrii: najpierw nagranie i test w `test/` na danych z gry, potem kod.
- Przed commitem: `bun test` (albo `node --test`) i `bun scripts/build.js`.
