## Objectif

Séparer **Recherche** et **Inventaire** en deux pages distinctes, et ajouter un vrai mode inventaire physique avec suivi des sorties.

---

## 1. Page Recherche (allégée) — `/recherche`

On garde la page actuelle mais **uniquement** pour :
- chercher / scanner un produit ou vin (douchette, caméra, texte)
- voir les détails, modifier, ajuster la quantité (+/−)
- les 3 modes restent : Sortie / Entrée / Détails

→ On retire toute la logique "liste de scans cumulés en masse".

---

## 2. Nouvelle page Inventaire — `/inventaire`

Une page dédiée au comptage physique du stock.

### Démarrer une session d'inventaire
En haut, choix du périmètre :
- **Catégorie** : Tous / Vins / Produits
- **Filtre type** (si Produits) : Tous, Saucisson Porc, Saucisson Cerf, Bourguignon, etc. (liste construite depuis `produit` + `animal`)
- bouton **Démarrer l'inventaire**

### Pendant la session
Deux colonnes :

**Colonne A — À compter** (produits du périmètre, non encore scannés)
- liste des items en stock (`quantite > 0`) qui n'ont pas encore été scannés dans la session
- recherche/filtre rapide

**Colonne B — Comptés ✓** (les 5 derniers scans visibles en tête + total)
- chaque scan ajoute le produit ici
- **doublon bloqué** : si même `id` déjà scanné → toast "déjà compté" et pas d'ajout
- possibilité d'ajuster la quantité réelle constatée (différente du stock système)

### Inconnus
Section **Produits inconnus scannés** : codes scannés qui ne correspondent à rien en base → bouton "Enregistrer ce produit" qui pré-remplit le formulaire d'entrée avec le code.

### Fin de session
Bouton **Terminer & exporter** qui génère une fiche `.csv` :
- produits comptés (avec écarts stock système / stock réel)
- produits non comptés (manquants)
- produits inconnus

---

## 3. Feuille des sorties — `/sorties`

Nouvelle page qui liste les produits **sortis du stock** (passés à `deleted_at` ou `quantite` diminuée via le mode Sortie).

- table avec date, produit, code, quantité sortie
- filtres : période, type
- export `.csv`

Source de données : on ajoute une petite table `stock_movements` (id, user_id, item_id, kind product/wine, delta, reason in/out/inventory, created_at) alimentée à chaque ajustement depuis Recherche et Inventaire. Permet aussi de tracer l'historique futur.

---

## 4. Menu latéral (AppShell)

Ajout de deux entrées :
- **Inventaire** (icône `ClipboardList`)
- **Sorties** (icône `LogOut`)

---

## Détails techniques

- Migration SQL : nouvelle table `stock_movements` avec RLS `auth.uid() = user_id`.
- Hook commun `useAdjustQuantity` qui met à jour la quantité ET insère un mouvement.
- État de session d'inventaire local (React state, pas persistant) — si la page est rechargée, la session est perdue. OK pour un premier jet ?

---

## Questions avant de lancer

1. **Persistance de la session d'inventaire** : OK qu'elle soit perdue si on recharge la page, ou il faut la sauvegarder en base pour reprendre plus tard ?
2. **Feuille des sorties** : on remonte uniquement les sorties futures (à partir de maintenant), ou tu veux aussi qu'on essaie de reconstituer l'historique depuis les entrées supprimées (`deleted_at`) ?
