"""
Builds src/data/airportDb.json from the airportsdata CSV (MIT licence, https://github.com/mborsetti/airportsdata).

Usage:
  curl -L -o /tmp/airports.csv https://raw.githubusercontent.com/mborsetti/airportsdata/main/airportsdata/airports.csv
  python3 scripts/build-airport-db.py /tmp/airports.csv

The app never downloads this at run time; the generated JSON is part of the app and works offline.
"""
import csv, json, sys, zoneinfo

src = sys.argv[1]
valid_zones = zoneinfo.available_timezones()
records, skipped, duplicates = {}, 0, 0
for r in csv.DictReader(open(src, encoding='utf-8')):
    code = (r.get('iata') or '').strip().upper()
    tz = (r.get('tz') or '').strip()
    if len(code) != 3 or not code.isalpha():
        continue
    if tz not in valid_zones:
        skipped += 1
        continue
    if code in records:
        duplicates += 1
        continue
    # [IANA time zone, city (or airport name when no city is listed), country code]
    records[code] = [tz, (r.get('city') or r.get('name') or '').strip(), (r.get('country') or '').strip()]

out = {'source': 'airportsdata (MIT licence) https://github.com/mborsetti/airportsdata', 'airports': dict(sorted(records.items()))}
with open('src/data/airportDb.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(f'{len(records)} airports written; {skipped} skipped (no valid time zone); {duplicates} duplicate codes ignored')
