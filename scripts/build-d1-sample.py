"""Builds d1/historical-declarations/seed.sample.sql: a made-up Historical
Declarations dataset for local testing (`npm run dev:worker`).

Nothing in it comes from the real archive, and this script reads nothing from
it. The companies, beneficiaries, addresses, identifiers and descriptions are
invented; every company and beneficiary name ends in "(test data)", the
companies' web pages use the reserved .example domain, and every ID is new.
All beneficiaries are organisations, as in the archive.

The data has the archive's shape: the same tables and columns, the two kinds
of grant, amounts in local currencies, empty fields where the archive has
them, and declarations from 2022 to 2025. The 2022 declarations are there to
show that the retention rule (`oldestPublicYear()` in
historical-declarations-api.js) hides them.

The output is deterministic: running the script again writes the same file.

    python3 scripts/build-d1-sample.py
"""
import os
import random
import sqlite3
import uuid

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D1_DIR = os.path.join(REPO_ROOT, "d1", "historical-declarations")
SCHEMA_PATH = os.path.join(D1_DIR, "schema.sql")
OUT_PATH = os.path.join(D1_DIR, "seed.sample.sql")

TEST_SUFFIX = " (test data)"
DECLARATION_COUNT = 100
YEAR_WEIGHTS = {2022: 8, 2023: 26, 2024: 32, 2025: 34}

# The archive's two kinds of Educational Grant (Annex I of the Disclosure Guidelines).
NATURE_LABELS = {
    "support_event": "Support to Educational Events",
    "other_grant": "Other Educational Grants",
}

COUNTRIES = [
    ("AL", "Albania"), ("AT", "Austria"), ("BA", "Bosnia and Herzegovina"), ("BE", "Belgium"),
    ("BG", "Bulgaria"), ("CH", "Switzerland"), ("CY", "Cyprus"), ("CZ", "Czech Republic"),
    ("DE", "Germany"), ("DK", "Denmark"), ("EE", "Estonia"), ("ES", "Spain"), ("FI", "Finland"),
    ("FR", "France"), ("GB", "United Kingdom"), ("GR", "Greece"), ("HR", "Croatia"),
    ("HU", "Hungary"), ("IE", "Ireland"), ("IS", "Iceland"), ("IT", "Italy"),
    ("LI", "Liechtenstein"), ("LT", "Lithuania"), ("LU", "Luxembourg"), ("LV", "Latvia"),
    ("ME", "Montenegro"), ("MK", "North Macedonia"), ("MT", "Malta"), ("NL", "Netherlands"),
    ("NO", "Norway"), ("PL", "Poland"), ("PT", "Portugal"), ("RO", "Romania"), ("RS", "Serbia"),
    ("SE", "Sweden"), ("SI", "Slovenia"), ("SK", "Slovakia"), ("TR", "Türkiye"),
    ("UA", "Ukraine"), ("US", "United States"),
]

# Currency code, name, and roughly how many units make one euro (for realistic amounts).
CURRENCIES = [
    ("BGN", "Bulgarian Lev", 2), ("CHF", "Swiss Franc", 1), ("CZK", "Czech Koruna", 25),
    ("DKK", "Danish Krone", 7.5), ("EUR", "Euro", 1), ("GBP", "Pound Sterling", 0.85),
    ("HUF", "Hungarian Forint", 400), ("ISK", "Icelandic Krona", 150), ("NOK", "Norwegian Krone", 11.5),
    ("PLN", "Polish Zloty", 4.3), ("RON", "Romanian Leu", 5), ("RSD", "Serbian Dinar", 117),
    ("SEK", "Swedish Krona", 11), ("TRY", "Turkish Lira", 35), ("USD", "US Dollar", 1.1),
]

