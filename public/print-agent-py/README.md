# Agent Python — Stock JP/JC → Brother QL-810W (IP directe)

Envoie les jobs d'impression **directement** en TCP/9100 sur la QL-810W via WiFi.
**Aucun pilote Brother requis**, aucune imprimante Windows à installer.

## Pré-requis

- **Python 3.10+** : https://www.python.org/downloads/
- L'imprimante QL-810W en WiFi, IP fixe (à récupérer dans le menu de l'imprimante
  ou dans l'interface de ta box / routeur).

## Installation (Windows / macOS / Linux)

```bash
# 1. Dans le dossier de l'agent
pip install -r requirements.txt

# 2. Configurer
cp config.example.json config.json      # (sur Windows : copy)
# édite config.json :
#   - EMAIL / PASSWORD : ton compte Stock JP
#   - PRINTER_IP       : IP WiFi de la QL-810W (ex. 192.168.1.50)

# 3. Lancer
python agent.py
```

À l'écran tu dois voir :

```
-> Connexion...
OK  Connecté · imprimante tcp://192.168.1.50:9100 · modèle QL-810W
Polling toutes les 4000ms...
```

## Comment trouver l'IP de la QL-810W

1. Sur l'imprimante : maintiens le bouton **WiFi** ~5 s → elle imprime un rapport
   réseau avec son adresse IP.
2. Ou dans l'interface admin de ta box : repère « Brother » dans la liste des
   appareils connectés.

**Important** : réserve cette IP dans ta box (bail DHCP statique) pour qu'elle
ne change pas.

## Dépannage

- **`Connection refused` ou timeout** : vérifie que le PC et l'imprimante sont
  sur le même réseau WiFi, et que l'IP du `config.json` est la bonne.
- **`auth échouée`** : vérifie EMAIL/PASSWORD (ceux de Stock JP).
- **L'étiquette sort mal cadrée** : vérifie que le rouleau physique correspond
  au format choisi dans l'app (DK-44205 pour `62` continu, etc.).
