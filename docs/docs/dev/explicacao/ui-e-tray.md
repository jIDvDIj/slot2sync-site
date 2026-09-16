# UI e system tray

Como a tela principal, a bandeja do sistema e as notificações nativas se encaixam —
e por que o app vive na bandeja em vez de encerrar ao fechar a janela.

## System tray e ciclo de vida da janela

O app vive na bandeja:

- **Fechar a janela** apenas a esconde (`prevent_close` + `hide`). O app continua
  rodando — watcher e syncs automáticos seguem ativos.
- O **menu da tray** oferece: **Abrir** (mostra e foca a janela, também no clique
  esquerdo do ícone), **Sincronizar agora** (sync bidirecional manual em background) e
  **Sair** (roda o sync de despedida e então encerra o processo).

Todas as operações de janela/tray são feitas no Rust, então não exigem permissões novas
nas capabilities do Tauri — o sistema de permissões só controla o que o frontend (JS)
invoca.

Ver [Decisões técnicas](../decisoes/decisoes-tecnicas.md#app-vive-na-tray-fechar-a-janela-sair).

## Por que o sync de despedida fica no "Sair", não no `ExitRequested`

O sync de despedida roda no handler do menu **"Sair"** — uma saída intencional e
controlável — e não no evento `ExitRequested` do runtime, que exigiria prevenir a saída
e re-disparar o `exit` depois do sync assíncrono terminar. Como fechar a janela apenas
esconde, o único caminho de saída real do app passa pelo "Sair", então o sync de
despedida sempre roda quando o usuário efetivamente encerra o Slot2Sync.

## Último sync compartilhado

O último sync concluído fica numa célula compartilhada entre o motor de sincronização
(que grava ao concluir, antes de notificar o frontend) e o estado da aplicação (lido pela
UI). A UI busca esse valor ao montar — cobrindo o sync de startup, que roda antes da tela
existir — e depois atualiza ao vivo pelo evento de conclusão. Não há persistência em
SQLite para isso: o estado é efêmero por execução, e cada inicialização do app já produz
um sync novo de qualquer forma.

Ver [Decisões técnicas](../decisoes/decisoes-tecnicas.md#ultimo-sync-em-celula-compartilhada).

## Notificações nativas disparadas do backend

As notificações de erro são disparadas pelo **backend**, no mesmo ponto em que o motor de
sync emite o evento de erro — não pelo frontend. Isso garante que funcionem mesmo com a
janela oculta (gatilhos de startup ou do watcher) ou durante o sync de despedida no
shutdown, quando o webview pode já não estar responsivo.

Ver [Decisões técnicas](../decisoes/decisoes-tecnicas.md#notificacoes-de-erro-no-backend).

## Fluxo do frontend

A interface é uma aplicação React de página única (sem router), organizada em quatro
telas — Visão geral, Emulador, Atividade e Configurações — trocadas por estado local no
componente raiz. No desktop, a navegação é uma barra lateral fixa; abaixo de 700px ela vira
uma barra de abas no rodapé, e a página de emulador ganha um botão de voltar. Um assinante
único dos eventos de sync e de status de emulador distribui o estado consolidado para a
barra superior (progresso, último sync, erro), o botão de sincronizar e a lista de
emuladores. Adicionar um emulador abre o seletor de pasta nativo do sistema e envia o
caminho escolhido para detecção no backend; um erro de "emulador não reconhecido" aparece
inline, com a opção de cadastro manual.

Aparência (claro/escuro) segue a preferência do sistema operacional por padrão; escolher
Claro ou Escuro nas Configurações grava a preferência só no `localStorage` do webview — é
puramente de exibição, então não cruza a boundary IPC. Categorias de sync e padrões de
exclusão, que antes viviam nas Configurações globais, agora ficam na própria página do
emulador, junto com o que mais afeta só ele (conflitos, pendências, jogos sincronizados).

### Sistema de design

Todo espaçamento, cor, raio e duração de animação vem de custom properties CSS
(`src/styles/tokens.css`) — nenhum componente hardcoda esses valores. As paletas clara e
escura são geradas a partir do mesmo conjunto de papéis semânticos (superfície, texto
primário/secundário, aviso, erro), o que faz alternar de tema não exigir tocar em nenhum
componente. `prefers-reduced-motion`, `prefers-reduced-transparency` e
`prefers-contrast: more` são lidos direto nos tokens (ex.: transições viram
praticamente instantâneas, o material translúcido do topo vira opaco), então o suporte de
acessibilidade é automático em vez de replicado componente a componente.

Os primitivos de UI (`src/components/ui/`) são poucos e sem dependência externa: `Button`,
`Dialog` (baseado no `<dialog>` nativo, que já resolve foco e a camada de topo), `Switch`,
linhas de formulário e um pequeno conjunto de ícones em SVG inline. O botão de sincronizar é
o elemento de assinatura visual do app: ele mesmo vira o indicador de progresso durante um
sync (um anel com o gradiente da marca) em vez de um spinner genérico ao lado.

## Comando exposto

Ver [Referência — Boundary IPC](../referencia/boundary-ipc.md) — comando `get_last_sync`
e evento `emulator:status`.

## Como testar manualmente (Windows, `npm run tauri dev`)

1. Conecte um provedor → "Adicionar emulador" abre o seletor de pasta nativo → escolha a
   pasta de um emulador suportado; o tile aparece na Visão geral;
2. O botão de sincronizar vira um anel de progresso e depois confirma "Sincronizado";
3. Feche a janela no X → o app continua na bandeja; clique no ícone → a janela volta;
4. Abra o emulador → o status na barra lateral e no tile vira "Em execução" e dispara o
   sync direcionado;
5. Abra a página do emulador → resolva um conflito ou ajuste as categorias de sync;
6. Menu da tray → Sair → roda o sync de despedida e encerra.

> **Notificações em dev**: no Windows, notificações nativas podem não aparecer até o app
> estar instalado (registro do AppUserModelID no WebView2) — é limitação do SO, não do
> código.