# Per beneficiary country: currency, cities with a postal code, a made-up street, and the
# language of the descriptions.
PLACES = {
    "AT": ("EUR", [("Wien", "1090"), ("Graz", "8010")], "Musterstraße {n}", "de"),
    "BE": ("EUR", [("Bruxelles", "1000"), ("Antwerpen", "2000"), ("Liège", "4000")], "Voorbeeldstraat {n}", "fr"),
    "CH": ("CHF", [("Zürich", "8001"), ("Genève", "1205")], "Musterweg {n}", "de"),
    "CZ": ("CZK", [("Praha", "120 00")], "Ukázková {n}", "en"),
    "DE": ("EUR", [("Berlin", "10115"), ("München", "80331"), ("Hamburg", "20095")], "Beispielstraße {n}", "de"),
    "DK": ("DKK", [("København", "2100")], "Eksempelvej {n}", "en"),
    "ES": ("EUR", [("Madrid", "28001"), ("Barcelona", "08001"), ("Valencia", "46001"), ("Sevilla", "41001")],
           "Calle de Ejemplo {n}", "es"),
    "FR": ("EUR", [("Paris", "75013"), ("Lyon", "69003")], "{n} rue de l’Exemple", "fr"),
    "GB": ("GBP", [("London", "E1"), ("Manchester", "M13")], "{n} Example Road", "en"),
    "GR": ("EUR", [("Athina", "115 27")], "Odos Paradeigmatos {n}", "en"),
    "HU": ("HUF", [("Budapest", "1083")], "Példa utca {n}", "en"),
    "IE": ("EUR", [("Dublin", "D04")], "{n} Sample Street", "en"),
    "IT": ("EUR", [("Milano", "20121"), ("Roma", "00161"), ("Torino", "10126")], "Via Esempio {n}", "it"),
    "NL": ("EUR", [("Amsterdam", "1011"), ("Utrecht", "3511")], "Voorbeeldlaan {n}", "en"),
    "NO": ("NOK", [("Oslo", "0372")], "Eksempelveien {n}", "en"),
    "PL": ("PLN", [("Warszawa", "02-097"), ("Kraków", "31-501")], "ul. Przykładowa {n}", "en"),
    "PT": ("EUR", [("Lisboa", "1649-035")], "Rua do Exemplo {n}", "en"),
    "RO": ("RON", [("București", "050098")], "Strada Exemplului {n}", "en"),
    "SE": ("SEK", [("Stockholm", "171 76")], "Exempelgatan {n}", "en"),
    "TR": ("TRY", [("İstanbul", "34093")], "Örnek Caddesi No: {n}", "en"),
}

# Beneficiaries: made-up hospitals, societies, foundations, universities and congress
# organisers, with a weight for how often they appear.
BENEFICIARIES = [
    ("ES", "Hospital Universitario de Ejemplo", 5), ("ES", "Hospital General de Villaficticia", 4),
    ("ES", "Sociedad de Ejemplo de Cirugía Vascular", 4), ("ES", "Fundación Ejemplo para la Investigación Clínica", 3),
    ("ES", "Ejemplo Congresos S.L.", 5), ("ES", "Clínica Muestra", 2),
    ("ES", "Asociación de Enfermería de Ejemplo", 2), ("ES", "Instituto de Salud Ficticio", 2),
    ("ES", "Colegio de Médicos de Villaficticia", 1), ("ES", "Universidad de Ejemplo, Facultad de Medicina", 2),
    ("DE", "Klinikum Beispielstadt", 3), ("DE", "Universitätsklinikum Musterhausen", 2),
    ("DE", "Gesellschaft für Beispielmedizin e.V.", 3), ("DE", "Beispiel Kongress GmbH", 2),
    ("DE", "Stiftung Musterforschung", 1),
    ("FR", "Centre Hospitalier de l’Exemple", 2), ("FR", "Société d’Exemple de Radiologie", 2),
    ("FR", "Fondation Exemple Santé", 1), ("FR", "Clinique du Modèle", 1),
    ("IT", "Ospedale Esempio", 2), ("IT", "Azienda Ospedaliera Modello", 2),
    ("IT", "Società di Esempio per l’Ortopedia", 2), ("IT", "Fondazione Esempio Ricerca", 1),
    ("BE", "Clinique Exemple", 1), ("BE", "Voorbeeld Ziekenhuis", 1),
    ("NL", "Ziekenhuis Voorbeeldstad", 1), ("NL", "Stichting Voorbeeld Zorg", 1),
    ("GB", "Exampleton General Hospital", 2), ("GB", "Sampleford University Hospitals", 1),
    ("GB", "Society for Example Surgery", 1),
    ("IE", "Northgate University Clinic", 1),
    ("PL", "Szpital Przykładowy", 2), ("PL", "Fundacja Przykładowa", 1),
    ("CH", "Klinik Musterberg", 1), ("CH", "Fondation du Modèle", 1),
    ("AT", "Musterklinikum Wien", 1),
    ("SE", "Exempelsjukhuset", 1), ("DK", "Eksempel Hospital", 1),
    ("HU", "Példa Kórház", 1), ("CZ", "Nemocnice Ukázka", 1),
    ("PT", "Hospital do Exemplo", 1), ("GR", "Geniko Nosokomeio Paradeigma", 1),
    ("TR", "Örnek Hastanesi", 1), ("NO", "Eksempel Sykehus", 1), ("RO", "Spitalul Exemplu", 1),
]

