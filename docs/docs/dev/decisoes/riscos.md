# Riscos Técnicos e Mitigações

Riscos identificados na arquitetura do Slot2Sync e como cada um é tratado. A coluna
**Status** indica se a mitigação já está no código ou ainda é planejada.

| # | Risco | Mitigação | Status |
| --- | --- | --- | --- |
| 1 | Clock skew na resolução de conflito | UTC + tolerância ±2s + par de mtimes do manifest | ✅ |
| 2 | Rate limits do Drive (403/429) | Retry exponencial + jitter; concorrência limitada; diff evita transferência desnecessária | ✅ |
| 3 | Arquivo em uso durante o sync | Checagem de mtime estável antes do upload; `FileBusy` → fila | ✅ |
| 4 | Detecção de processos frágil | Lista de nomes por perfil (catálogo declarativo); matching case-insensitive; debounce | ✅ |
| 5 | Drift na boundary Rust↔TS | Tipos concentrados em 1 arquivo/lado; testes de serialização; tagged unions | ✅ contínuo |
| 6 | Keyring no Linux (Secret Service) | Abstração de token storage (`SecretStore`); fallback possível sem tocar no resto | ✅ estrutural |
| 7 | Uploads grandes (savestates > 50MB) | Resumable upload acima do limite de upload simples | ✅ |
| 8 | Offline-first | Falha de rede → pendência persistida; retry no próximo gatilho | ✅ |
| 9 | Ambiente de dev WSL2 sobre `/mnt/c` | Rodar `tauri dev`/`build` no Windows nativo | ✅ documentado no CLAUDE.md do repo |
| 10 | Saves independentes de dispositivos diferentes sobrescritos no primeiro sync | `device_id` estável (keyring) estampado no Drive; conflito explícito quando a origem é outro dispositivo | ✅ |

## Detalhamento

### 1. Clock skew na resolução de conflitos
`mtime` local e `modifiedTime` do Drive vêm de relógios diferentes; entre duas máquinas o
problema dobra. Tudo é comparado em UTC (epoch ms), com tolerância de ±2s. O par
`(local, drive)` do último sync, gravado no manifest, permite reconhecer "nada mudou" mesmo
com skew maior que a tolerância. Como o sync nunca deleta, o pior caso é sobrescrita de um
save antigo no lado perdedor — recuperável pelo histórico de revisões do Drive.

### 2. Rate limits das APIs de provedor remoto
`remote::http::send_with_retry` (transporte compartilhado por Drive/Dropbox/OneDrive) aplica
backoff exponencial com jitter, tratando 429 e 5xx genericamente; o Drive soma uma regra extra
para 403 *RateLimitExceeded*, específica da API dele. A concorrência de transferências é
limitada. O diff pelo manifest local evita listar/baixar o que não mudou.

### 3. Arquivo em uso no momento do sync
Ao fechar o emulador, ele pode ainda estar gravando o save (ou um savestate grande). Antes
do upload, o engine verifica estabilidade (mtime antes/depois da leitura); se mudou, é
`FileBusy` → entra na fila e é retentado.

### 4. Detecção de processos frágil
Nomes variam entre versões/plataformas do mesmo emulador e emuladores spawnam processos
auxiliares. Mitigado com lista de nomes por perfil (vinda do catálogo declarativo), matching
por igualdade case-insensitive (não `contains`, que daria falso positivo), debounce no
watcher (só emite "parou" após alguns ticks sem o processo) e refresh mínimo de `sysinfo`
para manter o loop leve. Ver [Monitoramento de processos](../explicacao/monitoramento-processos.md).

### 5. Boundary frontend↔Rust com tipos complexos
Drift silencioso quebra em runtime. Tipos concentrados em `src/types/ipc.ts` e structs com
serde camelCase; enums como tagged unions; testes de serialização no Rust. Evolução em
análise: ver [Geração automática da boundary IPC](./geracao-automatica-ipc.md).

### 6. Keyring no Linux
`keyring` depende do Secret Service (GNOME Keyring/KWallet), ausente em setups minimalistas.
A camada `SecretStore` isola o keyring, permitindo fallback futuro sem alterar o resto.
O `device_id` (BUG-004) também mora no keyring e degrada para `None` quando indisponível, sem
abortar o sync.

### 7. Uploads grandes
Savestates de alguns emuladores podem passar de dezenas de MB. Upload simples (multipart)
até um limite pequeno; acima disso, sessão resumable do Drive, que sobrevive a quedas de
conexão.

### 8. Offline-first
Não há API confiável de "estou online". Tratamos falha de rede como sinal: operações que
falham por conectividade entram na fila SQLite; um retry oportunístico roda no próximo
gatilho de sync. A UI exibe a contagem de pendentes no resumo do sync, em vez de tratar
como erro fatal.

### 9. Ambiente de dev (WSL2)
O repositório vive em `/mnt/c` sob WSL, mas o alvo de produção é Windows. Ver as instruções
de ambiente no `CLAUDE.md` da raiz do repo (WSL/`CARGO_TARGET_DIR`, fix do rollup) — não
duplicadas aqui para não divergirem de uma fonte para a outra.

### 10. Saves independentes de dispositivos diferentes no primeiro sync
A resolução por mtime + manifest (risco #1) cobre conflitos a partir do **segundo** sync de um
arquivo. No **primeiro** sync (sem manifest) com o arquivo presente local e no Drive, a regra
conservadora é *Drive-vence-com-backup* — mas isso decidia automaticamente um caso ambíguo
quando os dois saves vêm de **máquinas diferentes**. Mitigado com um `device_id` estável (UUID
no keyring) estampado nos uploads: quando a versão do Drive foi publicada por outro
dispositivo, o primeiro sync vira conflito explícito em vez de sobrescrever.
