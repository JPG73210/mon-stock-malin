# Add-on Home Assistant — Stock JP/JC Print

Imprime automatiquement les étiquettes Stock JP/JC sur une **Brother QL-810Wc en WiFi**, depuis votre NUC Home Assistant OS. Zéro tap sur le téléphone.

## Installation (5 minutes)

### 1. Préparer la QL-810Wc
- Brancher la QL au WiFi (touche WiFi sur l'imprimante + app Brother iPrint&Label une seule fois pour la configuration).
- Relever son **IP fixe** dans votre box (ex. `192.168.1.50`) et **réserver-la** (DHCP statique).

### 2. Ajouter le dépôt d'add-ons dans HA
1. Home Assistant → **Paramètres → Modules complémentaires → Boutique → ⋮ → Dépôts**.
2. Coller l'URL où vous avez hébergé ce dossier (GitHub, GitLab, ou serveur local), puis **Ajouter**.
3. Rafraîchir la page. L'add-on **Stock JP/JC Print Agent** apparaît en bas.

### 3. Installer & configurer
1. Cliquer sur l'add-on → **Installer** (build ≈ 2 min).
2. Onglet **Configuration** :
   - `SUPABASE_URL` : déjà rempli
   - `SUPABASE_ANON_KEY` : déjà rempli
   - `EMAIL` / `PASSWORD` : vos identifiants de connexion à l'app Stock JP/JC
   - `PRINTER_IP` : l'IP de la QL-810Wc (ex. `192.168.1.50`)
3. **Démarrer**. Activer **Démarrer au boot** et **Watchdog**.

### 4. Tester
- Dans l'app sur le S21 : Stock → ouvrir un produit → **Imprimer**.
- Le job apparaît dans **Impression** (statut *En attente* → *En cours* → *Imprimé*).
- L'étiquette sort de la QL en < 5 secondes.

## Dépannage
- **Statut bloqué sur "En attente"** : vérifier les logs de l'add-on (onglet Journal).
- **Erreur `cups-not-printing`** : pinger l'IP de la QL depuis HA (`ping <IP>` via Terminal). Si ça ne répond pas, l'IP a changé — corriger `PRINTER_IP`.
- **Étiquette tronquée** : le PDF est généré au mm exact côté app. Vérifier que le rouleau chargé correspond au format envoyé (DK-44205 pour 62×30, DK-11204 pour 17×54, etc.).

## Sécurité
- Le mot de passe est stocké dans `/data/options.json` (visible uniquement par l'add-on).
- L'agent se connecte avec votre compte utilisateur normal et obéit aux RLS Supabase.
- Aucune donnée n'est envoyée ailleurs que vers Supabase + la QL en LAN.