# Companies: name, country (None where the archive has none), postal code, parent, whether it
# has a contact page, and a weight for how often it appears.
COMPANIES = [
    ("Northwind MedTech", "BE", "1000", "Northwind Group", True, 14),
    ("Bluepeak Diagnostics", "DE", "10115", None, True, 12),
    ("Cascade Surgical", "IE", "D02", None, False, 10),
    ("Ironwood Devices", "NL", "1011", "Ironwood Holdings", True, 10),
    ("Fernbridge Medical", "FR", "75008", None, False, 9),
    ("Pinecrest Devices", "CH", "8001", None, True, 8),
    ("Havenport Health", "SE", "111 22", "Havenport Holdings", False, 8),
    ("Amberlight Imaging", "IT", "20121", None, True, 7),
    ("Quillfield Orthopaedics", "GB", "EC2", None, False, 6),
    ("Larkspur Cardio", "DK", "2100", None, False, 6),
    ("Tidewater Dental", None, "", None, False, 5),
    ("Cobalt Instruments", None, "", "Cobalt Group", False, 5),
]

DESCRIPTIONS = {
    "support_event": {
        "en": ["Annual Congress of the Example Society {year}", "Regional Workshop on Example Imaging {year}",
               "Example Surgery Symposium {year}"],
        "es": ["Congreso Nacional de Ejemplo {year}", "Jornadas de Cirugía de Ejemplo {year}",
               "Curso de Formación en Técnicas de Ejemplo {year}"],
        "de": ["Jahrestagung der Beispielgesellschaft {year}", "Fortbildungskurs Beispielmedizin {year}"],
        "fr": ["Journées d’Exemple de Chirurgie {year}", "Congrès Exemple de Radiologie {year}"],
        "it": ["Congresso Esempio di Ortopedia {year}", "Corso di Aggiornamento Esempio {year}"],
    },
    "other_grant": {
        "en": ["Fellowship programme in example techniques", "Educational materials for nursing staff",
               "Scholarships for training courses"],
        "es": ["Beca de formación en técnicas de ejemplo", "Material educativo para enfermería"],
        "de": ["Fortbildungsstipendium Beispielmedizin"],
        "fr": ["Bourse de formation Exemple"],
        "it": ["Borsa di studio Esempio"],
    },
}


def build_rows(rng):
    def new_id():
        return str(uuid.UUID(int=rng.getrandbits(128), version=4))

    countries = [(new_id(), name, code) for code, name in COUNTRIES]
    currencies = [(new_id(), name, code) for code, name, _rate in CURRENCIES]
    rates = {code: rate for code, _name, rate in CURRENCIES}

    companies = []
    for index, (name, country, postal, parent, has_page, _weight) in enumerate(COMPANIES, start=1):
        identifier = f"TEST-C-{index:04d}" if index % 4 else ""
        page = f"https://{name.lower().replace(' ', '-')}.example/transparency" if has_page else ""
        companies.append((new_id(), name + TEST_SUFFIX, identifier, country, postal,
                          parent + TEST_SUFFIX if parent else None, page))

    beneficiaries = []
    for index, (country, name, _weight) in enumerate(BENEFICIARIES, start=1):
        _currency, cities, street, _language = PLACES[country]
        city, postal = rng.choice(cities)
        identifier = f"TEST-B-{index:04d}" if index % 7 else ""
        beneficiaries.append((new_id(), name + TEST_SUFFIX, identifier,
                              street.format(n=rng.randint(1, 120)), postal, city, country))

    def pick(rows, weighted, index):
        # Every company and beneficiary gets at least one declaration, as in the archive.
        return rows[index] if index < len(rows) else rng.choices(rows, [entry[-1] for entry in weighted])[0]

    declarations = []
    for index in range(DECLARATION_COUNT):
        company = pick(companies, COMPANIES, index)
        beneficiary = pick(beneficiaries, BENEFICIARIES, index)
        country = beneficiary[6]
        local_currency, _cities, _street, language = PLACES[country]
        currency = local_currency if local_currency == "EUR" or rng.random() < 0.85 else "EUR"
        year = rng.choices(list(YEAR_WEIGHTS), list(YEAR_WEIGHTS.values()))[0]
        nature = "support_event" if rng.random() < 0.75 else "other_grant"

        euros = 10 ** rng.uniform(2.7, 4.8 if nature == "support_event" else 4.6)
        amount = round(euros * rates[currency], -1 if euros < 1000 else -2)
        if rng.random() < 0.1:
            amount += 0.5

        description = None
        if rng.random() < 0.4:
            texts = DESCRIPTIONS[nature]
            description = rng.choice(texts.get(language, texts["en"])).format(year=year)

        declarations.append((new_id(), year, float(amount), currency, nature, NATURE_LABELS[nature],
                             description, company[0], beneficiary[0], company[1], beneficiary[1],
                             country, company[3]))

    declarations.sort(key=lambda row: (row[1], row[9], row[0]))
    return {
        "countries": (["id", "name", "iso_code"], countries),
        "currencies": (["id", "name", "code"], currencies),
        "companies": (["id", "name", "unique_identifier", "country_code", "postal_code",
                       "parent_name", "contact_url"], companies),
        "beneficiaries": (["id", "name", "unique_identifier", "address", "postal_code", "city",
                           "country_code"], beneficiaries),
        "declarations": (["id", "year", "amount", "currency_code", "nature", "nature_label",
                          "description", "company_id", "beneficiary_id", "company_name",
                          "beneficiary_name", "beneficiary_country_code", "company_country_code"],
                         declarations),
    }


