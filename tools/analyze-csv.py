"""Summary of a tools/udp-listen.ps1 recording: min/max/mean/number of distinct values per field.
Helps map the telemetry indices of a new game.

Usage: python tools/analyze-csv.py recording.csv
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
            continue  # the last row may be cut off if recording was still running
        try:
            rows.append([float(x) for x in row])
        except ValueError:
            pass

print(f"{len(rows)} packets, {int(rows[0][1])} B per packet")
print(f"{'field':>5} {'min':>12} {'max':>12} {'mean':>12} {'distinct':>8}")
for c in range(2, len(head)):
    col = [r[c] for r in rows]
    finite = [v for v in col if v == v and abs(v) != float("inf")]
    if not finite:
        print(f"{head[c]:>5} {'–':>12}")
        continue
    print(f"{head[c]:>5} {min(finite):12.3f} {max(finite):12.3f} {statistics.fmean(finite):12.3f} {len(set(col)):8d}")
