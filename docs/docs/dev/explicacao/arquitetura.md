# Arquitetura

## Visão geral

Slot2Sync é um app Tauri v2 com dois lados bem separados:

- **Frontend** (`src/`): React + TypeScript + Vite. Responsável apenas por apresentação
  e interação. Dispara comandos via `invoke()` e reage a eventos via `listen()`.
- **Backend/Core** (`src-tauri/`): Rust. Concentra 100% da lógica de negócio —
  autenticação, sincronização, monitoramento de processos, persistência.

A comunicação acontece exclusivamente pela **boundary do Tauri**: comandos
(`#[tauri::command]` ↔ `invoke`) e eventos (`emit` ↔ `listen`), catalogados em
[Referência — Boundary IPC](../referencia/boundary-ipc.md).

## Diagrama de componentes

```
┌─────────────────────────── Slot2Sync (Tauri v2) ────────────────────────────┐
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
│  │              ┌────────▼─────────┐  ┌─▼─────────┐   ┌───────────────┐   │        │
│  │              │ remote::Remote-  │  │  storage  │   │   emulator    │   │        │
│  │              │ Provider (trait) │  │ rusqlite  │   │  profiles.toml│   │        │
│  │              │ drive/dropbox/   │  │ manifest, │   │  + discovery  │   │        │
│  │              │ onedrive/folder  │  │ fila, cfg │   └───────────────┘   │        │
│  │              └────┬─────────────┘  └───────────┘                       │        │
│  └───────────────────┼─────────────────────────────────────────────┘        │
│                      │ HTTPS (ou I/O local, no provedor de pasta)            │
└──────────────────────┼───────────────────────────────────────────────────────┘
                       ▼
     Google Drive API v3 / Dropbox API v2 / Microsoft Graph / pasta local
        Slot2Sync/ ─ <Emulador>/ ─ {saves,savestates,config}/ ─ sync_manifest.json
```

O `SyncEngine` nunca fala diretamente com uma API de nuvem — só com o trait
`remote::RemoteProvider`, implementado por cada um dos quatro provedores concretos. Detalhes
em [Provedores de storage](./provedores-de-storage.md).

## Fluxo de dados de um sync

```
gatilho ──▶ SyncEngine.sync_*()
                │
                ├─ 1. auth.status() ........... conectado? senão aborta
                ├─ 2. storage: lista emuladores configurados (categorias/exclusões aplicadas)
                │
                └─ para cada emulador, para cada categoria habilitada:
                     ├─ 3. remote.ensure_category_folder() . cria/acha pasta no provedor ativo
                     ├─ 4. remote.list_tree() ............... estado remoto
                     ├─ 5. diff.scan_local_bases() ......... estado local (disco, com hash)
                     ├─ 6. storage.manifest.list() ......... estado do último sync
                     ├─ 7. diff.build_plan() ............... une os 3 + conflict.decide()
                     └─ 8. executa o plano (concorrência limitada):
                          ├─ upload / download via remote (retry/backoff, Batch API no Drive quando aplicável)
                          ├─ atualiza manifest (SQLite)
                          ├─ emite sync:progress
                          └─ falha de rede/arquivo em uso → fila offline
                │
                ├─ publica sync_manifest.json no provedor ativo (snapshot de diagnóstico)
                └─ emite sync:completed (SyncSummary)
```

Detalhes do motor de diff/conflito em [Sincronização e conflitos](./sincronizacao-e-conflitos.md).

## Os gatilhos de sincronização

Todos convergem para o mesmo ponto de entrada do `SyncEngine`, o que mantém o comportamento
idêntico independente de quem disparou.

| Gatilho | Origem | Direção |
| --- | --- | --- |
| Iniciar o Slot2Sync | setup do Tauri | Bidirecional |
| Sync manual | comando `sync_now` / tray | Bidirecional |
| Fechar o Slot2Sync (Sair da tray) | handler do menu "Sair", antes de `app.exit` | Bidirecional |
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
| `auth/` | OAuth2 + PKCE parametrizado por provedor, troca/renovação de token. |
| `secrets.rs` | Trait `SecretStore` — abstrai onde o refresh token é guardado (keyring no desktop, storage próprio no mobile). Ver [Autenticação](./autenticacao.md). |
| `remote/` | Trait `RemoteProvider` (a única porta que o `SyncEngine` conhece), tipos genéricos e transporte HTTP com retry/backoff compartilhado pelos provedores OAuth. Ver [Provedores de storage](./provedores-de-storage.md). |
| `drive/`, `dropbox/`, `onedrive/`, `folder/` | Implementações concretas de `RemoteProvider`: API do Google Drive v3, API v2 do Dropbox, Microsoft Graph, e leitura/escrita direta numa pasta local/de rede. |
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

## Estrutura remota

Criada automaticamente, de forma idempotente, com escopo restrito ao próprio app (`drive.file`
no Drive; App Folder no Dropbox; pasta especial `approot` no OneDrive) — o mesmo layout lógico
vale para os quatro provedores, só muda como cada um materializa "pasta":

```
Slot2Sync/
├── <Emulador>/
│   ├── saves/
│   ├── savestates/
│   └── config/
└── sync_manifest.json   ← snapshot do estado de sync (diagnóstico/bootstrap)
```

No provedor de pasta local/de rede, isso é literalmente essa árvore de diretórios dentro do
caminho escolhido pelo usuário — sem API nenhuma envolvida.

> A **fonte de verdade operacional** do manifest é a tabela SQLite local. O
> `sync_manifest.json` é um snapshot exportado a cada sync. Veja
> [Decisões técnicas](../decisoes/decisoes-tecnicas.md#manifest-sqlite-snapshot-json).
