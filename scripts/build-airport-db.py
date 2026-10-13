"""
Builds src/data/airportDb.json, the app's offline airport reference list.

Sources:
  1. airportsdata (MIT licence) https://github.com/mborsetti/airportsdata  - primary: IATA code, city, country, IANA time zone
  2. OurAirports (public domain) https://ourairports.com/data/            - fills gaps: airports with scheduled airline
     service that airportsdata lacks. These are added ONLY when their country uses a single time zone (worked out from
     every airport airportsdata lists for that country), so the zone is certain rather than guessed. Airports in
     countries with several time zones are left out and stay "unrecognised" in the app.

Usage:
  curl -L -o /tmp/airports.csv https://raw.githubusercontent.com/mborsetti/airportsdata/main/airportsdata/airports.csv
  curl -L -o /tmp/ourairports.csv https://davidmegginson.github.io/ourairports-data/airports.csv
  python3 scripts/build-airport-db.py /tmp/airports.csv /tmp/ourairports.csv

The app never downloads this at run time; the generated JSON is part of the app and works offline.
"""
import collections, csv, json, sys, zoneinfo

airportsdata_csv = sys.argv[1]
ourairports_csv = sys.argv[2] if len(sys.argv) > 2 else None
valid_zones = zoneinfo.available_timezones()

records, skipped, duplicates = {}, 0, 0
country_zones = collections.defaultdict(set)
for r in csv.DictReader(open(airportsdata_csv, encoding='utf-8')):
    tz = (r.get('tz') or '').strip()
    if tz in valid_zones and r.get('country'):
        country_zones[r['country'].strip()].add(tz)
    code = (r.get('iata') or '').strip().upper()
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

supplemented, left_out = [], 0
if ourairports_csv:
    for r in csv.DictReader(open(ourairports_csv, encoding='utf-8')):
        code = (r.get('iata_code') or '').strip().upper()
        if r.get('scheduled_service') != 'yes' or len(code) != 3 or not code.isalpha() or code in records:
            continue
        zones = country_zones.get((r.get('iso_country') or '').strip(), set())
        if len(zones) != 1:
            left_out += 1
            continue
        records[code] = [next(iter(zones)), (r.get('municipality') or r.get('name') or '').strip(), r['iso_country'].strip()]
        supplemented.append(code)

out = {
    'source': 'airportsdata (MIT licence) https://github.com/mborsetti/airportsdata; '
    'gaps filled from OurAirports (public domain) https://ourairports.com/data/ for single-time-zone countries',
    'supplementedFromOurAirports': sorted(supplemented),
    'airports': dict(sorted(records.items())),
}
with open('src/data/airportDb.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(f'{len(records)} airports written; {len(supplemented)} added from OurAirports; '
      f'{left_out} OurAirports airports left out (country has several time zones); '
      f'{skipped} skipped (no valid time zone); {duplicates} duplicate codes ignored')
