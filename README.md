# retrosync-site

Site institucional e documentação do [RetroSync](https://github.com/jIDvDIj/retro-sync).


## Estrutura

- `landing/` — página de apresentação do app (Astro). Publicada em `/`.
- `docs/` — documentação de usuário final (MkDocs + Material). Publicada em `/docs/`.

## Rodar localmente

### Landing

```bash
cd landing
npm install
npm run dev       # http://localhost:4321
npm run build     # gera landing/dist
```

### Docs

```bash
cd docs
uv sync
uv run mkdocs serve   # http://localhost:8000
uv run mkdocs build   # gera docs/site
```

## Deploy

`push` na branch `main` dispara `.github/workflows/pages.yml`, que builda os dois sites,
combina os artefatos (`docs/site` dentro de `landing/dist/docs`) e publica no GitHub Pages.

## Licença

GPL-3.0-or-later — mesma licença do [RetroSync](https://github.com/jIDvDIj/retro-sync).
