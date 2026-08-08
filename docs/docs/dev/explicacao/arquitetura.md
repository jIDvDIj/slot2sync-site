# Arquitetura

## Visão geral

RetroSync é um app Tauri v2 com dois lados bem separados:

- **Frontend** (`src/`): React + TypeScript + Vite. Responsável apenas por apresentação
  e interação. Dispara comandos via `invoke()` e reage a eventos via `listen()`.
- **Backend/Core** (`src-tauri/`): Rust. Concentra 100% da lógica de negócio —
  autenticação, sincronização, monitoramento de processos, persistência.

A comunicação acontece exclusivamente pela **boundary do Tauri**: comandos
(`#[tauri::command]` ↔ `invoke`) e eventos (`emit` ↔ `listen`), catalogados em
[Referência — Boundary IPC](../referencia/boundary-ipc.md).

## Diagrama de componentes

```
┌─────────────────────────── RetroSync (Tauri v2) ────────────────────────────┐
│                                                                              │
│  ┌─────────── Frontend (React + TS + Vite) ───────────┐                     │
│  │  componentes de tela ─ hooks (useAuth, useEmulators,│                     │
│  │  useSyncEvents, ...) ─ lib/ipc.ts (invoke tipado)   │                     │
│  └───────┼──────────────────────────┼──────────────────┘                    │
│          │ invoke()                 │ listen()                              │
│  ════════▼══════════ BOUNDARY TAURI ┴══════════════════════════════         │
│          │                          │                                       │
│  ┌───────▼──────────┐      ┌────────┴────────┐                              │
│  │   commands.rs    │      │    events.rs    │   (src-tauri)                │
│  └───────┬──────────┘      └────────▲────────┘                              │
│          │                          │                                       │
│  ┌───────▼──────────────────────────┴──────────────────────────────┐        │
│  │                      AppState (state.rs)                        │        │
│  │                                                                 │        │
│  │   ┌────────┐   ┌─────────────────────┐   ┌──────────────────┐   │        │
│  │   │  auth  │──▶│     SyncEngine      │◀──│  watcher (proc.  │   │        │
│  │   │ OAuth2 │   │       (sync)        │   │  + filesystem)   │   │        │
│  │   │  PKCE  │   │ diff · conflitos ·  │   │  → emulator:     │   │        │
│  │   │secrets │   │ fila offline        │   │    status        │   │        │
│  │   └────────┘   └──────┬──────┬───────┘   └──────────────────┘   │        │
│  │                       │      │                                  │        │
│  │              ┌────────▼─┐  ┌─▼─────────┐   ┌───────────────┐    │        │
│  │              │  drive   │  │  storage  │   │   emulator    │    │        │
│  │              │ reqwest  │  │ rusqlite  │   │  profiles.toml│    │        │
│  │              │ retry/   │  │ manifest, │   │  + discovery  │    │        │
│  │              │ backoff  │  │ fila, cfg │   └───────────────┘    │        │
│  │              └────┬─────┘  └───────────┘                        │        │
│  └───────────────────┼─────────────────────────────────────────────┘        │
│                      │ HTTPS                                                │
└──────────────────────┼───────────────────────────────────────────────────────┘
                       ▼
              Google Drive API v3
        RetroSync/ ─ <Emulador>/ ─ {saves,savestates,config}/ ─ sync_manifest.json
```

## Fluxo de dados de um sync

```
gatilho ──▶ SyncEngine.sync_*()
                │
                ├─ 1. auth.status() ........... conectado? senão aborta
                ├─ 2. storage: lista emuladores configurados (categorias/exclusões aplicadas)
                │
                └─ para cada emulador, para cada categoria habilitada:
                     ├─ 3. drive.ensure_category_folder() .. cria/acha pasta no Drive
                     ├─ 4. drive.list_tree() ............... estado remoto
                     ├─ 5. diff.scan_local_bases() ......... estado local (disco, com hash)
                     ├─ 6. storage.manifest.list() ......... estado do último sync
                     ├─ 7. diff.build_plan() ............... une os 3 + conflict.decide()
                     └─ 8. executa o plano (concorrência limitada):
                          ├─ upload / download via drive (retry/backoff, Batch API quando aplicável)
                          ├─ atualiza manifest (SQLite)
                          ├─ emite sync:progress
                          └─ falha de rede/arquivo em uso → fila offline
                │
                ├─ publica sync_manifest.json no Drive (snapshot de diagnóstico)
                └─ emite sync:completed (SyncSummary)
```

