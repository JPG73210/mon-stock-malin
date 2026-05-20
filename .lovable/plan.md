## Objectif

Rendre l'app utilisable avec ton stock existant et tes habitudes : listes déroulantes éditables, gestion des entrées (modifier/supprimer), import des anciens QR codes, lecture EAN.

## 1. Listes déroulantes éditables (auto-apprenantes)

Nouvelle table `user_options` :
- `id`, `user_id`, `field` (clé : `produit`, `animal`, `fruit`, `emplacement`, `unite_poids`, `chateau`, `type_vin`, `couleur_vin`, `millesime`, `etiquette_format`), `value`, `created_at`
- Unique sur (user_id, field, value)
- RLS : own rows uniquement

Nouveau composant `<ManagedSelect field="produit" />` :
- Charge les valeurs depuis `user_options` + valeurs de base (`constants.ts`) fusionnées
- Option "+ Ajouter…" en bas → mini-dialog pour saisir une nouvelle valeur, enregistrée automatiquement
- Icône crayon à côté → ouvre un panneau qui liste toutes les valeurs perso avec boutons Modifier / Supprimer
- Suppression : retire de la liste mais ne touche pas aux produits déjà créés avec cette valeur

Appliqué partout : Entrée (produit, animal, fruit, emplacement, unité poids, format étiquette) et Vin (château/domaine, type, couleur, millésime, emplacement).

## 2. Millésime & poids

- Millésime : `ManagedSelect` avec valeurs par défaut (année courante − 30 → +1) + ajout libre
- Poids : champ numérique libre + `ManagedSelect` pour l'unité (g, kg, mL, L, pièce…) avec ajout

## 3. Modifier / Supprimer un produit ou un vin

Sur **Stock** et **Recherche** :
- Clic sur une ligne → dialog "Détails" avec toutes les infos
- Boutons **Modifier** (formulaire pré-rempli, même UI que l'entrée) et **Supprimer** (passe `deleted_at` → corbeille)

Sur les pages **Entrée** et **Vin** :
- Nouveau bloc "10 dernières entrées" en bas, avec mini-actions Modifier / Supprimer en ligne

## 4. Sortie rapide

Sur Recherche : le toggle "+ Entrée / − Sortie" existe déjà. J'ajoute un 3ᵉ toggle **Détails** : un scan ouvre directement la fiche au lieu d'incrémenter, pour permettre Modifier/Supprimer depuis la douchette.

## 5. Import des anciens QR codes (legacy)

Deux mécanismes :

**a. Saisie d'ID legacy au moment de l'entrée**
- Nouvelle case à cocher "J'ai déjà un QR code / une étiquette" sur le formulaire d'entrée
- Si cochée : un champ "Code existant" remplace la génération auto (`generate_product_code` non appelé, le code saisi/scanné est utilisé tel quel)
- La case `code` de la BDD accepte n'importe quel format → aucune migration nécessaire, juste une contrainte d'unicité par utilisateur (à ajouter)

**b. Import en masse (Excel/CSV)**
- Nouvelle page **Import** : on dépose un fichier CSV (colonnes : code, produit, animal/fruit, emplacement, version, bague, date, poids, unité, quantité, notes)
- Aperçu → bouton "Importer" → bulk insert
- Format compatible avec un export de ton fichier Excel VBA (je te dirai exactement les colonnes attendues quand tu enverras le fichier)

## 6. EAN / codes-barres

`@zxing/browser` déjà installé décode déjà EAN-8, EAN-13, UPC-A, UPC-E, Code 128, QR, etc. Pas de changement de lib nécessaire ; je vérifie juste que le `BrowserMultiFormatReader` est bien configuré pour les EAN (par défaut oui). Je teste avec une vraie bouteille.

## 7. Vue "10 dernières entrées"

Bloc compact en bas de chaque page de saisie :
- Liste triée `created_at DESC limit 10`
- Chaque ligne : code/label · qté · emplacement · 🖉 ✕
- Clic 🖉 → dialog d'édition ; clic ✕ → confirmation puis corbeille

## Technique

**Migrations SQL**
1. Table `user_options` + RLS + index (user_id, field)
2. Index unique sur `products.code` par `user_id` (pour éviter doublons à l'import)
3. Seed : les valeurs actuelles de `constants.ts` ne sont PAS insérées en BDD ; elles restent en fallback côté client (la BDD ne contient que les ajouts perso de l'utilisateur)

**Nouveaux composants**
- `src/components/ManagedSelect.tsx` (combobox + add + manage)
- `src/components/ManageOptionsDialog.tsx` (liste éditable d'un `field`)
- `src/components/ProductEditDialog.tsx`
- `src/components/WineEditDialog.tsx`
- `src/components/RecentEntries.tsx`

**Nouvelles routes**
- `src/routes/_authed/import.tsx` (CSV → preview → bulk insert)

**Pages modifiées**
- `entree.tsx`, `vin.tsx`, `stock.tsx`, `recherche.tsx`

## Ce que je NE fais PAS dans ce lot

- Driver d'impression WiFi QL-810Wc (Phase 2)
- Modèles .lbx stockés
- Parser direct du `.xlsm` VBA (CSV d'abord ; je traiterai le `.xlsm` ensuite quand tu l'enverras)

## Confirmation rapide

Avant de coder, deux points :
1. **Suppression d'une option** dans la liste (ex : tu supprimes "Daim" des animaux) : ça enlève seulement l'option pour les **futures** entrées, les produits existants gardent "Daim". OK ?
2. **Import legacy** : tu préfères que je commence par le formulaire "code existant à scanner" maintenant, et le CSV d'import en masse quand tu envoies un export de ton Excel ? Ou tout d'un coup ?