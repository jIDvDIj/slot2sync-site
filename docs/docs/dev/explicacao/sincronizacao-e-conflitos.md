# Sincronização e conflitos

Como o Slot2Sync decide, para cada arquivo, se sobe, baixa, ignora ou pede ajuda ao usuário.
É um único motor de decisão — não três mecanismos separados — que se comporta de forma
diferente conforme o que o manifest local já sabe sobre aquele arquivo.

## As três situações possíveis

Para cada `rel_path` de um emulador/categoria, a decisão depende de haver ou não uma entrada
no manifest do último sync bem-sucedido:

1. **Sem manifest (primeiro sync do arquivo)** — o mtime ainda não é evidência confiável de
   "qual versão vale mais": um save recém-criado num dispositivo novo tem mtime de hoje, mas
   pode valer muito menos que um save antigo com 100h de progresso no Drive. Por isso, **o
   Drive sempre vence** quando os dois lados já existem e diferem — mas só depois de o arquivo
   local ser copiado para uma pasta de backup (`<dados do app>/backups/<emulador>/<timestamp>/`).
   O backup roda **antes** do download e, se falhar, o download não acontece — nunca há
   sobrescrita sem rede de segurança.
2. **Com manifest, só um lado mudou** — vence quem mudou (upload se foi o local, download se
   foi o Drive). Comparação por mtime com tolerância de ±2s (absorve granularidade de
   filesystem e pequenos desvios de relógio); o par de mtimes `(local, drive)` registrado no
   manifest é o que permite distinguir "nada mudou" de "mudou de um lado" mesmo quando os
   relógios das duas máquinas divergem.
3. **Com manifest, os dois lados mudaram** — conflito real. O Slot2Sync não escolhe sozinho:
   registra o conflito, **bloqueia o sync daquele emulador** (os demais continuam normais) e
   notifica o usuário. O card do emulador mostra um botão que abre um modal com os dois lados
   (data, tamanho, dispositivo de origem — todo upload marca `appProperties.device` no arquivo
   do Drive, então dá para saber exatamente qual máquina gravou qual versão). O usuário escolhe
   `local` ou `drive`; ao manter o Drive, o local preterido vai para backup antes de ser
   sobrescrito; ao manter o local, a versão do Drive é sobrescrita sem backup do Slot2Sync
   (conta com o histórico de revisões do próprio Drive como rede de segurança).

Sobrescrever sem perguntar é justamente o que as duas primeiras versões do Slot2Sync faziam
por padrão (comparar mtime bruto), e cada uma perdeu saves de verdade — daí o backup automático
no primeiro sync e o bloqueio explícito em conflito real serem tratados como parte do motor de
decisão, não como exceções.

## Identidade estável do dispositivo

Antes de existir um `device_id` estável (gravado no keyring do SO), dois dispositivos que nunca
tinham sincronizado entre si podiam ter seus saves independentes tratados como "Drive vence" no
primeiro sync, quando deveriam gerar conflito explícito. O `device_id` (UUID) é o que permite
`appProperties.device` identificar a origem real de cada versão, mesmo sem manifest prévio.

## Núcleo agnóstico a emulador (`SyncTarget`)

O motor de sync só enxerga `SyncTarget { label, root, categories }` — nunca PPSSPP ou PCSX2. A
conversão `EmulatorProfile → SyncTarget` é uma função de dados fora do engine, e o filtro de
categorias habilitadas (ver [Configurações](./configuracoes.md#categorias-de-sync)) atua nessa
conversão, sem tocar o diff nem a resolução de conflito.

## Estado local: manifest e fila offline

O manifest (`sync_manifest` no SQLite) guarda, por arquivo, o `drive_file_id`, os mtimes dos
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
uma operação que já ficou obsoleta.

## Cliente Drive

Toda chamada à API passa por um transporte único com retry (renova token em 401, aguarda e
retenta em 429/5xx/falha de rede, backoff exponencial com jitter). Uploads pequenos e novos
(sem entrada prévia no manifest) são agrupados via **Batch API** do Drive para reduzir o número
de requisições num sync inicial de coleção grande; o que não é elegível para lote, ou o que o
lote falha, segue pelo caminho de upload individual. Uploads preservam o mtime original;
downloads gravam em arquivo temporário e fazem `rename` atômico, depois aplicam o `modifiedTime`
do Drive como mtime local — um save nunca fica corrompido por uma queda no meio da escrita.
**Não existe operação de delete** — o sync nunca apaga nada no Drive.

Detalhes de schema e API em [Referência — Boundary IPC](../referencia/boundary-ipc.md).
Contexto de por que a resolução é por timestamp (e não por hash de conteúdo desde o início) em
[Decisões técnicas](../decisoes/decisoes-tecnicas.md#resolucao-de-conflito-por-timestamp).
