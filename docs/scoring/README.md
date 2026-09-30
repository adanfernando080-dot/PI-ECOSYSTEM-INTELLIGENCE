# Méthodologie de scoring — V1

Version : `scoring-v1.0.0` · `confidence-v1.0.0` · `ranking-v1.0.0`.
Toutes les constantes sont dans `packages/scoring/src/config.ts`, `packages/confidence/src/config.ts` et `packages/ranking/src/engine.ts`, et sont servies publiquement par `GET /api/meta/methodology`. **Toute modification d'un poids impose d'incrémenter la version.**

Tous les scores sont sur **0–100**. Un score peut valoir **`null` = indisponible** ; il n'est alors jamais remplacé par 0.

## 0. Règles communes

### Combinaison des composants (`combineAvailable`)
```
score    = Σ(poids_i × valeur_i) / Σ(poids_i)      sur les composants DISPONIBLES
coverage = Σ(poids disponibles) / Σ(tous les poids)
score    = null  si coverage < seuil du moteur
```
Les composants manquants sont listés dans `missing`, la couverture est publiée et réduit la confiance.

### Normalisation écosystème
Les quantités absolues sont normalisées en échelle logarithmique contre une référence de l'écosystème :
```
logNormalize(x, ref) = clamp(100 × ln(1+x) / ln(1+ref), 0, 100)
```
`ref` = **90ᵉ percentile** de la mesure parmi les apps, pour la même date et la même période, avec un plancher (`buildNormalizationContext`). Le log évite qu'une très grosse app écrase toutes les autres vers 0.

### Totaux de fenêtre et jours manquants
Voir [ADR-0005](../architecture/decisions/0005-missing-data-handling.md) : jours avant la première apparition = 0 connu ; jours manquants = extrapolation au taux observé ; < 50 % de jours connus → `null`.

### Précédence des sources
Pour une même métrique et un même jour : `OBSERVABLE > DEVELOPER_REPORTED > ESTIMATED > UNAVAILABLE`, puis niveau de confiance de la source. Les valeurs divergentes ne sont **pas** moyennées : la plus fiable est retenue, le désaccord alimente la cohérence.

## 1. Pi Ecosystem Score

| Composant | Poids |
|---|---|
| Activity | 25 % |
| Growth | 20 % |
| Observable Economic Activity | 20 % |
| Community | 15 % |
| Transparency | 10 % |
| Data Confidence | 10 % |

- Le **staking est exclu** (le type d'entrée n'a pas de champ staking).
- Si moins de **50 %** du poids est disponible → `null`.
- Indicateur descriptif : **aucun classement n'est construit dessus**.

## 2. Activity Score

| Composant | Poids | Calcul |
|---|---|---|
| Transaction activity | 40 % | `logNormalize(transactions attribuables, ref)` |
| Frequency | 25 % | `jours actifs / jours de la fenêtre × 100` (sur les jours connus) |
| Active users / addresses | 20 % | `logNormalize(moyenne journalière, ref)` — **uniquement si disponible et attribuable** |
| Recency | 15 % | `100 × 0,5^(jours depuis la dernière activité / 7)` |

Seuil de couverture : **40 %**. Adresses indisponibles → composant exclu, poids redistribué, confiance réduite. Si les adresses sont absentes, les « active users » déclarés sont utilisés à la place (avec leur provenance).

## 3. Growth Score (50 = stable)

Mesure : transactions de la fenêtre courante vs fenêtre précédente de même durée.

| Composant | Poids | Calcul |
|---|---|---|
| Relative | 35 % | `g = (cur − prev) / max(prev, 50)` ; `g' = g × (0,25 + 0,75 × prev/(prev+200))` ; `50 + 50·tanh(g')` |
| Absolute | 30 % | `50 ± 50 × logNormalize(|cur − prev|, ref)/100` |
| Base size | 15 % | `logNormalize(prev, ref)` |
| Persistence | 20 % | part des 4 sous-périodes consécutives en hausse (≥ 2 comparaisons) |

