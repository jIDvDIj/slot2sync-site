# Configurações

A tela de configurações é uma página (`SettingsPage.tsx`), não mais um modal: faz parte da
mesma navegação por barra lateral/abas das demais telas do app (ver [UI e tray](./ui-e-tray.md)).
Internamente ela se divide em quatro abas (`general`, `sync`, `notifications`, `storage`), cada
uma delegada a um componente próprio (`GeneralSettings`, `SyncSettings`, `NotificationSettings`,
`StorageSettings`). Todas compartilham o mesmo `Settings` carregado uma vez no nível do App,
evitando estado duplicado entre a barra superior e a página.

## Interface e Este dispositivo (aba Geral)

A aba Geral reúne duas seções:

- **Interface**: aparência (claro/escuro/sistema) e idioma. Aparência é puramente de
  apresentação e não cruza a boundary IPC (ver [UI e tray](./ui-e-tray.md)); idioma segue o
  mesmo princípio (ver [Internacionalização](./internacionalizacao.md)).
- **Este dispositivo**: nome do dispositivo e, no desktop, o interruptor de início automático
  com o sistema operacional.

Nome do dispositivo é obrigatório no momento do login (o botão de conectar, qualquer que seja o
provedor escolhido, ver [Provedores de storage](./provedores-de-storage.md), só habilita depois
de preenchido), porque identifica a origem de cada versão sincronizada desde o primeiro sync
(usado tanto no snapshot publicado no provedor remoto quanto, por arquivo, em conflitos). Pode
ser renomeado depois nas configurações sem refazer a autenticação: é só um rótulo persistido
localmente e republicado no próximo sync, então não há motivo para exigir OAuth de novo.

## Sincronização automática, verificação periódica e banda (aba Sincronização)

A aba Sincronização reúne três seções:

- **Sincronização automática**: liga/desliga cada gatilho automático individualmente.
- **Verificação periódica**: intervalo do scan em minutos (0 = desativado), oculta no mobile.
- **Banda**: limites de upload/download em KB/s (0 = ilimitado).

| Gatilho | Direção | Padrão |
| --- | --- | --- |
| `startup` | Sync ao abrir o Slot2Sync | ligado |
| `emulator-start` | Download antes de o emulador abrir | ligado |
| `emulator-stop` | Upload ao fechar o emulador | ligado |

Só esses três têm toggle aqui. `manual`, o sync de despedida (`shutdown`) e o watcher de
filesystem (`file-change`, ver [Monitoramento de processos](./monitoramento-processos.md)) não
são desativáveis pelo usuário. O gate dos três configuráveis fica **na origem de cada gatilho**
(no ponto de inicialização, no consumidor do watcher), nunca dentro do `SyncEngine`: assim o
motor de sync continua "burro" e o botão "Sincronizar agora" nunca é afetado por essas
configurações, mesmo com todos os automáticos desligados. Desligar um gatilho automático não
esconde do usuário que o emulador está rodando: o evento de status é sempre emitido, só a
transferência em si é que fica condicionada ao flag.

O cliente do provedor ativo e o timer de scan releem o valor de banda/intervalo a cada
operação/ciclo, sem precisar reiniciar o app.

## Notificações

| Nível | Notifica |
| --- | --- |
| `all` | Sync concluído (só se houve transferência), erros e emulador detectado |
| `errors_only` | Apenas erros de sync |
| `none` | Nenhuma notificação |

Padrão `all`. Como os gatilhos automáticos disparam com frequência, notificar todo "nada a
sincronizar" no nível `all` seria ruído: por isso a notificação de conclusão só dispara quando
algo de fato foi transferido, independente do nível escolhido. As notificações continuam
disparando do backend (não do frontend) para funcionar mesmo com a janela oculta ou durante o
sync de despedida no encerramento (ver [UI e tray](./ui-e-tray.md)).

## Armazenamento remoto, backups e diagnóstico (aba Armazenamento)

A aba Armazenamento reúne três seções:

- **Armazenamento remoto**: mostra o provedor conectado e permite trocá-lo (ver
  [Provedores de storage](./provedores-de-storage.md#trocar-de-provedor)).
- **Backups**: retenção de backups locais em dias (0 = manter para sempre; a limpeza roda no
  próximo startup), máximo de versões arquivadas por arquivo no histórico pré-download (mínimo
  1, ver [Referência: Boundary IPC](../referencia/boundary-ipc.md#backups-e-versionamento)) e
  acesso ao histórico de backups.
- **Diagnóstico**: acesso ao log do app e exportação de um pacote de diagnóstico.

Todos os ajustes numéricos desta página têm efeito imediato, sem precisar reiniciar o app.

## O que saiu daqui: categorias de sync e padrões de exclusão

Categorias de sync (**saves**/**savestates**, habilitáveis independentemente) e os padrões de
exclusão glob (ex.: `*.tmp`, `cache/**`) não ficam mais nas Configurações globais: são
específicos de cada emulador e hoje vivem na própria página do emulador
(`SyncOptionsSection.tsx`), junto com conflitos, pendências e jogos sincronizados. A categoria
**config** existe no schema (`SyncCategories`) mas está permanentemente desativada no backend
(`get_categories`/`set_categories` sempre forçam `false`) e não aparece na UI: resolução de tela
e mapeamento de controle costumavam ser tratados como opcionais por serem específicos da
máquina, mas essa opção foi retirada de circulação. Ver
[Sincronização e conflitos](./sincronizacao-e-conflitos.md#nucleo-agnostico-a-emulador-synctarget).