def sql_literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


def render(tables):
    lines = [
        "-- Made-up local test fixture for the Historical Declarations archive:",
        "-- 100 declarations by invented companies to invented organisations,",
        "-- 2022 to 2025. Every company and beneficiary name ends in \"(test data)\".",
        "-- Nothing here comes from the real archive.",
        "-- Regenerate with python3 scripts/build-d1-sample.py.",
        # Don't spell out the transaction keywords in this header: wrangler's file check
        # matches them even inside SQL comments and then refuses to import the whole file.
        "-- No explicit transaction statements: D1 rejects raw SQL",
        "-- transaction control statements over `wrangler d1 execute --remote`",
        "-- (it manages transactions itself).",
    ]
    for table, (columns, rows) in tables.items():
        lines.append("")
        for row in rows:
            values = ", ".join(sql_literal(value) for value in row)
            lines.append(f"INSERT OR IGNORE INTO {table} ({', '.join(columns)}) VALUES ({values});")
    return "\n".join(lines) + "\n"


def check(sql):
    """Loads the fixture into SQLite with the real schema and checks that it holds together."""
    con = sqlite3.connect(":memory:")
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(open(SCHEMA_PATH, encoding="utf-8").read())
    con.executescript(sql)
    cur = con.cursor()
    counts = {table: cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
              for table in ["countries", "currencies", "companies", "beneficiaries", "declarations"]}
    assert counts["declarations"] == DECLARATION_COUNT, counts
    assert not cur.execute("PRAGMA foreign_key_check").fetchall()
    names = [row[0] for row in cur.execute(
        "SELECT name FROM companies UNION ALL SELECT name FROM beneficiaries "
        "UNION ALL SELECT parent_name FROM companies WHERE parent_name IS NOT NULL")]
    assert all(name.endswith(TEST_SUFFIX) for name in names)
    assert not cur.execute(
        "SELECT 1 FROM declarations d JOIN companies c ON c.id = d.company_id "
        "JOIN beneficiaries b ON b.id = d.beneficiary_id "
        "WHERE d.company_name != c.name OR d.beneficiary_name != b.name "
        "OR d.beneficiary_country_code != b.country_code "
        "OR d.company_country_code IS NOT c.country_code").fetchall()
    assert {row[0] for row in cur.execute("SELECT DISTINCT year FROM declarations")} == set(YEAR_WEIGHTS)
    assert {row[0] for row in cur.execute("SELECT DISTINCT nature FROM declarations")} == set(NATURE_LABELS)
    assert not cur.execute(
        "SELECT 1 FROM declarations WHERE currency_code NOT IN (SELECT code FROM currencies) "
        "OR beneficiary_country_code NOT IN (SELECT iso_code FROM countries)").fetchall()
    return counts


def build():
    sql = render(build_rows(random.Random(2026)))
    counts = check(sql)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(sql)
    for table, count in counts.items():
        print(f"{table}: {count}")
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    build()
