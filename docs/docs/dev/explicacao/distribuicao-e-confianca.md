# Distribuição pública e confiança

O Slot2Sync é distribuído para usuários sem relação técnica com o projeto, a partir de um
repositório **público** no GitHub, sob licença **GPLv3** (open source) — isso abre algumas
opções gratuitas de "prova de confiança" que um projeto fechado não teria (GitHub Attestations,
elegibilidade a assinatura de código gratuita para FOSS), mas não resolve tudo sozinho: SmartScreen
e verificação OAuth continuam exigindo os passos abaixo independente da licença. Para o usuário,
confiança se traduz em três coisas concretas: a tela de consentimento do Google não mostrar aviso
de "app não verificado", o instalador Windows não ser bloqueado pelo SmartScreen, e existir um
canal público de contato/política de privacidade — mais, agora, a possibilidade de qualquer um
auditar o código-fonte e compilar por conta própria.

## Verificação OAuth do Google

Apps que usam OAuth do Google passam por verificação; enquanto pendente, a tela de consentimento
mostra um aviso vermelho que exige clique extra do usuário. Como o Slot2Sync usa o escopo
`drive.file` — não-sensível — a verificação é gratuita e simplificada (o escopo sensível `drive`
exigiria auditoria paga). É o item de maior impacto por menor esforço: depende só de ter domínio
próprio verificado e uma página pública de política de privacidade no ar.

## SmartScreen do Windows

O SmartScreen opera por reputação acumulada, não por assinatura isolada: quanto mais downloads
sem reclamação, menor a frequência do aviso — processo gradual, sem solução gratuita e imediata
fora de uma loja de apps. Foram avaliadas as alternativas:

- **Certificado de assinatura de código pago** (~$70–200/ano): não elimina o aviso, só acelera a
  reputação — e desde 2026 nem o certificado EV mais dispensa o SmartScreen automaticamente.
- **MSIX autoassinado**: o usuário precisaria importar manualmente o certificado como "editor
  confiável" — inviável para público leigo.
- **SignPath Foundation** (assinatura gratuita para projetos open source): agora elegível — o
  requisito que descartava essa opção (ser open source) passou a valer com o repositório público
  sob GPLv3. Não é automático: exige submeter o projeto ao programa e passar pelos critérios de
  aceitação deles (atividade do projeto, revisão de segurança); ainda não avaliado na prática.
  Se aceito, é a opção mais barata que resolve o SmartScreen sem depender da Microsoft Store.
- **Microsoft Store**: apps aprovados não disparam o SmartScreen — a Microsoft assina por conta
  própria na publicação. Continua sendo a opção mais **garantida** (não depende de aprovação
  externa de um programa de terceiros), mas tem o bloqueio técnico do MSIX descrito abaixo.

## GitHub Attestations — adotado

`actions/attest-build-provenance` gera atestação SLSA assinada (Sigstore), verificável via
`gh attestation verify`, para cada instalador publicado no release — viável porque o
repositório é público (a verificação exige acesso de leitura ao repo, que um usuário final
comum não teria num repo privado).

## Microsoft Store — estratégia alternativa, ainda não implementada

Resolve o SmartScreen de forma garantida no Windows (publicar deixou de ter taxa de registro em
2025/2026, tanto para conta individual quanto empresa). O bloqueio é técnico, não financeiro: a
Store só aceita pacotes **MSIX**, que o Tauri v2 não gera nativamente — dependeria de uma
ferramenta comunitária (`tauri-windows-bundle`) sem suporte declarado explicitamente ao Tauri v2,
e o Slot2Sync precisa ler pastas de **outros** aplicativos (`%APPDATA%\PPSSPP`,
`%APPDATA%\PCSX2` etc.), o que dentro do contêiner virtual de filesystem do MSIX pode exigir a
capability restrita `broadFileSystemAccess` — sujeita a aprovação manual da Microsoft e prazo
incerto. Os passos de validação local e a proposta de job de CI para gerar o MSIX estão em
[Roadmap](../roadmap.md).

A Store não resolve o aviso OAuth (item independente, acima) nem cobre macOS/Linux — para
macOS o equivalente seria a Mac App Store ou notarização paga do binário; Linux não tem aviso
equivalente ao SmartScreen. Builds `.dmg`/`.deb`/AppImage para essas plataformas já são gerados
via runners hospedados do GitHub Actions — o que falta ali é notarização/assinatura Apple e
empacotamento Flatpak, não a capacidade de compilar (ver
[Referência — Status multiplataforma](../referencia/status-multiplataforma.md)).
