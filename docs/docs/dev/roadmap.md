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
- Cache de listagem de arquivos do Drive (distinto do cache de IDs de pasta, já implementado).
- Hash paralelo (`rayon`) para reduzir o custo de calcular SHA-256 em coleções grandes.

## Robustez do sync

- Tombstone de deleção no manifest — hoje o RetroSync nunca deleta, mas não há registro
  explícito de "este arquivo foi removido intencionalmente"; um tombstone permitiria distinguir
  isso de "nunca existiu" em cenários futuros que precisem dessa informação.
- Caminhos longos no Windows (prefixo `\\?\`), para coleções com árvores de pastas profundas
  que excedem o limite clássico de 260 caracteres.
- Checagem de symlink traversal nas pastas monitoradas (segurança: um symlink dentro de uma
  pasta de save não deveria permitir sincronizar arquivos fora da árvore esperada).
- Testes de integração com `DriveApi` mockável, para cobrir cenários de rede sem depender de
  credenciais reais.

## Distribuição pública

- Microsoft Store / empacotamento MSIX (ver [Distribuição e confiança](./explicacao/distribuicao-e-confianca.md)).
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
