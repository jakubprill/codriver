"""Podsumowanie nagrania z tools/udp-listen.ps1: min/max/średnia/liczba różnych wartości każdego pola.
Pomaga zmapować indeksy telemetrii nowej gry.

Użycie: python tools/analyze-csv.py nagranie.csv
"""
import csv
import statistics
import sys

with open(sys.argv[1], encoding="utf-8-sig") as fh:
    reader = csv.reader(fh, delimiter=";")
    head = next(reader)
    rows = []
    for row in reader:
        if len(row) != len(head):
            continue  # ostatni wiersz bywa ucięty, jeśli nagrywanie trwało
        try:
            rows.append([float(x) for x in row])
        except ValueError:
            pass

print(f"{len(rows)} pakietów, {int(rows[0][1])} B na pakiet")
print(f"{'pole':>5} {'min':>12} {'max':>12} {'średnia':>12} {'różnych':>8}")
for c in range(2, len(head)):
    col = [r[c] for r in rows]
    finite = [v for v in col if v == v and abs(v) != float("inf")]
    if not finite:
        print(f"{head[c]:>5} {'–':>12}")
        continue
    print(f"{head[c]:>5} {min(finite):12.3f} {max(finite):12.3f} {statistics.fmean(finite):12.3f} {len(set(col)):8d}")
