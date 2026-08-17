# Referência — Boundary IPC

Catálogo dos comandos (`invoke`), eventos (`emit`) e tipos que cruzam a fronteira
Rust ↔ TypeScript. Fonte de verdade do lado Rust: `src-tauri/src/commands.rs` e
`src-tauri/src/events.rs`. Fonte de verdade do lado TS: `src/types/ipc.ts` (tipos) e
`src/lib/ipc.ts` (wrappers de `invoke`). Sobre por que esse espelhamento é manual e
quando isso deve mudar, veja [Geração automática da boundary IPC](../decisoes/geracao-automatica-ipc.md).

## Comandos

Comandos marcados **desktop** só existem em builds desktop; no mobile o wrapper TS
correspondente não deve ser chamado (não há stub — a ausência é intencional, ao
contrário dos comandos "espelhados com stub" descritos em
[Como adicionar suporte a uma plataforma](../guias/como-adicionar-plataforma.md)).
Comandos marcados **mobile-only** têm uma variante desktop que sempre retorna erro
(mantendo a boundary idêntica entre plataformas).

### Diagnóstico

| Comando | Retorno | Descrição |
| --- | --- | --- |
| `health_check` | `HealthStatus` | Verificação mínima de que a boundary está funcional; inclui `isMobile`, `dbSizeBytes` (via `dbstat`) e `pendingOpsCount`, para a UI sinalizar um banco anormalmente grande ou uma fila offline parada. |
| `get_sync_state` | `SyncStateSnapshot` | Estado corrente do sync (`idle`/`scanning`/`syncing`/`conflict`/`error`) — para a UI renderizar o estado certo ao montar, sem depender de eventos anteriores perdidos. |
| `get_recent_errors` | `Vec<ErrorEntry>` | Histórico dos últimos 100 erros de sync em memória (perdido a cada reinício), mais antigo primeiro. |
| `clear_errors` | `void` | Esvazia o histórico de erros em memória. |
| `export_diagnostics` **desktop** | `String` | Gera um `.zip` de diagnóstico na pasta de Downloads (configurações com segredos redigidos, manifest, conflitos, fila offline, info do app, final do log de hoje). Retorna o caminho gerado. |

### Autenticação e provedor de storage

Ver [Provedores de storage](../explicacao/provedores-de-storage.md) para o que cada provedor
suporta hoje — `connect_dropbox`/`connect_onedrive` existem na boundary e funcionam de ponta a
ponta, mas ficam sem botão acessível na UI até terem credenciais de produção cadastradas.

| Comando | Retorno | Descrição |
| --- | --- | --- |
| `connect_google_drive` | `AuthStatus` | Abre o consentimento OAuth2 do Google e aguarda autorização. Desktop: loopback TCP. Mobile: deep link `slot2sync://oauth`. Emite `auth:status`. |
| `connect_dropbox` | `AuthStatus` | Mesmo fluxo OAuth2+PKCE, para o Dropbox (sem proxy — client público). |
| `connect_onedrive` | `AuthStatus` | Mesmo fluxo OAuth2+PKCE, para o OneDrive/Microsoft Graph (sem proxy — client público). |
| `connect_local_folder` | `AuthStatus` | Valida que o caminho informado existe e é gravável (cria se preciso) e o adota como provedor ativo. Sem OAuth. |
| `get_auth_status` | `AuthStatus` | Status do provedor ativo, sem disparar fluxo interativo (provedores OAuth: consulta o keyring/`SecretStore`; pasta local: confere se o caminho salvo ainda existe). |
| `disconnect_provider` | `AuthStatus` | Desconecta do provedor ativo (qualquer um): remove o refresh token quando OAuth e limpa o cache de IDs de pasta. Emite `auth:status`. |

### Emuladores — detecção e cadastro

