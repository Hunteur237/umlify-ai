# ⬡ UMLify AI

Génère des diagrammes UML automatiquement à partir de texte ou de code source.

## Stack
- React 18 + Vite
- Claude AI (Anthropic)
- PlantUML Public Server

## Démarrage rapide

```bash
npm install
npm run dev
```

## Variables d'environnement

Crée un fichier `.env.local` :

```
VITE_CLAUDE_API_KEY=sk-ant-api03-...
```

> Sans clé, l'app fonctionne en mode démo avec des exemples préchargés.

## Déploiement Vercel

```bash
vercel --prod
```
