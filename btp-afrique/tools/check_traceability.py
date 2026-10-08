#!/usr/bin/env python3
"""Vérifie la cohérence de la documentation d'architecture (aucune dépendance externe).

Contrôles :
  1. chaque exigence (INDEX §2) apparaît dans la matrice (INDEX §3) avec >= 1 test ;
  2. chaque test cité existe dans ARCHITECTURE.md §13 ; toute référence T-xxx-nn dans les
     documents pointe vers un test défini ;
  3. tout test défini est cité par >= 1 exigence (sinon avertissement) ;
  4. tout ADR cité existe (fichier) ou figure dans adr/README.md ;
  5. tous les liens de fichiers de INDEX.md existent ;
  6. chaque décision ouverte (INDEX §7) a un statut.

Usage : python3 -I btp-afrique/tools/check_traceability.py   (code de sortie 1 si erreur)
"""
import re
import sys
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent / "docs"
norm = lambda t: t.replace("‑", "-")          # tiret insécable -> tiret
read = lambda p: norm((DOCS / p).read_text(encoding="utf-8"))

errors, warnings = [], []
arch, index = read("ARCHITECTURE.md"), read("INDEX.md")
adr_readme = read("adr/README.md")

# --- tests définis (ARCHITECTURE §13)
sec13 = arch[arch.index("## 13."):arch.index("## 14.")]
tests = {}
for m in re.finditer(r"^\| (T-[A-Z0-9]+-\d+) \| (.*?) \| ([MV]\d)[^|]*\|\s*$", sec13, re.M):
    tests[m.group(1)] = (m.group(2), m.group(3))
if not tests:
    errors.append("Aucun test trouvé dans ARCHITECTURE.md §13")

# --- exigences (INDEX §2) et matrice (INDEX §3)
def section(text, start, end):
    i = text.index(start)
    j = text.index(end, i + 1)
    return text[i:j]

sec2 = section(index, "## 2. Exigences", "## 3. Matrice")
reqs = {m.group(1): m.group(2) for m in re.finditer(r"^\| (REQ-\d+) \| (.*?) \|", sec2, re.M)}
sec3 = section(index, "## 3. Matrice", "## 4. Décisions")
matrix = {}
for line in sec3.splitlines():
    if line.startswith("| REQ-"):
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        matrix[cells[0]] = cells

for r in reqs:
    if r not in matrix:
        errors.append(f"{r} absente de la matrice (INDEX §3)")
for r, cells in matrix.items():
    if r not in reqs:
        errors.append(f"{r} dans la matrice mais non définie en INDEX §2")
    ids = re.findall(r"T-[A-Z0-9]+-\d+", cells[4]) if len(cells) > 4 else []
    if not ids:
        errors.append(f"{r} : AUCUN test (exigence décrite mais jamais testée)")
    for t in ids:
        if t not in tests:
            errors.append(f"{r} : test {t} non défini dans ARCHITECTURE.md §13")

cited = {t for cells in matrix.values() for t in re.findall(r"T-[A-Z0-9]+-\d+", cells[4])}
for t in sorted(set(tests) - cited):
    warnings.append(f"test orphelin (aucune exigence ne le cite) : {t}")

# --- références T-xxx dans tous les documents
all_docs = {p: read(str(p.relative_to(DOCS))) for p in DOCS.rglob("*.md")}
for p, txt in all_docs.items():
    for t in set(re.findall(r"\bT-[A-Z0-9]+-\d+\b", txt)):
        if t not in tests:
            errors.append(f"{p.relative_to(DOCS)} : référence au test inconnu {t}")

# --- ADR cités
adr_files = {m.group(1) for p in (DOCS / "adr").glob("ADR-*.md") for m in [re.match(r"ADR-(\d{4})", p.name)] if m}
adr_listed = set(re.findall(r"^\| (?:\[)?(\d{4})", adr_readme, re.M))
for p, txt in all_docs.items():
    for n in set(re.findall(r"ADR-(\d{4})", txt)):
        if n not in adr_files and n not in adr_listed:
            errors.append(f"{p.relative_to(DOCS)} : ADR-{n} inconnu (ni fichier ni entrée du registre)")
for n in sorted(adr_files - adr_listed):
    errors.append(f"ADR-{n} : fichier présent mais absent de adr/README.md")

# --- liens de fichiers de INDEX.md
for m in re.finditer(r"\]\(([^)#]+)(?:#[^)]*)?\)", index):
    target = m.group(1)
    if not target.startswith("http") and not (DOCS / target).exists():
        errors.append(f"INDEX.md : lien cassé -> {target}")

# --- décisions ouvertes
sec7 = section(index, "## 7. Registre", "## 8. Roadmap")
ods = re.findall(r"^\| (OD-\d+) \| .*? \| .*? \| .*? \| (.*?) \|\s*$", sec7, re.M)
for od, status in ods:
    if not status.strip():
        errors.append(f"{od} : statut vide")

print(f"Exigences : {len(reqs)} | tests définis : {len(tests)} | tests cités : {len(cited)} | ADR rédigés : {len(adr_files)} | décisions ouvertes : {len(ods)}")
for w in warnings:
    print("AVERTISSEMENT :", w)
for e in errors:
    print("ERREUR :", e)
print("OK" if not errors else f"ÉCHEC ({len(errors)} erreur(s))")
sys.exit(1 if errors else 0)