| Comando | Retorno | Descrição |
| --- | --- | --- |
| `pick_emulator_folder` **mobile-only** | `String` | Abre o seletor nativo SAF e retorna a URI da árvore concedida. |
| `detect_emulator_mobile` **mobile-only** | `Option<EmulatorProfile>` | Reconhece o emulador numa árvore SAF testando o catálogo de `profiles.toml` via chamadas assíncronas ao plugin nativo. |
| `detect_emulator` | `Option<EmulatorProfile>` | Reconhece o emulador numa pasta do filesystem (desktop) via marcadores declarados em `profiles.toml`. |
| `add_emulator` | `EmulatorProfile` | Detecta e registra o emulador. No mobile usa o caminho assíncrono (URI SAF); no desktop, `detect_emulator`. |
| `add_emulator_manual` | `EmulatorProfile` | Registra um emulador com pastas informadas manualmente (fallback quando a detecção falha). Não sobrescreve um já existente. |
| `discover_emulators` | `Vec<DiscoveredEmulator>` | Varre locais conhecidos e (no Windows) o registro por emuladores do catálogo instalados. Não persiste — é sugestão. |
| `list_emulators` | `Vec<EmulatorProfile>` | Emuladores registrados. |
| `remove_emulator` | `void` | Remove o emulador do sync (manifest, categorias, conflitos, fila, stats). Não apaga nada no Drive nem localmente. |

### Jogos e estatísticas

| Comando | Retorno | Descrição |
| --- | --- | --- |
| `list_synced_games` | `Vec<SyncedGame>` | Jogos sincronizados, agregados do manifest, com serial traduzido para nome quando conhecido. |
| `get_emulator_stats` | `Option<EmulatorStats>` | Contadores acumulados de um emulador. `None` = nunca houve atividade. |
| `list_emulator_stats` | `Vec<EmulatorStats>` | Contadores acumulados de todos os emuladores com atividade. |

### Sincronização e conflitos

| Comando | Retorno | Descrição |
| --- | --- | --- |
| `sync_now` | `SyncSummary` | Sync manual (bidirecional), gatilho `manual`. |
| `get_last_sync` | `Option<LastSync>` | Último sync concluído nesta execução do app. |
| `list_conflicts` | `Vec<Conflict>` | Conflitos pendentes (ambos os lados mudaram desde o último sync). |
| `resolve_conflict` | `void` | Resolve um conflito mantendo `local` ou `remote`; desbloqueia o sync do emulador. |
| `list_pending_ops` | `Vec<PendingOp>` | Fila offline visível: arquivos cuja transferência falhou e será refeita. Prioritárias listadas primeiro. |
| `retry_pending_op` | `void` | Zera tentativas/backoff de uma pendência (inclusive mortas), liberando retry no próximo sync. |
| `bump_pending_op` | `void` | Marca a pendência como prioritária ("mover para frente da fila") e libera o backoff — mesmo efeito imediato de `retry_pending_op`, mais a marca persistida. |

### Categorias e exclusões por emulador

| Comando | Retorno | Descrição |
| --- | --- | --- |
| `get_emulator_categories` | `SyncCategories` | Categorias habilitadas (saves/savestates/config) para um emulador. |
| `set_emulator_categories` | `void` | Define quais categorias sincronizar. |
| `set_exclude_patterns` | `void` | Define padrões glob de exclusão do emulador; valida cada padrão antes de gravar. |

### Configurações globais

| Comando | Retorno | Descrição |
| --- | --- | --- |
| `get_settings` | `Settings` | Configurações do usuário; `autostart` é lido do SO (só desktop) e injetado na resposta. |
| `set_autostart` **desktop** | `void` | Liga/desliga início automático com o sistema (persistido pelo SO). |
| `set_triggers` | `void` | Liga/desliga os gatilhos automáticos de sync (`startup`/`emulatorStart`/`emulatorStop`). O sync manual nunca é afetado. |
| `set_notification_level` | `void` | Define o nível de notificações nativas. |
| `set_device_name` | `void` | Define o nome amigável deste dispositivo (não pode ser vazio). |
| `set_backup_retention_days` | `void` | Retenção dos backups locais em dias (0 = para sempre). Limpeza roda no próximo startup. |
| `set_max_backup_versions` | `void` | Máximo de versões arquivadas por arquivo no histórico (mínimo 1). |
| `set_bandwidth_limits` | `void` | Limites de upload/download em KB/s (0 = ilimitado); aplicados na próxima operação. |
| `set_scan_interval_minutes` | `void` | Intervalo do scan periódico em minutos (0 = desativado); o timer relê a cada ciclo. |

### Backups e versionamento

