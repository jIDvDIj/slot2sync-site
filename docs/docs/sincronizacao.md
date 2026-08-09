# Sincronização

## Gatilhos automáticos

Cada gatilho pode ser ligado ou desligado individualmente nas configurações do app:

| Gatilho | Quando dispara | Padrão |
| --- | --- | --- |
| Ao abrir o Slot2Sync | sincroniza tudo assim que o app inicia | ligado |
| Ao abrir um emulador | baixa os saves mais recentes do Drive antes do jogo começar | ligado |
| Ao fechar um emulador | envia o progresso novo para o Drive | ligado |

Se você desligar todos os gatilhos automáticos, o botão **Sincronizar agora** (na tela
principal e no menu da bandeja) continua funcionando normalmente — assim como a
sincronização de despedida disparada pelo item **Sair** da bandeja.

## Categorias

Para cada emulador, você escolhe quais categorias sincronizar, individualmente:

- **saves** — geralmente vale a pena manter ligado em todas as máquinas.
- **savestates** — idem.

Por padrão, as duas vêm ligadas.

## Como funciona por baixo

O Slot2Sync compara a data de modificação dos arquivos locais com a versão que ele
conhece do Drive:

- só o lado local mudou → envia para o Drive;
- só o Drive mudou → baixa para a máquina local;
- **os dois lados mudaram** → vira um [conflito](resolucao-de-conflitos.md), nunca uma
  sobrescrita silenciosa.

O Slot2Sync **nunca deleta arquivos no Drive** — apenas adiciona e atualiza.

## Sem internet ou arquivo em uso

Se a sincronização não puder acontecer (sem rede, ou o arquivo está sendo usado pelo
emulador naquele instante), o Slot2Sync guarda isso como uma pendência e tenta de novo
mais tarde — nunca aparece como um erro que interrompe o uso do app.
