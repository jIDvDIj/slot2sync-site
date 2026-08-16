# Configurações

A tela de configurações é um modal React único e extensível, com uma seção por área — cada
seção tem seu próprio hook e comandos dedicados, mas todas compartilham o mesmo `Settings`
carregado uma vez no nível do App (evita estado duplicado entre o cabeçalho e o modal).

## Nome do dispositivo

Obrigatório no momento do login — o botão de conectar (qualquer que seja o provedor escolhido,
ver [Provedores de storage](./provedores-de-storage.md)) só habilita depois de preenchido —
porque identifica a origem de cada versão sincronizada desde o primeiro sync (usado tanto no
snapshot publicado no provedor remoto quanto, por arquivo, em conflitos). Pode ser
renomeado depois nas configurações sem refazer a autenticação: é só um rótulo persistido
localmente e republicado no próximo sync, então não há motivo para exigir OAuth de novo.

## Categorias de sync

Cada emulador tem três categorias — **saves**, **savestates** e **config** — habilitáveis
independentemente (padrão: todas ativas). O caso comum é desativar `config`: resolução de tela
e mapeamento de controle costumam ser específicos da máquina, diferente de saves e savestates,
que quase sempre valem a pena levar para todo dispositivo. O filtro é aplicado na conversão
`EmulatorProfile → SyncTarget` (ver [Sincronização e conflitos](./sincronizacao-e-conflitos.md#nucleo-agnostico-a-emulador-synctarget)) —
o `diff` e a resolução de conflito nunca sabem que uma categoria foi desativada, só recebem
menos categorias para considerar.

## Padrões de exclusão

Por emulador, uma lista de padrões glob (ex.: `*.tmp`, `cache/**`) cujos arquivos ficam fora do
sync nas duas direções. Cada padrão é validado antes de gravar; um padrão inválido rejeita a
mudança inteira em vez de salvar parcialmente.

## Gatilhos automáticos

Cada gatilho automático pode ser ligado/desligado individualmente:

| Gatilho | Direção | Padrão |
| --- | --- | --- |
| `startup` | Sync ao abrir o Slot2Sync | ligado |
| `emulator-start` | Download antes de o emulador abrir | ligado |
| `emulator-stop` | Upload ao fechar o emulador | ligado |

O gate fica **na origem de cada gatilho** (no ponto de inicialização, no consumidor do
watcher), nunca dentro do `SyncEngine` — assim o motor de sync continua "burro" e o botão
"Sincronizar agora" (`manual`) e o sync de despedida ao sair (`shutdown`) nunca são afetados por
essas configurações, mesmo com todos os automáticos desligados. Desligar um gatilho automático
não esconde do usuário que o emulador está rodando: o evento de status é sempre emitido: só a
transferência em si é que fica condicionada ao flag.

## Nível de notificações

| Nível | Notifica |
| --- | --- |
| `all` | Sync concluído (só se houve transferência), erros e emulador detectado |
| `errors_only` | Apenas erros de sync |
| `none` | Nenhuma notificação |

Padrão `all`. Como os gatilhos automáticos disparam com frequência, notificar todo "nada a
sincronizar" no nível `all` seria ruído — por isso a notificação de conclusão só dispara quando
algo de fato foi transferido, independente do nível escolhido. As notificações continuam
disparando do backend (não do frontend) para funcionar mesmo com a janela oculta ou durante o
sync de despedida no encerramento — ver [UI e tray](./ui-e-tray.md).

## Retenção de backup, versões e limites de transferência

Três ajustes adicionais, todos com efeito imediato (sem precisar reiniciar o app):

- **Retenção de backups locais** em dias (0 = manter para sempre); a limpeza roda no próximo
  startup.
- **Máximo de versões arquivadas** por arquivo no histórico pré-download (mínimo 1) — ver
  [Referência — Boundary IPC](../referencia/boundary-ipc.md#backups-e-versionamento).
- **Limites de banda** de upload/download em KB/s (0 = ilimitado) e **intervalo do scan
  periódico** em minutos (0 = desativado) — o cliente do provedor ativo e o timer de scan
  releem o valor a cada operação/ciclo, sem precisar reiniciar.
