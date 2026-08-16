# Documentação do Slot2Sync

Documentação técnica do Slot2Sync — aplicação desktop (Tauri v2 + Rust + React/TS)
que sincroniza automaticamente saves, savestates e configurações de emuladores de
retrogames com um provedor de storage remoto (Google Drive hoje; Dropbox e OneDrive
implementados e em preparação — ver [Provedores de storage](./explicacao/provedores-de-storage.md)).

Organizada pelo framework [Diátaxis](https://diataxis.fr/): tutoriais ensinam fazendo,
guias resolvem uma tarefa específica, referências respondem "o que é X", explicações
respondem "como/por que X funciona". Decisões e riscos ficam num registro à parte —
não são nenhuma das quatro coisas acima, são histórico de raciocínio.

Para a visão geral do produto e os objetivos que guiam as decisões de projeto, veja o
[`README.md`](https://github.com/jIDvDIj/slot2sync#readme) e o
[`GOALS.md`](https://github.com/jIDvDIj/slot2sync/blob/main/GOALS.md) na raiz do repositório.

## Tutoriais

| Documento | Conteúdo |
| --- | --- |
| [Onboarding](./tutoriais/onboarding.md) | Do clone ao primeiro `npm run tauri dev`: pré-requisitos, credenciais, build, qualidade, fixes de ambiente WSL |

## Guias práticos

| Documento | Conteúdo |
| --- | --- |
| [Como adicionar suporte a uma plataforma](./guias/como-adicionar-plataforma.md) | `cfg(desktop)`/`cfg(mobile)`, módulos `platform/`, padrão de comando espelhado |
| [Como adicionar um emulador](./guias/como-adicionar-emulador.md) | Entrada no catálogo `profiles.toml`, teste de detecção, descoberta automática |
| [Como adicionar um idioma](./guias/como-adicionar-idioma.md) | Passo a passo para um novo locale em `react-i18next` |
| [Como configurar o tooling pendente](./guias/setup-tooling-pendente.md) | O que ainda falta configurar (Codecov, proteção de branch, secrets do Android) |

## Referência

| Documento | Conteúdo |
| --- | --- |
| [Boundary IPC](./referencia/boundary-ipc.md) | Catálogo de comandos, eventos e tipos compartilhados Rust ↔ TS |
| [Perfis de emulador](./referencia/perfis-emulador.md) | Estrutura de `EmulatorProfile`, catálogo `profiles.toml`, como adicionar um emulador |
| [Status multiplataforma](./referencia/status-multiplataforma.md) | Estado por fase da portabilidade Windows/Linux/macOS/Steam Deck/Android/iOS |

## Explicação

| Documento | Conteúdo |
| --- | --- |
| [Arquitetura](./explicacao/arquitetura.md) | Visão geral, diagrama de componentes, fluxo de dados de um sync, módulos do backend |
| [Provedores de storage](./explicacao/provedores-de-storage.md) | Trait `RemoteProvider`, os quatro provedores concretos, atribuição de dispositivo sem `appProperties` |
| [Autenticação](./explicacao/autenticacao.md) | PKCE parametrizado por provedor, proxy Cloudflare Worker, fluxo desktop e mobile, armazenamento de tokens |
| [Sincronização e conflitos](./explicacao/sincronizacao-e-conflitos.md) | Motor de decisão do sync: sem manifest, com manifest, conflito explícito |
| [Configurações](./explicacao/configuracoes.md) | Nome do dispositivo, categorias por emulador, gatilhos automáticos, notificações, backup, banda |
| [Monitoramento de processos](./explicacao/monitoramento-processos.md) | Process watcher, debounce assimétrico, máquina de estados |
| [UI e system tray](./explicacao/ui-e-tray.md) | Janela principal, bandeja, sync de despedida, notificações nativas |
| [Internacionalização](./explicacao/internacionalizacao.md) | `react-i18next`, locales modulares, tradução de erros do backend |
| [Distribuição e confiança](./explicacao/distribuicao-e-confianca.md) | SmartScreen, verificação OAuth, Microsoft Store/MSIX |

## Decisões e riscos

| Documento | Conteúdo |
| --- | --- |
| [Decisões técnicas](./decisoes/decisoes-tecnicas.md) | Registro consolidado de decisões de design e seus trade-offs (formato ADR) |
| [Riscos técnicos](./decisoes/riscos.md) | Riscos identificados e mitigações |
| [Geração automática da boundary IPC](./decisoes/geracao-automatica-ipc.md) | Decisão em aberto: `ts-rs` vs. `tauri-specta` |

## Trabalho pendente

[`roadmap.md`](./roadmap.md) — lista consolidada do que ainda falta, priorizável.

## Contribuindo

Fluxo de PR, convenção de commits e como configurar credenciais de desenvolvimento (OAuth
próprio, nunca as de produção) estão em
[`CONTRIBUTING.md`](https://github.com/jIDvDIj/slot2sync/blob/main/CONTRIBUTING.md), no
repositório de código.
