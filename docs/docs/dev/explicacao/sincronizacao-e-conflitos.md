# Sincronização e conflitos

Como o Slot2Sync decide, para cada arquivo, se sobe, baixa, ignora ou pede ajuda ao usuário.
É um único motor de decisão — não três mecanismos separados — que se comporta de forma
diferente conforme o que o manifest local já sabe sobre aquele arquivo.

## As três situações possíveis

Para cada `rel_path` de um emulador/categoria, a decisão depende de haver ou não uma entrada
no manifest do último sync bem-sucedido:

1. **Sem manifest (primeiro sync do arquivo)** — o mtime ainda não é evidência confiável de
   "qual versão vale mais": um save recém-criado num dispositivo novo tem mtime de hoje, mas
   pode valer muito menos que um save antigo com 100h de progresso no provedor remoto. Por
   isso, **o remoto sempre vence** quando os dois lados já existem e diferem — mas só depois
   de o arquivo local ser copiado para uma pasta de backup
   (`<dados do app>/backups/<emulador>/<timestamp>/`). O backup roda **antes** do download e,
   se falhar, o download não acontece — nunca há sobrescrita sem rede de segurança.
2. **Com manifest, só um lado mudou** — vence quem mudou (upload se foi o local, download se
   foi o remoto). Comparação por mtime com tolerância de ±2s (absorve granularidade de
   filesystem e pequenos desvios de relógio); o par de mtimes `(local, remoto)` registrado no
   manifest é o que permite distinguir "nada mudou" de "mudou de um lado" mesmo quando os
   relógios das duas máquinas divergem.
