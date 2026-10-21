# Kleinanzeigen Connector

MCP-Server als Cloudflare Worker, über den Claude (claude.ai, Desktop, Mobile) auf kleinanzeigen.de suchen und Anzeigen lesen kann. Kein Login, kein Cookie. Nur lesend: Nachrichten an Verkäufer schickt er nicht.

Bisher lief der Connector als Zusatz im Moodle-Worker (`xuller4000/moodle`, Pfad `/kleinanzeigen/mcp`). Hier steht er für sich, mit eigenem Worker `kleinanzeigen-connector` und eigenem Deploy.

## Tools

| Tool | Zweck |
|---|---|
| `search_listings` | Suche mit Begriff, Ort (PLZ oder Stadt), Umkreis, Preisgrenzen, Sortierung, Angebote/Gesuche, Seite |
| `get_listing` | Details einer Anzeige: Preis, Versand, Ort, Datum, Anbieter, Zustand, Beschreibung und die ersten vier Fotos |

## Einrichtung

### 1. GitHub Secrets

Unter *Settings → Secrets and variables → Actions → New repository secret* in diesem Repo drei Secrets anlegen. Die Cloudflare-Werte sind dieselben wie beim Moodle-Connector.

| Name | Wert |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare-Token mit der Vorlage *Edit Cloudflare Workers* |
| `CLOUDFLARE_ACCOUNT_ID` | Account-ID aus dem Cloudflare-Dashboard |
| `CONNECTOR_SECRET` | zufällige Zeichenkette, mindestens 24 Zeichen, z. B. `openssl rand -hex 24` |

Das `CONNECTOR_SECRET` steckt in der Connector-URL. Ein eigenes Secret statt dem vom Moodle-Connector ist sinnvoll, dann verrät eine geteilte Kleinanzeigen-URL nichts über Moodle.

### 2. Deploy

*Actions → Deploy to Cloudflare → Run workflow*. Danach deployt jeder Push auf `main` automatisch.

### 3. In Claude einbinden

claude.ai → *Einstellungen → Connectors → Custom Connector hinzufügen*:

- Name: `Kleinanzeigen`
- URL: `https://kleinanzeigen-connector.xuller4000.workers.dev/<CONNECTOR_SECRET>/mcp`

OAuth-Felder leer lassen.

## Grenzen

Kleinanzeigen sperrt viele Rechenzentrums-IPs. Von Cloudflare aus hat es bisher funktioniert, garantiert ist das nicht; bei einer Sperre kommt eine klare Fehlermeldung (HTTP 403) statt leerer Ergebnisse. Die Nutzungsbedingungen von Kleinanzeigen untersagen automatisierte Abfragen. Für gelegentliche private Suchen ist das Risiko gering, als Dauer-Suchbot sollte man ihn nicht laufen lassen.

Die Seite wird per HTML geparst. Baut Kleinanzeigen das Layout um, fehlen zuerst Ort und Datum in den Treffern, im schlimmsten Fall kommen keine Treffer mehr.

## Lokal entwickeln

```sh
npm install
echo 'CONNECTOR_SECRET=local-dev-secret-0123456789abcdef' > .dev.vars
npm run dev
```

MCP-Endpunkt dann unter `http://localhost:8787/local-dev-secret-0123456789abcdef/mcp`.