| Comando | Retorno | Descrição |
| --- | --- | --- |
| `open_backup_folder` **desktop** | `void` | Abre a pasta de backups locais no gerenciador de arquivos do SO (cria se não existir). |
| `reveal_backup_path` **desktop** | `void` | Mostra um arquivo de backup específico no gerenciador de arquivos; recusa caminhos fora da árvore de backups. |
| `list_file_versions` | `Vec<FileVersion>` | Versões arquivadas de um arquivo no histórico pré-download, mais recentes primeiro. |
| `restore_version` | `void` | Restaura uma versão arquivada por cima do arquivo atual. O estado atual é arquivado antes (nada se perde); mtime atualizado para o próximo sync reenviar ao Drive. |
| `list_backups` | `Vec<BackupEntry>` | Histórico de backups criados antes de sobrescritas (primeiro sync / resolução de conflito). Só leitura. |

### Avisos dispensáveis

| Comando | Retorno | Descrição |
| --- | --- | --- |
| `list_dismissed_notices` | `Vec<String>` | IDs de banners informativos que o usuário já dispensou. |
| `dismiss_notice` | `void` | Dispensa um banner de forma persistente e idempotente. |

## Eventos

| Evento | Payload | Quando dispara |
| --- | --- | --- |
| `sync:started` | `SyncStarted` | Início de um sync (qualquer gatilho). |
| `sync:progress` | `SyncProgress` | Retrato consolidado do progresso da categoria em andamento, a cada 500ms (não mais por arquivo) — mais uma emissão final garantida com `completed == total`. |
| `sync:completed` | `SyncSummary` | Fim de um sync bem-sucedido. |
| `sync:error` | `SyncErrorEvent` | Erro que interrompeu o sync. `emulator: null` = erro geral, não específico de um emulador. |
| `sync:conflict` | `Conflict` | Conflito detectado (ambos os lados mudaram). |
| `sync:state-changed` | `SyncStateChangedEvent` | Transição do `SyncState` do motor. `Conflict`/`Error` são momentâneos — o `sync_all` segue para os demais emuladores e volta a `idle` só ao fim da leva. |
| `auth:status` | `AuthStatus` | Após `connect_google_drive`/`connect_dropbox`/`connect_onedrive`/`disconnect_provider`. |
| `emulator:status` | `EmulatorStatusEvent` | Emulador monitorado abriu ou fechou (process watcher). |

## Tipos compartilhados

Ver `src/types/ipc.ts` para a forma exata de cada interface (é o espelho TS oficial,
gerado manualmente a partir das structs Rust com `#[serde(rename_all = "camelCase")]`).
Tipos principais: `HealthStatus`, `AuthStatus`, `ProviderKind` (qual provedor de storage está
ativo — ver [Provedores de storage](../explicacao/provedores-de-storage.md)), `Settings` +
`TriggerSettings` + `NotificationLevel`, `EmulatorProfile` + `DiscoveredEmulator` +
`DiscoverySource`, `SyncCategories`, `SyncedGame`, `EmulatorStats`, `SyncSummary` +
`SyncProgress` + `SyncStarted` + `SyncDirection` + `LastSync`, `Conflict` +
`ConflictResolution`, `PendingOp` (inclui `priority`), `FileVersion`, `BackupEntry`,
`SyncStateSnapshot` + `SyncStateChangedEvent` + `SyncStateKind`, `ErrorEntry`.

## Erros

Todo comando que falha rejeita com o shape `AppErrorPayload { code, message, detail }`.
`code` é um enum fechado — ver a lista completa em `src/types/ipc.ts` (`AppErrorPayload.code`)
e sua origem em `src-tauri/src/error.rs::AppError`. Adicionar uma variante exige
atualizar os dois lados; o frontend localiza a mensagem pelo `code` e anexa o `detail`
(texto técnico sem prefixo — caminho, nome, mensagem de lib).

## Manutenção do contrato

O espelhamento é manual: toda mudança numa struct/enum/comando do lado Rust precisa
da edição correspondente em `src/types/ipc.ts` e `src/lib/ipc.ts`. Não há checagem
automática de drift entre os dois lados — a mitigação atual são testes de
serialização do lado Rust. Ver [Geração automática da boundary IPC](../decisoes/geracao-automatica-ipc.md)
para a decisão em aberto de adotar geração automática (`ts-rs`/`tauri-specta`).