3. **Com manifest, os dois lados mudaram** — conflito real. O Slot2Sync não escolhe sozinho:
   registra o conflito, **bloqueia o sync daquele emulador** (os demais continuam normais) e
   notifica o usuário. O card do emulador mostra um botão que abre um modal com os dois lados
   (data, tamanho, dispositivo de origem — todo upload marca a origem no arquivo remoto, então
   dá para saber exatamente qual máquina gravou qual versão; no Drive isso é uma
   `appProperties` nativa, nos demais provedores um índice-sidecar — ver
   [Provedores de storage](./provedores-de-storage.md#atribuicao-de-dispositivo-sem-appproperties)).
   O usuário escolhe `local` ou `remote`; ao manter o remoto, o local preterido vai para backup
   antes de ser sobrescrito; ao manter o local, a versão remota é sobrescrita sem backup do
   Slot2Sync (conta com o histórico de revisões do próprio provedor, quando ele tiver um, como
   rede de segurança).

Sobrescrever sem perguntar é justamente o que as duas primeiras versões do Slot2Sync faziam
por padrão (comparar mtime bruto), e cada uma perdeu saves de verdade — daí o backup automático
no primeiro sync e o bloqueio explícito em conflito real serem tratados como parte do motor de
decisão, não como exceções.

## Identidade estável do dispositivo

Antes de existir um `device_id` estável (gravado no keyring do SO), dois dispositivos que nunca
tinham sincronizado entre si podiam ter seus saves independentes tratados como "o remoto vence"
no primeiro sync, quando deveriam gerar conflito explícito. O `device_id` (UUID) é o que
permite identificar a origem real de cada versão mesmo sem manifest prévio — gravado como
`appProperties.deviceId` no Drive, ou na entrada correspondente do índice-sidecar nos demais
provedores.

## Núcleo agnóstico a emulador (`SyncTarget`)

O motor de sync só enxerga `SyncTarget { label, root, categories }` — nunca PPSSPP ou PCSX2. A
conversão `EmulatorProfile → SyncTarget` é uma função de dados fora do engine, e o filtro de
categorias habilitadas (ver [Configurações](./configuracoes.md#categorias-de-sync)) atua nessa
conversão, sem tocar o diff nem a resolução de conflito.

## Estado local: manifest e fila offline

O manifest (`sync_manifest` no SQLite) guarda, por arquivo, o `remote_file_id`, os mtimes dos
dois lados no último sync, o tamanho e um **hash SHA-256 do conteúdo**. O hash serve de
pré-filtro: se o mtime local mudou mas o hash bate com o do manifest, o arquivo é só
"reancorado" (mtime atualizado no manifest) sem re-upload — evita transferir de novo um arquivo
que só teve o timestamp tocado sem mudança real de conteúdo.

Quando uma transferência falha (rede fora do ar, ou o arquivo está sendo escrito pelo emulador
no momento — detectado relendo o mtime antes/depois da leitura), a pendência vai para a fila
offline (`pending_ops`) com backoff exponencial (30s × 2^tentativas, teto de 1h) e é
abandonada como "morta" depois de várias tentativas — só a ação "tentar novamente" da UI a
reativa. A fila guarda **intenção, não um replay de comando**: o próximo sync sempre re-detecta
a diferença pelo diff (a fonte da verdade) e refaz a operação, o que a torna imune a reexecutar
uma operação que já ficou obsoleta. A UI também pode marcar uma pendência como prioritária
("mover para frente da fila"): zera o backoff e a lista primeiro, mas quem decide se ela
realmente sobe/desce continua sendo o diff do próximo sync, não a fila.

Um caso específico de falha tem tratamento à parte: se o upload esbarra em
`PermissionDenied`/`WouldBlock` porque o emulador segura o arquivo aberto (trava exclusiva do
Windows, mais comum ali que em Unix), a entrada não entra no backoff exponencial — vira a flag
`inaccessible` no próprio manifest. O motivo é que o watcher de filesystem já vai disparar um
resync assim que o emulador soltar o arquivo, então esperar em fila com backoff é redundante e
só atrasa a recuperação.

`sync_manifest` também carrega um bitmask `flags` (conflito/pendência/…) como índice
secundário best-effort para consulta rápida — as tabelas `sync_conflicts`/`pending_ops`
continuam sendo a fonte de verdade; a flag some silenciosamente se ainda não existir uma linha
de manifest para aquele arquivo.

## Cliente remoto

Toda chamada de um provedor OAuth (Drive/Dropbox/OneDrive) passa por um transporte único com
retry compartilhado em `remote::http` (renova token em 401, aguarda e retenta em 429/5xx/falha
de rede, backoff exponencial com jitter). No Drive, uploads pequenos e novos (sem entrada
prévia no manifest) são agrupados via **Batch API** para reduzir o número de requisições num
sync inicial de coleção grande — otimização específica do Drive; os demais provedores sobem
arquivo a arquivo. O que não é elegível para lote, ou o que o lote falha, segue pelo caminho
de upload individual. Uploads preservam o mtime original; downloads gravam em arquivo
temporário e fazem `rename` atômico, depois aplicam o mtime remoto como mtime local — um save
nunca fica corrompido por uma queda no meio da escrita. **Não existe operação de delete** — o
sync nunca apaga nada no provedor remoto.

A listagem recursiva de uma pasta de categoria (`list_tree`) fica em cache por 30s no
`DriveClient`, invalidado por inteiro após qualquer upload/rename — evita relistar a mesma
pasta quando dois gatilhos de sync (ex.: watcher logo depois de um sync manual) caem dentro da
mesma janela sem nada ter mudado.

## Concorrência: dois tetos independentes

As transferências de uma categoria rodam concorrentes, mas sob dois limites que não competem
entre si: um semáforo ponderado por **bytes em trânsito** (64 MiB no total; um savestate de
500 MB reserva proporcionalmente mais do que um save de 1 KB, em vez de ocupar a mesma "vaga"
de contagem) e dois semáforos separados para **chamadas de rede** (4 simultâneas) e **I/O de
disco local** (2 simultâneas) — em HD mecânico, escrita paralela demais vira thrashing de
cabeça de leitura/escrita, então o teto de disco é deliberadamente mais baixo que o de rede. O
cálculo de hash SHA-256 do pré-filtro de mtime roda em paralelo (rayon) quando várias entradas
tocadas precisam ser rehasheadas na mesma categoria.

## Robustez da escrita local

`write_atomic` (grava num arquivo temporário e faz `rename` sobre o destino) tem camadas de
proteção acumuladas: `fsync` do conteúdo antes do rename e do diretório-pai depois (Unix,
best-effort) para sobreviver a uma queda bem no meio da operação; preserva as permissões do
arquivo substituído em vez de cair no padrão do processo; recusa escrever se o destino ou sua
pasta-pai imediata já forem um symlink (protege contra um link plantado ali redirecionando a
escrita para fora da árvore esperada — não sobe além do pai imediato, para não quebrar quem
symlinka a raiz do emulador inteira de propósito); no Windows, prefixa caminhos absolutos com
`\\?\` (`\\?\UNC\` em compartilhamentos de rede) para não estourar o `MAX_PATH` de 260
caracteres em coleções profundamente aninhadas, e recusa sobrescrever um arquivo cujo nome
existente difere só em maiúsculas/minúsculas do que está chegando (NTFS é case-preserving mas
case-insensitive — dois arquivos "distintos" pro motor de sync colidiriam ali).

O nome do arquivo temporário segue a convenção de cada SO (`~slot2sync~` no Windows, `.` inicial
no Unix) em vez de um sufixo único — nomes muito longos viram um hash curto do nome original
para não estourar limite de caminho por conta própria. No início de cada sync, uma varredura
best-effort remove temporários órfãos com mais de 24h (resto de um download interrompido por
uma queda do app). Se a raiz do emulador não existe mais como pasta (drive removível
desconectado, pasta de rede fora do ar), o scan falha cedo com um erro dedicado em vez de
tratar a ausência como "tudo foi apagado localmente" e tentar rebaixar a coleção inteira de
volta para dentro do que seria o ponto de montagem.

## Estado observável: `SyncState` e progresso

Além dos eventos discretos (`sync:started`/`progress`/`completed`/`conflict`/`error`), o motor
mantém um `SyncState` corrente (`Idle`/`Scanning`/`Syncing`/`Conflict`/`Error`) e emite
`sync:state-changed` a cada transição; `get_sync_state` expõe um retrato para a UI renderizar o
estado certo ao montar, sem depender de ter visto os eventos anteriores (reconectar no meio de
um sync). `Conflict`/`Error` são transições momentâneas — um conflito ou falha num emulador não
trava o `sync_all`, que segue para os demais e volta a `Idle` só quando a leva inteira termina.
Os últimos 100 erros de sync ficam num histórico em memória (`get_recent_errors`), perdido a
cada reinício.

O progresso por categoria não emite mais um evento por arquivo — um `tokio::time::interval` de
500ms lê os contadores atômicos e emite um retrato consolidado só quando o valor mudou, com uma
emissão final garantida (`completed == total`) ao fim das transferências. Evita inundar o
frontend num sync de centenas de arquivos.

Detalhes de schema e API em [Referência — Boundary IPC](../referencia/boundary-ipc.md).
Contexto de por que a resolução é por timestamp (e não por hash de conteúdo desde o início) em
[Decisões técnicas](../decisoes/decisoes-tecnicas.md#resolucao-de-conflito-por-timestamp).
