# Armazenamento local

Como o SQLite local é configurado, versionado e escrito — a parte de "banco de dados" do
Slot2Sync, separada da lógica de decisão que mora em
[Sincronização e conflitos](./sincronizacao-e-conflitos.md).

## Conexão e pragmas

A conexão é única por processo, protegida por `Arc<Mutex>`, e todo acesso passa por
`Db::with`, que roda em `spawn_blocking` para não bloquear o runtime async (`rusqlite` é
síncrono). Na abertura, a conexão liga `journal_mode=WAL` (leituras não bloqueiam escrita em
andamento), `foreign_keys=ON`, `synchronous=NORMAL` (seguro sob WAL — só faz `fsync` no
checkpoint — e mais rápido que `FULL`) e `auto_vacuum=INCREMENTAL` para bancos novos (o SQLite
não aplica isso retroativamente a um banco existente sem um `VACUUM` completo, então o app não
força um).

As consultas executadas em todo ciclo de sync (`sync_manifest`, `pending_ops`, `emulators`) usam
`prepare_cached` em vez de `prepare` — evita reanalisar o mesmo SQL a cada chamada.

## Duas versões de schema

`PRAGMA user_version` versiona o **schema físico**: cada migração incremental
(`SCHEMA_V1..V14` em `storage::db`) cria uma tabela ou adiciona uma coluna. Existe uma segunda
tabela, `schema_version(component, version)`, para versionar o **formato lógico dos dados** por
componente (`settings`, `sync_manifest`) — chaves renomeadas, encoding de valor mudado — sem
precisar de uma coluna física nova. Se o banco foi aberto por uma build mais nova do app (usuário
voltou para uma versão antiga), o componente correspondente só loga um aviso e não é tocado, em
vez de arriscar corromper dados de um formato que a build atual não entende.

Metadados internos que não são preferência do usuário (carimbo da última manutenção, futuras
flags operacionais) vivem numa tabela chave-valor própria, `internal_kv` — deliberadamente
separada de `app_settings`, que é só o que a tela de configurações edita.

## Manutenção periódica

No sync de despedida (gatilho `shutdown`, antes do `app.exit`), o app roda `ANALYZE`,
`PRAGMA optimize`, `PRAGMA incremental_vacuum` e `PRAGMA wal_checkpoint(TRUNCATE)` — mas só se
já fizeram mais de 7 dias desde a última vez (carimbo em `internal_kv`). `ANALYZE` mantém as
estatísticas do query planner corretas conforme `sync_manifest` cresce; o checkpoint evita que o
arquivo WAL cresça indefinidamente entre uma manutenção e outra.

`HealthStatus` (consultado pelo frontend) expõe `dbSizeBytes` — somado via a tabela virtual
`dbstat` (`SELECT SUM(pgsize) FROM dbstat`), que já reflete páginas alocadas sem precisar
abrir/`stat` o arquivo `.sqlite` no disco — e `pendingOpsCount`, para a UI sinalizar um banco
anormalmente grande ou uma fila offline parada há muito tempo.

## Escrita em lote por categoria

Cada arquivo transferido com sucesso gera uma entrada de manifest, mas a escrita não acontece
uma por arquivo: `do_upload`/`do_download` só **constroem** a entrada e devolvem para quem
chamou; o motor de sync acumula as entradas de uma categoria inteira (upload em lote, downloads,
uploads individuais) e grava todas numa única transação (`manifest::upsert_batch`) depois que o
`buffer_unordered` da categoria termina. Um sync de 200 arquivos vira 1 commit no SQLite, não
200. O mesmo vale para o reancoramento de mtime (arquivos cujo conteúdo não mudou, só o
timestamp) — já chegava como uma lista pronta antes de ser gravado, então passou a usar a mesma
transação em lote.

## Flags como índice secundário

`sync_manifest` tem uma coluna `flags` (bitmask: `FLAG_CONFLICT`, `FLAG_PENDING` — mais duas
reservadas, `FLAG_IGNORED` e `FLAG_HASH_MISMATCH`, para uso futuro) que permite filtrar
`WHERE flags & 1 != 0` em vez de fazer join com `sync_conflicts`/`pending_ops`. É
deliberadamente um índice **best-effort**, não a fonte de verdade: essas duas tabelas continuam
sendo a autoridade sobre conflitos e pendências (guardam dados que um bitmask não cabe —
tentativas, backoff, dispositivo de origem, tamanhos dos dois lados) e a flag some silenciosamente
quando ainda não existe uma linha de manifest para o arquivo (ex.: conflito detectado num arquivo
que nunca foi sincronizado antes). `upsert`/`upsert_batch` zeram `flags` a cada sync bem-sucedido
do arquivo — depois de sincronizar, nenhuma flag anterior ainda vale.