Protections contre la domination d'une petite app avec un pic ponctuel :
- plancher de 50 au dénominateur (1 → 10 n'est pas « +900 % ») ;
- amortissement par la taille de base (une petite base ne garde qu'environ 25 % de sa croissance relative) ;
- composantes absolue, taille et persistance qui favorisent la croissance soutenue.

Test de référence : une app 10 → 100 avec un pic final obtient un score inférieur à une app 10 000 → 12 000 en croissance régulière.
Seuil de couverture : **50 %** ; sans fenêtre précédente comparable → `null`.

## 4. Observable Economic Activity

`ObservableEconomicActivity` — **ce n'est pas un revenu** ; aucune estimation de revenu n'est produite.

| Composant | Poids | Calcul |
|---|---|---|
| Transactions | 25 % | `logNormalize(n, ref)` |
| Volume Pi observable | 35 % | `logNormalize(volume, ref)` |
| Jours actifs | 15 % | ratio |
| Adresses distinctes | 15 % | seulement si confiance d'attribution ≥ **0,7** |
| Tendance du volume | 10 % | `50 + 50·tanh((vol − vol_prev)/max(vol_prev, 1))` |

Seuil de couverture : **40 %**. Seules les transactions attribuées (≥ 0,5) sont reliées à une app.

## 5. Community Score — moyenne bayésienne

```
AdjustedRating = (n / (n + k)) × R + (k / (n + k)) × C
CommunityScore = (AdjustedRating − 1) / 4 × 100
```

| Paramètre | Valeur | Signification |
|---|---|---|
| n | — | nombre d'avis **publiés** de l'app |
| R | — | moyenne de ces avis |
| k | **10** | force de l'a priori (« 10 avis virtuels ») |
| C | moyenne globale des avis publiés ; **3,5** si aucun | référence |

- `n = 0` → **`null`** (pas de donnée communautaire).
- Seuls les avis `PUBLISHED` comptent (les avis `PENDING`/`HIDDEN` sont exclus).

## 6. Transparency Score

Check-list pondérée (somme = 100) de l'information publiquement disponible — elle mesure la **divulgation**, pas la qualité.

| Élément | Poids | Condition |
|---|---|---|
| Description | 15 | ≥ 40 caractères |
| Catégorie | 10 | renseignée |
| Développeur identifié | 15 | lié à un profil |
| Développeur vérifié | 10 | `VERIFIED` |
| URL | 10 | http(s) valide |
| Informations publiques | 5 | logo ou tags |
| Méthodologie | 10 | note de méthodologie publiée |
| Données déclarées | 10 | au moins une métrique `DEVELOPER_REPORTED` dans la fenêtre |
| Provenance déclarée | 15 | proportionnel à la part de points à provenance connue |

## 7. Data Confidence

| Composant | Poids | Calcul |
|---|---|---|
| Provenance | 30 % | qualité moyenne : OBSERVABLE 100, DEVELOPER_REPORTED 60, ESTIMATED 40, UNAVAILABLE 0 |
| Fraîcheur | 20 % | 100 jusqu'à 1 jour, puis ÷2 tous les 7 jours |
| Complétude | 25 % | moyenne(couverture Activity, Growth, Economic, jours connus) |
| Cohérence | 15 % | accord moyen entre sources qui se recoupent (`1 − |a−b|/max`) ; **50 (neutre)** si une seule source |
| Sources concordantes | 10 | 0 → 0, 1 → 40, 2 → 75, ≥ 3 → 100 |

| Niveau | Score |
|---|---|
| HIGH | 90–100 |
| GOOD | 75–89 |
| PARTIAL | 50–74 |
| LIMITED | 25–49 |
| VERY_LOW | 0–24 |

## 8. Classements

Un classement ordonne les apps **sur une seule dimension**. Apps à valeur indisponible exclues ; rangs « 1224 » (égalité au dixième près) ; départage d'ordre d'affichage : confiance puis nom.

| Type | Score utilisé |
|---|---|
| activity / growth / economic / community / transparency | le score correspondant |
| trending | `0,6 × Growth (fenêtre courte) + 0,4 × Activity` ; fenêtre courte : 90d→30d, 30d→7d, 7d→24h, 24h→24h |
| rising | Growth, apps apparues depuis ≤ 90 jours |
| new | `100 × (1 − âge/30)`, apps apparues depuis ≤ 30 jours, plus récentes d'abord |

Filtre optionnel `minConfidence`. Les snapshots sont conservés (un lot = un `computedAt`).

## 9. Anomalies (signaux statistiques)

| Type | Détection | Sévérité |
|---|---|---|
| ACTIVITY_SPIKE / VOLUME_SPIKE | z-score robuste du dernier jour vs 30 j (médiane/MAD×1,4826), valeur ≥ 20 | z ≥ 4 LOW, ≥ 7 MEDIUM, ≥ 12 HIGH |
| CONCENTRATION_SIGNAL | part du volume du principal émetteur sur 7 j (≥ 20 tx) + HHI | ≥ 50 % LOW, ≥ 70 % MEDIUM, ≥ 90 % HIGH |
| REPEATED_TRANSACTION_PATTERN | même (émetteur, destinataire, montant) ≥ 10 fois | part ≥ 25 % LOW, ≥ 45 % MEDIUM, ≥ 70 % HIGH |
| UNUSUAL_REVIEW_ACTIVITY | z-score robuste du nombre d'avis du jour (≥ 5), avec uniformité des notes et part de comptes récents | comme les pics |

Chaque signal : type, sévérité, score 0–100, explication neutre, horodatage, statut (`NEW` → `INVESTIGATING` → `RESOLVED`/`DISMISSED`), empreinte (dé-duplication). **Aucun signal n'est une conclusion** ; aucun avis n'est masqué ni qualifié automatiquement.
