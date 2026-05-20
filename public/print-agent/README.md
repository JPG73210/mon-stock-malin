# Agent d'impression — Stock JP/JC

Petit service Node.js qui scrute la file d'impression du cloud et imprime
automatiquement les étiquettes sur la **Brother QL-810Wc** connectée en WiFi
ou USB à l'ordinateur où il tourne.

## Pré-requis

- **Node.js 18+** : <https://nodejs.org>
- **macOS / Linux** : CUPS + driver Brother QL (déjà inclus sur macOS récent).
  Vérifier le nom de l'imprimante avec : `lpstat -p` puis utiliser le nom
  exact dans `config.json`.
- **Windows** : driver Brother QL installé (b-PAC ou driver standard).

## Installation

```bash
cd print-agent
npm install
cp config.example.json config.json
# éditer config.json avec votre email/mot de passe et le nom de l'imprimante
npm start
```

## Lancement au démarrage (macOS)

Créer `~/Library/LaunchAgents/com.stockjp.print-agent.plist` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.stockjp.print-agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/CHEMIN/VERS/print-agent/agent.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>/CHEMIN/VERS/print-agent</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
```

Puis : `launchctl load ~/Library/LaunchAgents/com.stockjp.print-agent.plist`

## Raspberry Pi

Idéal : un Pi Zero 2W + l'imprimante en USB. Installer Node, CUPS, le driver
Brother QL, puis lancer le script avec `pm2 start agent.mjs`.

## Dépannage

- `lp: Erreur — imprimante introuvable` → vérifier `lpstat -p`, corriger
  `PRINTER` dans `config.json`.
- Étiquette mal centrée → ajuster `media=Custom.62x30mm` dans `agent.mjs` pour
  les rouleaux pré-découpés.
