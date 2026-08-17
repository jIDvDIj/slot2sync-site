# Roadmap

Trabalho pendente real e priorizável, consolidado de propostas e análises anteriores. Itens já
implementados foram removidos desta lista — a documentação viva (`explicacao/`, `referencia/`)
reflete o estado atual; aqui só entra o que ainda falta.

## Identificação de jogos

- Integração ampla com **OpenVGDB** para tradução serial → nome de jogo (hoje só existe uma
  tabela embutida pequena, `games::NAMES`).

## Performance de sync

- Poda do `list_tree` por `modifiedTime` de pasta, evitando listar subárvores que não mudaram
  desde o último sync. Adiado por exigir persistir `modifiedTime` de pastas e por risco de
  regressão na detecção de mudança remota.

## Robustez do sync

- Tombstone de deleção no manifest — hoje o Slot2Sync nunca deleta, mas não há registro
  explícito de "este arquivo foi removido intencionalmente"; um tombstone permitiria distinguir
  isso de "nunca existiu" em cenários futuros que precisem dessa informação.
- Testes de integração contra as APIs reais dos provedores (feature `integration-tests`, hoje
  vazia) — os cenários com `RemoteProvider` mockável (`MockDrive`) já cobrem a lógica de sync
  sem rede; o que falta é validar contra as APIs de verdade.
- Detecção mais completa de pasta desmontada: hoje só a ausência da própria pasta raiz é
  detectada (`AppError::FolderNotMounted`); o arquivo-marcador gravado ao adicionar o emulador
  (`LOCAL_ROOT_MARKER`) existe no disco mas ainda não é consultado — falta uma heurística que
  distinga "nunca foi montado aqui" de "estava montado e o ponto de montagem revelou uma pasta
  local vazia por baixo" sem arriscar falso positivo num reconecte legítimo.
- Unificar `sync_conflicts`/`pending_ops` num bitmask completo de flags em `sync_manifest`
  (hoje o bitmask existe como índice secundário best-effort, mas as duas tabelas continuam
  sendo a fonte de verdade — unificar de verdade exigiria redesenhar como essas duas tabelas
  guardam dados que um bitmask não cabe: tentativas/backoff, dispositivo de origem, tamanhos).

## Provedores de storage

- Cadastrar credenciais de produção do Dropbox (App Console) e do OneDrive (Azure App
  registrations) e habilitar os dois botões hoje desativados na tela de login — o backend já
  está implementado e testado, falta só o cadastro externo. Ver
  [Provedores de storage](./explicacao/provedores-de-storage.md).
- Upload em sessão/chunks para Dropbox e OneDrive — hoje os dois só sobem arquivo inteiro de
  uma vez, com o limite de upload simples de cada API (150 MB no Dropbox, 4 MB no OneDrive);
  savestates grandes podem exceder esse limite, especialmente no OneDrive.

## Diagnóstico e observabilidade

- Badge de contagem de erros no ícone da bandeja, com um painel de histórico ao clicar — o
  backend e os comandos (`get_recent_errors`/`clear_errors`) já existem, falta só a UI.
  Provavelmente nasce junto com o item abaixo.
- Aba "Diagnóstico" no `SettingsModal` reunindo fila offline, histórico de erros e talvez um
  visualizador de log inline — hoje o export em `.zip` (`export_diagnostics`) já cobre o caso
  de "anexar a um relato de bug", mas não há uma tela pra inspecionar isso sem sair do app.

## Distribuição pública

- Microsoft Store / empacotamento MSIX (ver [Distribuição e confiança](./explicacao/distribuicao-e-confianca.md)).
- Avaliar a submissão ao programa **SignPath Foundation** (assinatura de código gratuita para
  FOSS) agora que o repositório é público sob GPLv3 — critério que antes descartava a opção.
  Não avaliado na prática ainda; ver [Distribuição e confiança](./explicacao/distribuicao-e-confianca.md).
- Assinatura e notarização do build macOS.
- Empacotamento Flatpak para Linux (o build `.deb`/AppImage já roda via CI; falta o pacote Flatpak).
- Reativar os jobs de build/check Android em CI quando os secrets do GitHub existirem (keystore
  de assinatura) — ver [Como configurar o tooling pendente](./guias/setup-tooling-pendente.md).

## Infraestrutura de tipos

- Adotar geração automática da boundary IPC (`ts-rs` ou `tauri-specta`) — decisão em aberto, ver
  [Geração automática da boundary IPC](./decisoes/geracao-automatica-ipc.md).

## Atualização do app

- Auto-update via `tauri-plugin-updater`, para que usuários não precisem baixar manualmente
  cada nova versão do GitHub Releases.
