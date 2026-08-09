# Internacionalização (i18n)

A interface está disponível em inglês (padrão) e português brasileiro, via
`react-i18next`. O idioma é escolhido pelo usuário num seletor nas configurações e
persistido em `localStorage` (`slot2sync.language`) — não cruza a boundary IPC, porque é
uma escolha puramente de apresentação do frontend. O menu nativo da bandeja (Rust)
permanece fixo em inglês.

## Por que inglês como padrão

O app nasceu em português, mas para distribuição pública inglês como padrão alcança o
maior público; o português continua disponível num clique. Manter os textos centralizados
em arquivos de locale — em vez de espalhados no JSX — é o que permite adicionar um
terceiro idioma sem caçar strings componente a componente.

## Locales modulares por domínio

Em vez de um único arquivo por idioma, os textos são divididos por área funcional
(comum, autenticação, sincronização, configurações, erros). Isso mantém PRs de tradução
restritos ao módulo relevante, e erros de tipo apontam direto para o arquivo e a chave
problemática.

## Paridade de chaves garantida em tempo de compilação

Cada módulo de um idioma não-inglês é tipado contra o módulo inglês correspondente, de
forma que o TypeScript exige exatamente as mesmas chaves — uma chave faltando ou sobrando
vira erro de compilação, não texto ausente em runtime. O CI roda essa checagem de tipos
como um passo isolado antes do build, para que PRs que só toquem locales tenham feedback
rápido.

## Por que a bandeja fica fixa em inglês

O menu nativo é construído uma única vez, no setup do app, fora do alcance do
sistema de tradução do frontend. Reconstruí-lo a cada troca de idioma teria custo
desproporcional ao ganho; inglês é o padrão reconhecido em apps desktop.

## Idioma no `localStorage`, não em `Settings`

Idioma é uma escolha de apresentação do frontend — o backend não precisa dela. Mantê-la
fora da boundary IPC evita um round-trip e um terceiro ponto de espelhamento para uma
escolha que não afeta nenhuma lógica de negócio.

## Tradução de erros do backend

Todo erro do Rust serializa como `{ code, message, detail }` (ver
[Referência — Boundary IPC](../referencia/boundary-ipc.md#erros)). O frontend localiza o
prefixo da mensagem pelo `code` e anexa o `detail` — o texto técnico sem prefixo (caminho,
nome, mensagem de biblioteca). Separar os dois permite que o prefixo seja traduzido sem
perder a informação de diagnóstico original.

## Limitação conhecida

O payload do evento `sync:error` carrega um `message` já formatado pelo backend, não um
`code` separado. A barra de status traduz o rótulo ao redor do erro, mas o detalhe do
erro de sync em background aparece no idioma original em que o backend o gerou.
Localizá-lo exigiria carregar `code`/`detail` também nesse evento — ainda não feito.

Para adicionar um novo idioma, veja [Como adicionar um idioma](../guias/como-adicionar-idioma.md).