Detalhes do motor de diff/conflito em [Sincronização e conflitos](./sincronizacao-e-conflitos.md).

## Os gatilhos de sincronização

Todos convergem para o mesmo ponto de entrada do `SyncEngine`, o que mantém o comportamento
idêntico independente de quem disparou.

| Gatilho | Origem | Direção |
| --- | --- | --- |
| Iniciar o RetroSync | setup do Tauri | Bidirecional |
| Sync manual | comando `sync_now` / tray | Bidirecional |
| Fechar o RetroSync (Sair da tray) | handler do menu "Sair", antes de `app.exit` | Bidirecional |
| Emulador abriu | process watcher | Drive → Local |
| Emulador fechou | process watcher | Local → Drive |

`manual` e o sync de saída (shutdown) nunca são desativáveis pelo usuário — só os três
automáticos (startup/emulator-start/emulator-stop) têm toggle em
[Configurações](./configuracoes.md#gatilhos-automaticos).

## Módulos do backend

Árvore atual de `src-tauri/src/`:

| Módulo | Responsabilidade |
| --- | --- |
| `commands.rs` | Boundary única: todos os `#[tauri::command]`. Sem lógica de negócio — só orquestra os módulos abaixo. |
| `events.rs` | Nomes dos eventos emitidos ao frontend. |
| `constants.rs` | Nomes de pastas do Drive, chaves de segredo, parâmetros de runtime — zero magic strings no resto do código. |
| `error.rs` | `AppError` unificado, serializado para o frontend como `{ code, message, detail }`. |
| `state.rs` | `AppState` gerenciado pelo Tauri — handles de `auth`, `db`, `storage` e `engine`. |
| `auth/` | OAuth2 + PKCE, troca/renovação de token. |
| `secrets.rs` | Trait `SecretStore` — abstrai onde o refresh token é guardado (keyring no desktop, storage próprio no mobile). Ver [Autenticação](./autenticacao.md). |
| `drive/` | Cliente da API do Google Drive v3: retry/backoff, pastas idempotentes, upload/download, Batch API. |
| `emulator/` | Catálogo declarativo de perfis (`profiles.toml`) e detecção/descoberta automática. Ver [Referência — Perfis de emulador](../referencia/perfis-emulador.md). |
| `storage/` | SQLite: manifest de sync, fila offline, emuladores configurados, conflitos, estatísticas, cache de pastas do Drive. |
| `sync/` | `SyncEngine`: diff, resolução de conflito, orquestração das transferências, abstração de storage local (`LocalStorage`/`FileLoc`, desktop e mobile). |
| `watcher/` | Monitor de processos (abre/fecha emulador) e monitor de filesystem, ambos alimentando os gatilhos automáticos. |
| `platform/` | Código específico de plataforma (`desktop.rs`/`mobile.rs`) atrás de uma interface comum — autostart, seleção de pasta, etc. |
| `games/` | Tradução de serial de jogo para nome legível, usada para agregar `SyncedGame`. |
| `backups.rs` / `versioning.rs` | Backup local antes de sobrescritas e histórico de versões arquivadas por arquivo. |
| `device.rs` | Identidade estável do dispositivo (UUID), usada para atribuir autoria de conflito. |

O frontend (`src/`) segue o mesmo princípio: componentes de tela ficam em `components/`,
lógica de busca/estado por assunto em `hooks/` (um hook por domínio — auth, emuladores,
configurações, eventos de sync, etc.), e toda chamada `invoke` passa por `lib/ipc.ts`.

## Estrutura no Google Drive

Criada automaticamente, de forma idempotente, com escopo `drive.file`:

```
RetroSync/
├── <Emulador>/
│   ├── saves/
│   ├── savestates/
│   └── config/
└── sync_manifest.json   ← snapshot do estado de sync (diagnóstico/bootstrap)
```

> A **fonte de verdade operacional** do manifest é a tabela SQLite local. O
> `sync_manifest.json` é um snapshot exportado a cada sync. Veja
> [Decisões técnicas](../decisoes/decisoes-tecnicas.md#manifest-sqlite-snapshot-json).
