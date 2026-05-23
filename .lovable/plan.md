… (large request — proposing a plan before implementing)

# Plan: refonte multi-pages

Demande très large touchant ~8 écrans. Je propose un plan structuré pour valider avant de coder.

## 1. Tableau de bord (`/`)
- Titre éditable (clic = input inline, sauvegarde dans `profiles.full_name` ou nouveau champ `dashboard_title`).
- Ajouter carte "Sorties du mois" (ou total) entre "Bouteilles en cave" et "Corbeille".
- Réordonner raccourcis menu : 1) Voir stock complet en premier, 2) ajouter "Sorties de stock" en dernier.
- Nouvelle section "Produits sélectionnés" sous les cases "à racheter" (alimentée par sélection depuis page Stock).

## 2. Identifiants en majuscules partout
- Ajouter helper `toUpperCase()` sur tous les inputs de code (entrée, recherche, inventaire, édition).
- Recherche : la lookup reste tolérante minuscules pour compatibilité anciennes étiquettes (déjà OK car `ilike` + comparaison normalisée).
- Pas de migration DB : les anciens codes restent tels quels, seule la saisie est forcée majuscule.

## 3. Entrée viande/légumes (`/entree`)
- `version` et `bague` → défaut `null` (vide).
- Ajouter composant `<LabelPreview>` au-dessus du bouton enregistrer, qui rend l'aperçu selon `etiquette_format` sélectionné.
- Remplacer "Enregistrer" + "Enregistrer et imprimer" + autres → un seul bouton **"Enregistrer et imprimer"**.
- Après impression : reset uniquement `quantite` et `poids`, garder le reste.
- Reset complet uniquement au unmount/logout (déjà le cas si on ne reset pas manuellement).

## 4. Entrée vin (`/vin`)
- Réordonner : photo étiquette en 1er, puis code-barres.
- Tous les selects par défaut vides sauf `emplacement`.
- Ajouter ligne au-dessus de "à racheter" : **"Comme racheter"** = toggle + icône imprimante (sans texte) qui imprime étiquette 23×23 QR seul.
- En dessous de "à racheter" : 3 icônes médailles (or/argent/bronze) cochables → nouveau champ DB `medailles text[]`.
- Aperçu QR code au-dessus du bouton enregistrer.
- Pas de reset après impression.

## 5. Stock vin (`/stock` filtre vin)
- Afficher miniature photo étiquette + icônes médailles sur chaque ligne.

## 6. Stock (`/stock`)
- Case à cocher sur chaque produit.
- Sélection propagée vers le tableau de bord (store local `localStorage` ou table `selections`).

## 7. Recherche (`/recherche`)
- Titre : retirer "& Inventaire" → "Recherche".
- Cases à cocher sur "Derniers scans".
- Remplacer toggles Entrée/Sortie/Détails par bouton unique **"Sortir la sélection"** qui passe les produits cochés en sortie.
- Recherche par saisie d'identifiant fonctionne déjà → garder + s'assurer maj.
- Si scan vin : afficher comme dans stock vin (miniature + médailles).

## 8. Inventaire (`/inventaire`)
- Avant démarrage : 3 listes déroulantes (Produit, Animal, Fruit) pour filtrer le scope.
- Case "Envoyer manquants en sortie" + bouton **"Sortir manquants"**.
- Icône vert ✓ sur produits scannés effectivement en stock.

## 9. Sorties (`/sorties`)
- Cases à cocher sur chaque ligne ≤ 30 jours.
- Bouton **"Restaurer"** avec dialog confirmation.
- Au-delà de 30 jours : case désactivée.

## 10. Modèles étiquettes (`/etiquettes`)
- Supprimer "Ajouter un modèle".
- Remplacer par grille d'aperçus de chaque format (`23x23`, `17x54`, `62x29`, `62x100`, `62`) rempli avec données fictives.

## 11. Impression (`/impression`)
- Nettoyer la page (retirer Options 1/2/3 si non utilisées).
- Garder file d'impression + statut agent.
- Ajouter info-bulle / accordéon "Comment ça marche ?" expliquant :
  - Agent Node.js / Python / HA add-on
  - Heartbeat Supabase
  - Webhook serpolet.eu démarrage agent
  - NAS + Home Assistant
  - Liens vers fichiers sources (`/print-agent.zip`, `/ha-addon/`, etc.)

## DB / Migration nécessaire
- `wines.medailles text[]` (or/argent/bronze).
- `wines.comme_racheter boolean default false`.
- Éventuellement `profiles.dashboard_title text`.

## Points à clarifier
1. **Titre tableau de bord** : modifiable par utilisateur ou statique ? → je propose éditable et sauvé en DB.
2. **"Sorties du mois"** : tu veux le total des 30 derniers jours ? le mois en cours ? ou total global ?
3. **Sélection produits → tableau de bord** : tu veux que la sélection persiste entre sessions (DB) ou juste la session courante (localStorage) ?
4. **Bouton unique "Enregistrer et imprimer"** : que faire si `etiquette_format = "Pas d'étiquettes"` ? → enregistrer sans imprimer ?

C'est costaud — je préfère partir avec tes réponses pour ne pas refaire deux fois. Dis-moi et j'attaque dans l'ordre 1→11.
