# Sincronização

## Gatilhos automáticos

Cada gatilho pode ser ligado ou desligado individualmente em **Configurações →
Sincronização**:

| Gatilho | Quando dispara | Padrão |
| --- | --- | --- |
| Quando o Slot2Sync abrir | sincroniza tudo assim que o app inicia | ligado |
| Antes de um emulador abrir | baixa os saves mais recentes antes do jogo começar | ligado |
| Depois que um emulador fechar | envia o progresso novo | ligado |

Se você desligar todos os gatilhos automáticos, o botão **Sincronizar agora** continua
funcionando normalmente, assim como a sincronização de despedida disparada pelo item
**Sair** da bandeja.

Em Configurações também dá para ligar uma **verificação periódica** (roda uma
sincronização completa em segundo plano, nunca com um emulador aberto) e definir um
limite de banda para envio e download.

## Categorias

Na página de cada emulador, você escolhe quais categorias sincronizar,
individualmente:

- **saves**: os arquivos de save dos jogos e memory cards.
- **savestates**: os estados salvos criados pelo emulador.

Por padrão, as duas vêm ligadas. Ainda na página do emulador, dá para definir padrões
de arquivo a ignorar (por exemplo, `*.tmp` ou `cache/**`), que nunca sincronizam em
nenhuma direção.

## Como funciona por baixo

O Slot2Sync compara a data de modificação dos arquivos locais com a versão que ele
conhece do armazenamento remoto:

- só o lado local mudou: envia para o remoto;
- só o remoto mudou: baixa para a máquina local;
- **os dois lados mudaram**: vira um [conflito](resolucao-de-conflitos.md), nunca uma
  sobrescrita silenciosa.

O Slot2Sync **nunca deleta arquivos no armazenamento remoto**, apenas adiciona e
atualiza.

## Sem internet ou arquivo em uso

Se a sincronização não puder acontecer (sem rede, ou o arquivo está sendo usado pelo
emulador naquele instante), o Slot2Sync guarda isso como uma pendência e tenta de novo
na próxima sincronização, nunca como um erro que interrompe o uso do app.
