// Remplace l'étape "copy" de `cap sync` : sous OneDrive, Capacitor échoue en
// EPERM car il supprime puis recrée le dossier public/ (rmdir bloqué par le
// verrou OneDrive). Ici on vide le contenu sans toucher au dossier lui-même.
// `cap sync` reste nécessaire uniquement après ajout/retrait d'un plugin
// Capacitor (à lancer sur Mac, ou ici en retentant si EPERM).
import { cpSync, rmSync, readdirSync, existsSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")

if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/index.html introuvable — lancer `vite build --mode mobile` d'abord")
  process.exit(1)
}

// cordova.js / cordova_plugins.js sont générés par `cap sync`, on les préserve
const keep = new Set(["cordova.js", "cordova_plugins.js"])
const targets = [
  join(root, "android", "app", "src", "main", "assets", "public"),
  join(root, "ios", "App", "App", "public"),
]

for (const target of targets) {
  if (!existsSync(target)) mkdirSync(target, { recursive: true })
  for (const entry of readdirSync(target)) {
    if (keep.has(entry)) continue
    try {
      rmSync(join(target, entry), { recursive: true, force: true })
    } catch {
      // verrou OneDrive : on écrase par-dessus, au pire un vieux bundle traîne
    }
  }
  cpSync(dist, target, { recursive: true })
  console.log(`dist -> ${target}`)
}
