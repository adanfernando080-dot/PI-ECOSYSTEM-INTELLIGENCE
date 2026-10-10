# ADR-0011 — Unités, décimaux, arrondis et ordre de calcul

- Statut : **Accepté pour M0** (implémenté : `units/`, `pricing/`, `tests/units`, `tests/pricing`)
- Liens : ADR-0006 · REQ-05, REQ-07, REQ-09

## Décision
1. **Décimal exact** (`Dec` sur `BigInt`) partout ; nombres sérialisés en **chaînes** décimales normalisées ; flottants refusés (`canonicalize` lève une erreur).
2. **Unités** : dimensions fermées (longueur, surface, volume, masse, temps, nombre). Le moteur ne connaît que des **unités techniques** (m, cm, mm, m², m³, l, kg, t, h, u). Les **unités commerciales** (sac, pot, sqft, lb, bag…) sont des **données de pack** avec un facteur exact vers l'unité de base. Conversions exactes (division à 18 décimales) ; **incohérence dimensionnelle = erreur**, jamais un avertissement.
3. **Ordre de calcul et points d'arrondi explicites** (le seul endroit où l'on perd de la précision est déclaré) :
   - `GeoQuantity` : exacte, sauf racine (échelle 8) ; **émise à 6 décimales** (demi vers le haut).
   - **Quantité d'ouvrage** (ligne de DQE) : somme exacte des contributions, **arrondie une fois** selon `Assembly.quantityRounding`. **Cette valeur affichée sert de base à tout l'aval** (articles à commander, prix) : le document est arithmétiquement vérifiable à la main.
   - **Besoin d'article** : somme exacte (avec pertes), arrondi de **commande** par article (`orderRounding`, ex. plafond à l'unité) — le seul arrondi « vers le haut » métier.
   - **Prix unitaire** : calcul exact des couches de coût, **arrondi à l'unité mineure de la devise** (`rounding.unitPrice`) ; **montant de ligne = arrondi(quantité affichée × prix unitaire affiché)**.
   - **Couches de total** (taxes, provisions) : arrondies à l'unité mineure ; les taxes composées s'appliquent sur les montants **déjà arrondis**.
4. **Monnaie** : montants en entiers de l'unité mineure ; devise, unités mineures et arrondis viennent du pack. Paramètres monétaires fixes (`fixed`) exprimés en unités **majeures** puis convertis.
5. **Dates** : fournies par l'appelant (`asOf`), arithmétique calendaire pure ; aucune horloge dans le noyau.

## Conséquences
(+) Aucune surprise d'arrondi, chaque écart est attribuable à une règle nommée. (−) L'arrondi de la quantité d'ouvrage avant pricing diffère de quelques millièmes d'un calcul « tout exact » : choix assumé pour la vérifiabilité (à valider avec un métreur).
