# Distribuição pública e confiança

O RetroSync é distribuído para usuários sem relação técnica com o projeto, a partir de um
repositório **privado**, como software **proprietário** (não open source) — essa combinação
elimina várias opções gratuitas de "prova de confiança" e molda as decisões abaixo. Para o
usuário, confiança se traduz em três coisas concretas: a tela de consentimento do Google não
mostrar aviso de "app não verificado", o instalador Windows não ser bloqueado pelo SmartScreen,
e existir um canal público de contato/política de privacidade.

## Verificação OAuth do Google

Apps que usam OAuth do Google passam por verificação; enquanto pendente, a tela de consentimento
mostra um aviso vermelho que exige clique extra do usuário. Como o RetroSync usa o escopo
`drive.file` — não-sensível — a verificação é gratuita e simplificada (o escopo sensível `drive`
exigiria auditoria paga). É o item de maior impacto por menor esforço: depende só de ter domínio
próprio verificado e uma página pública de política de privacidade no ar.

## SmartScreen do Windows

O SmartScreen opera por reputação acumulada, não por assinatura isolada: quanto mais downloads
sem reclamação, menor a frequência do aviso — processo gradual, sem solução gratuita e imediata
para software proprietário fora de uma loja de apps. Foram avaliadas as alternativas:

- **Certificado de assinatura de código pago** (~$70–200/ano): não elimina o aviso, só acelera a
  reputação — e desde 2026 nem o certificado EV mais dispensa o SmartScreen automaticamente.
- **MSIX autoassinado**: o usuário precisaria importar manualmente o certificado como "editor
  confiável" — inviável para público leigo.
- **SignPath Foundation** (assinatura gratuita): exige projeto open source; não se aplica aqui.
- **Microsoft Store**: apps aprovados não disparam o SmartScreen — a Microsoft assina por conta
  própria na publicação. É a única opção gratuita que resolve o problema de forma definitiva.

## GitHub Attestations — avaliado e descartado

`actions/attest-build-provenance` gera atestação SLSA assinada, verificável via
`gh attestation verify`. Foi descartado por ser **incompatível com repositório privado**: a
verificação exige acesso de leitura ao repo (um usuário final comum não tem), e a geração da
atestação pode falhar em conta pessoal/Pro com repo privado (o recurso completo normalmente
exige GitHub Enterprise). Alternativa viável não adotada: Cosign/Sigstore, que verifica sem
acesso ao repo mas expõe o nome do repositório e do workflow no log público Rekor — aceitável só
se o nome do repo puder ser público.

## Microsoft Store — estratégia principal, ainda não implementada

É a única opção gratuita que resolve o SmartScreen de forma definitiva para software
proprietário no Windows (publicar deixou de ter taxa de registro em 2025/2026, tanto para conta
individual quanto empresa). O bloqueio é técnico, não financeiro: a Store só aceita pacotes
**MSIX**, que o Tauri v2 não gera nativamente — dependeria de uma ferramenta comunitária
(`tauri-windows-bundle`) sem suporte declarado explicitamente ao Tauri v2, e o RetroSync precisa
ler pastas de **outros** aplicativos (`%APPDATA%\PPSSPP`, `%APPDATA%\PCSX2` etc.), o que dentro
do contêiner virtual de filesystem do MSIX pode exigir a capability restrita
`broadFileSystemAccess` — sujeita a aprovação manual da Microsoft e prazo incerto. Os passos de
validação local e a proposta de job de CI para gerar o MSIX estão em [Roadmap](../roadmap.md).

A Store não resolve o aviso OAuth (item independente, acima) nem cobre macOS/Linux — para
macOS o equivalente seria a Mac App Store ou notarização paga do binário; Linux não tem aviso
equivalente ao SmartScreen. Builds `.dmg`/`.deb`/AppImage para essas plataformas já são gerados
via runners hospedados do GitHub Actions — o que falta ali é notarização/assinatura Apple e
empacotamento Flatpak, não a capacidade de compilar (ver
[Referência — Status multiplataforma](../referencia/status-multiplataforma.md)).
