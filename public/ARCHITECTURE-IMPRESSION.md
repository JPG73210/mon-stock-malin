# Architecture Impression — Stock JP
> Documentation complète du système d'impression d'étiquettes
> Dernière mise à jour : 25/05/2026

---

## Vue d'ensemble

```
Lovable (app gestion stock)
    ↓ INSERT print_jobs (Supabase)
Agent Node.js (NAS Ugreen DXP480T)
    ↓ pdftoppm + brother_ql
Brother QL-810Wc (WiFi 19.80.1.101)
    ↓ Étiquette imprimée ✅
```

---

## 1. Flow complet de démarrage

```
Clic icône imprimante rouge dans Lovable
        ↓
POST https://serpolet.eu/api/webhook/start_print_agent
        ↓
Home Assistant :
  1. Allume switch.multiprise_tv_l1 (prise NAS)
  2. Attend 5s
  3. Envoie paquet Wake-on-LAN (MAC: 98:6e:e8:2f:b2:45)
  4. Allume switch.multiprise_bureau_2_l3 (prise imprimante)
  5. Attend 60s que le NAS démarre
        ↓
NAS Ugreen DXP480T démarre
        ↓
Container Docker stockjp-agent démarre automatiquement
        ↓
Agent installe dépendances + se connecte à Supabase
        ↓
Heartbeat toutes les 20s → icône verte dans Lovable ✅
```

---

## 2. Flow complet d'impression

```
1. Lovable génère le PDF (QR code + données produit)
2. Lovable encode le PDF en base64
3. Lovable insère dans print_jobs (status: pending)
4. Agent poll Supabase toutes les 4s → détecte le job
5. Agent met status: printing
6. Agent décode pdf_base64 → /tmp/job-xxx.pdf
7. pdftoppm convertit PDF → PNG (300 dpi)
8. Python redimensionne PNG aux dimensions exactes du format
9. brother_ql envoie PNG à l'imprimante via TCP:9100
10. Agent met status: printed + printed_at
11. Lovable affiche confirmation ✅
```

---

## 3. Supabase (Backend Lovable)

**Projet** : `ppwvpxjhccpxolcfcyyv.supabase.co`

### Table `print_jobs`
| Colonne | Type | Description |
|---|---|---|
| `id` | uuid | ID unique du job |
| `status` | text | `pending` → `printing` → `printed` / `error` |
| `format` | text | Format étiquette : `62`, `17x54`, `23x23`, `62x100`, `62x29` |
| `pdf_base64` | text | PDF encodé en base64 (sans préfixe `data:`) |
| `label_data` | jsonb | Données produit (référence, poids, traçabilité…) |
| `user_id` | uuid | Propriétaire du job |
| `printer_name` | text | Nom de l'imprimante cible |
| `created_at` | timestamptz | Date de création |
| `printed_at` | timestamptz | Date d'impression |
| `error` | text | Message d'erreur éventuel |

### Table `agent_status`
| Colonne | Type | Description |
|---|---|---|
| `id` | text | `print-agent` (clé primaire) |
| `user_id` | uuid | Utilisateur authentifié |
| `last_seen` | timestamptz | Dernier heartbeat (toutes les 20s) |
| `status` | text | `online` / `offline` |
| `printer_ip` | text | IP de l'imprimante |

---

## 4. Agent Node.js (NAS Ugreen)

**Fichier** : `/app/agent.mjs`
**Gist** : `https://gist.github.com/JPG73210/9cbada4832f8a54e29832fff9e3f9ca9`
**URL Raw** : `https://gist.githubusercontent.com/JPG73210/9cbada4832f8a54e29832fff9e3f9ca9/raw/510ebfc3b5aa45ecccceaa38edb68164f03e272b/gistfile1.txt`

### Configuration
```javascript
const SUPABASE_URL = "https://ppwvpxjhccpxolcfcyyv.supabase.co";
const EMAIL = "jpgrolla@outlook.fr";      // Compte utilisateur app Stock JP
const PRINTER_IP = "19.80.1.101";
const POLL_MS = 4000;       // Poll Supabase toutes les 4s
const HEARTBEAT_MS = 20000; // Heartbeat toutes les 20s
```

### Dimensions PNG par format
| Format | Pixels (L x H) |
|---|---|
| `62` | `696 x auto` |
| `17x54` | `165 x 566` |
| `23x23` | `202 x 202` (rotation 90°) |
| `62x100` | `696 x 1109` |
| `62x29` | `696 x 271` |

### Dépendances
```bash
npm install @supabase/supabase-js ws
apt-get install poppler-utils python3-pip
pip3 install pillow==9.5.0 brother_ql
```

> ⚠️ **Important** : Utiliser `pillow==9.5.0` — la version 12+ est incompatible avec `brother_ql 0.9.4`

---

## 5. Container Docker (NAS UGOS)

