# Setup pendente de tooling

Já configurado e funcionando: hook de validação de mensagem de commit, release notes
automáticas, script de `AUTHORS`/`.mailmap`, lint e extração de i18n, builds
reproduzíveis (`SOURCE_DATE_EPOCH`), cobertura de testes (Codecov) e verificação de
licenças (`cargo-deny`). Os passos abaixo são o que ainda exige ação manual.

## Rodar `npm install` no Windows depois de puxar uma dependência nova

O `node_modules` em `/mnt/c` é compartilhado entre Windows e WSL; uma dependência
adicionada só no `package-lock.json` (sem instalar do lado Windows) quebra
`npm run lint`/`build` no PowerShell com `Cannot find module`. No **PowerShell**:

```powershell
npm install
```

## Instalar o hook de commit num clone novo

Já instalado neste clone (o `.git/` é compartilhado entre Windows e WSL). Em clones
novos ou outras máquinas:

```bash
sh scripts/install-hooks.sh
```

O hook rejeita commits fora do padrão `tipo(escopo): descrição`
(tipos: `feat|fix|docs|chore|refactor|test|style|perf|ci|build|merge`; merges e reverts
do git passam direto).

## Configurar o Codecov (para a cobertura aparecer)

O job `coverage` do CI roda os testes Rust e gera o relatório mesmo sem configuração —
mas o **upload** para o Codecov precisa do token:

1. Acesse [app.codecov.io](https://app.codecov.io) e faça login com a conta GitHub.
2. Ative o repositório `jIDvDIj/retro-sync` e copie o **Upload token**.
3. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - Nome: `CODECOV_TOKEN`
   - Valor: o token copiado.

Sem o token o CI **não quebra** (`fail_ci_if_error: false`) — só não publica a cobertura.

## Validar o cargo-deny localmente (opcional — o CI já roda)

```bash
cargo install cargo-deny --locked
sh scripts/check-licenses.sh
```

Se um novo crate trouxer licença fora da lista, a decisão é explícita: adicionar a
licença ao `allow` do `src-tauri/deny.toml` (se compatível com distribuição) ou trocar
o crate.

## Proteção de branch: exigir apenas o check `ci-passed`

O CI tem um job gatekeeper (`ci-passed`) que agrega o resultado de todos os outros jobs.
Para ele valer como porteiro:

1. No GitHub: **Settings → Branches → regra da `main`** (criar se não existir).
2. Marcar **Require status checks to pass before merging**.
3. Selecionar como required checks **apenas**:
   - `ci-passed` — agrega todos os jobs do GitHub Actions;
   - `codecov/patch` — cobertura do código novo ≥ 80% (política em `codecov.yml`).

Os checks só aparecem na lista de seleção depois da **primeira execução** de cada um —
abra o PR primeiro, configure depois. A partir daí, adicionar/remover jobs do CI exige
atualizar apenas o `needs` do `ci-passed`, sem mexer no GitHub.

Atenção com o `codecov/patch` required: PRs cujo diff "cobrível" seja só código
não-testável (shims de delegação para I/O real, wiring de setup) ficarão vermelhos — a
saída é acompanhar o PR com testes, ou um admin mergear com override consciente.

## Reativar o build e os checks Android

Os secrets de assinatura do Android ainda não existem no GitHub — os jobs `android`
(`release.yml`) e `android-check` (`ci.yml`) seguem com `if: false`. Passos para
reativar:

1. Criar os secrets no GitHub (**Settings → Secrets and variables → Actions**):
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_PASSWORD`.
2. Remover o `if: false` do job `android` (`release.yml`) e do `android-check` (`ci.yml`).
3. Devolver `android-check` à lista `needs` do job `ci-passed` no `ci.yml`.

## Revisar periodicamente os ignores do cargo-audit

O job `audit` ignora `RUSTSEC-2026-0194` e `RUSTSEC-2026-0195` (`quick-xml` <0.41,
transitivo via `plist`/`tauri-winrt-notification`, sem correção possível por
`cargo update` enquanto esses parents não atualizarem). Quando atualizarem, rode
`cargo update --manifest-path src-tauri/Cargo.toml` e remova os `--ignore` do `ci.yml`.

## Itens sem data prevista

Ver [roadmap](../roadmap.md) para: drop de privilégios no startup (Windows), seção
"Sobre" no `SettingsModal`, `THIRD_PARTY_LICENSES.txt` no instalador, SLSA provenance
(bloqueado por repo privado) e assinatura/notarização macOS (falta certificado Apple
Developer).
