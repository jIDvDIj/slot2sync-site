# Monitoramento de processos

Como o Slot2Sync detecta que um emulador abriu ou fechou, e por que isso dispara sync
direcionado: abrir → Drive → Local (saves frescos antes do jogo carregar); fechar →
Local → Drive (sobe os saves da sessão).

## Arquitetura: produtor → `mpsc` → consumidor

Duas tasks assíncronas ligadas por um canal `tokio::sync::mpsc`:

- **Produtor**: loop de polling periódico. A cada tick, lê os emuladores configurados do
  SQLite, atualiza a lista de processos via `sysinfo` e publica as transições no canal.
- **Consumidor**: para cada transição, emite `emulator:status` ao frontend e dispara o
  sync direcionado do emulador correspondente.

Desacoplar os dois mantém o polling leve e nunca bloqueado por um sync em andamento (o
engine já serializa execuções com seu próprio lock).

## `sysinfo` dentro de `spawn_blocking`

`refresh_processes` é síncrono. O `System` e a máquina de estados viajam para dentro de
um `spawn_blocking` a cada poll e voltam com os eventos, para o runtime async nunca
travar. O refresh coleta só o nome do processo (sem memória/CPU/disco), mantendo o tick
barato.

O matching é por **igualdade exata case-insensitive** entre o nome do processo e os
nomes de processo conhecidos do perfil (hoje vêm do catálogo declarativo de emuladores,
não de código por emulador): igualdade, não `contains`, para evitar falso positivo.

## Debounce: abertura imediata, fechamento com atraso

A máquina de estados que decide as transições é **pura e sem `sysinfo`**: recebe "quais
emuladores estão presentes neste tick" e devolve as transições. Por isso é inteiramente
testável sem o SO.

- **Abertura** emite o evento de "iniciado" **imediatamente**: baixar os saves do Drive
  deve acontecer o quanto antes, antes do jogo ler os arquivos.
- **Fechamento** só emite "parado" depois de alguns ticks consecutivos sem o processo.
  Protege contra flapping do `sysinfo` ou processos auxiliares que o emulador spawna.
- Um emulador **removido** da configuração é esquecido em silêncio (sem evento de
  parada): não queremos disparar sync ao desconfigurar.

Ver [Decisões técnicas](../decisoes/decisoes-tecnicas.md#process-watcher-abertura-imediata-fechamento-com-debounce).

## Lista de monitorados dinâmica

O produtor relê a lista de emuladores do SQLite a cada tick, então adicionar ou remover
um emulador passa a valer sem reiniciar nada. Perfis sem nomes de processo conhecidos são
ignorados pelo watcher.

## Direção do sync por gatilho

| Transição | Direção | Trigger |
| --- | --- | --- |
| Emulador iniciado | Drive → Local | `emulator-start` |
| Emulador parado | Local → Drive | `emulator-stop` |

## Evento ao frontend

`emulator:status` com payload `{ emulator, running }`, ver
[Referência: Boundary IPC](../referencia/boundary-ipc.md#eventos).

## Watcher de filesystem complementar

Além do watcher de processos, existe um watcher de filesystem (`watcher/fs_watcher.rs`, gatilho
`file-change`) que reage a escritas nas pastas de saves/savestates sem esperar o emulador
fechar, útil em sessões longas. Usa eventos nativos da crate `notify`
(`ReadDirectoryChangesW` no Windows, `inotify` no Linux, `FSEvents` no macOS) em vez de
polling, e dispara sempre um sync `Local → Drive` (o próprio arquivo mudou localmente).

Três proteções específicas desse watcher:

- **Debounce agregador**: cada evento reinicia a janela de espera por emulador; o sync só
  dispara alguns segundos após o *último* evento, agrupando rajadas de escrita (savestates
  gravados em sequência, por exemplo) num único sync em vez de um por arquivo.
- **Anti-loop**: eventos em arquivos que o próprio sync acabou de baixar
  (`SyncEngine::is_recent_download`) e em temporários de escrita atômica são ignorados, para
  não reagir à própria escrita que o motor de sync fez.
- **Nunca com o jogo aberto**: o disparo é adiado enquanto qualquer emulador estiver rodando;
  o gatilho `emulator-stop` do watcher de processos já cobre o fechamento.

Diferente dos gatilhos de `emulator-start`/`emulator-stop`, `file-change` não tem toggle nas
Configurações: está sempre ativo. Ver [Configurações](./configuracoes.md#sincronizacao-automatica-verificacao-periodica-e-banda-aba-sincronizacao)
e [Arquitetura](./arquitetura.md#os-gatilhos-de-sincronizacao).

## Como testar manualmente

Com o Drive conectado e um emulador cadastrado:

1. Abra o emulador → o log mostra a transição detectada e dispara um sync Drive → Local;
2. Jogue, salve e feche o emulador → após alguns segundos, um sync Local → Drive sobe os
   saves da sessão;
3. Acompanhe em `%LOCALAPPDATA%\com.slot2sync.app\logs\slot2sync.log`.

> O caminho real do `sysinfo` não é exercitável no WSL (sem GUI nem emuladores), mas toda
> a lógica de decisão, a parte sujeita a bug, está coberta por testes automatizados.
