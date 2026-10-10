# ADR-0017 — Politique IA : fonctions essentielles hors ligne, IA locale ou cloud optionnelle, consentement explicite

- Statut : **Accepté** (principe produit confirmé) ; implémentation IA : M1/M2
- Remplace : l'hypothèse « IA 100 % locale au MVP » (v0.1–v0.3)
- Liens : ADR-0001 (R4, R6), ADR-0003, ADR-0007 · REQ-01, REQ-14, REQ-20, REQ-28

## Principe
Le produit **n'impose pas** une IA 100 % locale. Il impose :
1. **Fonctions essentielles utilisables sans connexion** : création/consultation de projets, modèle, hypothèses, métré géométrique et commercial, prix, DQE/devis, versions, vérification. Aucune de ces fonctions n'appelle de modèle d'IA ni de service cloud.
2. **Aucune donnée de plan n'est envoyée au cloud sans consentement explicite**, par projet, révocable, avec journal des envois consultable et contenu transmis décrit (recadrages plutôt que plan complet quand possible).
3. **L'architecture admet des modèles locaux ET une IA cloud optionnelle** derrière les mêmes contrats (`AiVision`, `AiOcr`, `AiAssistant`) : le choix par fonction est **décidé par benchmark** (qualité par tranche, latence, coût, matériel cible), pas a priori.
4. **Le moteur métier ne dépend jamais d'un service cloud** : `src/core` est pur (aucune API réseau, vérifié par `tests/purity`) ; le métré déterministe, le chiffrage et les documents n'importent aucun module d'IA.
5. **Dégradation gracieuse** : sans IA disponible (hors ligne, pas de consentement, panne), l'outil bascule sur le traçage assisté manuel ; les propositions IA n'entrent dans le modèle qu'après validation humaine (ADR‑0005).
6. **Les modèles de perception ne reçoivent jamais de contexte marché** (ADR‑0001 R4), qu'ils soient locaux ou cloud ; l'assistant, lui, opère dans un `MarketBinding` et n'émet que des nombres issus d'outils déterministes.

## Protocole de choix (à exécuter en M2)
Pour chaque fonction (OCR, segmentation murs/ouvertures, détection hors domaine, assistant) : mesurer sur A‑test/B‑test/C (tranches, calibration, effectifs) **local vs cloud** → critères : qualité ≥ seuil (OD‑11), temps sur matériel minimal, coût marginal, confidentialité, dépendance réseau. La décision est consignée dans un ADR par fonction. **Aucune hypothèse de matériel GPU ni de connectivité.**

## Conséquences
(+) Liberté de choisir le meilleur modèle ; offline‑first préservé pour l'essentiel. (−) Deux chemins d'inférence à maintenir pour les fonctions qui auront les deux ; politique de consentement et journal d'envois à construire (M1).