**Projet docker-compose** : `stockjp`
**Container** : `stockjp-agent`
**Restart policy** : `Always`
**Volume** : `/volume1/Gestion de Stock/stockjp-agent` → `/data`

### Script de démarrage `/data/start.sh.txt`
```bash
#!/bin/bash
apt-get update -qq
apt-get install -y -qq poppler-utils python3-pip
pip3 install pillow==9.5.0 brother_ql --break-system-packages -q
mkdir -p /app
curl -L -o /app/agent.mjs "https://gist.githubusercontent.com/JPG73210/9cbada4832f8a54e29832fff9e3f9ca9/raw/510ebfc3b5aa45ecccceaa38edb68164f03e272b/gistfile1.txt"
cd /app && npm init -y && npm install @supabase/supabase-js ws && node agent.mjs
```

### docker-compose.yaml
```yaml
services:
  agent:
    image: node:20
    container_name: stockjp-agent
    restart: always
    volumes:
      - /volume1/Gestion de Stock/stockjp-agent:/data
    entrypoint: ["/bin/bash", "-c"]
    command:
      - |
        sed -i 's/\r//' /data/start.sh.txt
        chmod +x /data/start.sh.txt
        /data/start.sh.txt
```

---

## 6. Formats d'étiquettes supportés

| Format | Label brother_ql | Usage |
|---|---|---|
| `62` | `62` | 62mm continu — viande, grands produits |
| `17x54` | `17x54` | Petits produits |
| `23x23` | `23x23` | Étiquettes carrées |
| `62x100` | `62x100` | Étiquettes prédécoupées |
| `62x29` | `62x29` | Format court |

---

## 7. Imprimante Brother QL-810Wc

- **IP** : `19.80.1.101` (fixe)
- **Port** : `9100` (socket raw)
- **Protocole** : `brother_ql` réseau (`tcp://19.80.1.101`)
- **Connexion** : WiFi réseau local
- **Démarrage** : automatique à la mise sous tension (configuré sur l'imprimante)

---

## 8. Home Assistant (serpolet.eu)

### Entités prises
| Entité | Description |
|---|---|
| `switch.multiprise_tv_l1` | Prise NAS Ugreen |
| `switch.multiprise_bureau_2_l3` | Prise imprimante Brother QL-810Wc |

### Webhook — Démarrer l'agent
**URL** : `POST https://serpolet.eu/api/webhook/start_print_agent`

### Automatisation `automations.yaml`
```yaml
- alias: Démarrer agent impression
  trigger:
  - platform: webhook
    webhook_id: start_print_agent
    allowed_methods:
    - POST
    local_only: false
  action:
  - action: switch.turn_on
    target:
      entity_id: switch.multiprise_tv_l1
  - delay:
      seconds: 5
  - action: wake_on_lan.send_magic_packet
    data:
      mac: 98:6e:e8:2f:b2:45
      broadcast_port: 9
  - action: switch.turn_on
    target:
      entity_id: switch.multiprise_bureau_2_l3
  - delay:
      seconds: 60
  - action: persistent_notification.create
    data:
      message: NAS et imprimante démarrés
      title: Imprimante
  id: c96db03278074f94ad1c6479526c3bf4
```

### `configuration.yaml`
```yaml
rest_command:
  label_printer_print:
    url: 'http://homeassistant.local:8013/api/print/text?text={{ text }}&font_size={{ font_size }}&font_family=DejaVu%20Serif%20(Book)&label_size={{ label_size }}'
    method: GET
    content_type: 'application/json; charset=utf-8'
  start_stockjp:
    url: "http://19.80.1.25:2375/containers/stockjp-agent/start"
    method: POST
```

---

## 9. Icône imprimante dans Lovable

- **Verte** : `agent_status.status === 'online'` ET `last_seen` < 60s
- **Rouge** : agent offline ou `last_seen` > 60s
- **Clic rouge** : appelle `POST https://serpolet.eu/api/webhook/start_print_agent`
- **Loader** : affiche "Démarrage en cours…" pendant 5s puis rafraîchit

---

## 10. Réseau local

| Appareil | IP | Port |
|---|---|---|
| NAS Ugreen DXP480T | `19.80.1.25` | — |
| NAS MAC | `98:6e:e8:2f:b2:45` | WoL port 9 |
| Brother QL-810Wc | `19.80.1.101` | `9100` |
| Home Assistant | `serpolet.eu` | `443` |

---

## 11. Identifiants

| Service | Valeur |
|---|---|
| Supabase URL | `https://ppwvpxjhccpxolcfcyyv.supabase.co` |
| Supabase Anon Key | `eyJhbGci...` (voir projet Lovable) |
| Compte app Stock JP | `jpgrolla@outlook.fr` |
| Webhook démarrage | `start_print_agent` |
| Webhook impression texte | `imprimer_etiquette_stock` |
