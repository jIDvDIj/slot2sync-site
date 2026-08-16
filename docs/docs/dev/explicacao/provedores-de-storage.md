# Provedores de storage

Como o Slot2Sync deixou de ser "o app que sincroniza com o Google Drive" para virar "o app
que sincroniza com um provedor de storage remoto, um dos quais é o Google Drive" — e o que
isso mudou (e não mudou) na arquitetura.

## O trait `RemoteProvider`

Todo o motor de sync (`SyncEngine`, diff, resolução de conflito) depende só do trait
`remote::RemoteProvider` — nunca de um cliente concreto. As operações são as mesmas que
qualquer backend de arquivos remotos precisa oferecer: garantir a estrutura de pastas,
listar a árvore, baixar, subir (novo ou substituição), renomear sem retransferir, e
invalidar cache quando um ID conhecido deixa de existir.

Essa indireção já existia antes de forma restrita (um trait `DriveApi` só para permitir
mockar o Drive em teste, ver [Decisões técnicas](../decisoes/decisoes-tecnicas.md)); a
mudança foi generalizar esse mesmo trait para deixar de assumir que o único backend
possível é o Drive. `DriveClient` continua sendo uma implementação concreta do trait — só
deixou de ser a única.

`RemoteFile` é o tipo achatado e genérico que qualquer provedor devolve ao listar/enviar um
arquivo (`id`, caminho relativo, mtime, tamanho, hash, dispositivo de origem). Cada cliente
concreto converte o shape nativo da sua API para esse formato na borda — o motor de sync
nunca vê um tipo específico de provedor.

## Os quatro provedores

| Provedor | Endereçamento | Autenticação | Status |
| --- | --- | --- | --- |
| **Google Drive** | ID opaco por arquivo/pasta, com cache local (`storage/drive_folders`) | OAuth2 + PKCE via proxy Worker (ver [Autenticação](./autenticacao.md)) | ✅ Disponível |
| **Pasta local ou de rede** | Caminho de filesystem — o "provedor" é literalmente um diretório escolhido pelo usuário | Nenhuma | ✅ Disponível |
| **Dropbox** | Path dentro da App Folder do app (Dropbox não tem conceito de ID de pasta) | OAuth2 + PKCE puro, sem proxy | 🟡 Backend pronto, desativado na UI |
| **OneDrive** | Path dentro da pasta especial `approot` (Microsoft Graph) | OAuth2 + PKCE puro, sem proxy | 🟡 Backend pronto, desativado na UI |

A pasta local/de rede é o caso mais simples: não fala com nenhuma API, só lê e escreve no
caminho informado — útil para quem já sincroniza essa pasta por fora (Syncthing, um NAS, um
cliente de desktop de outro provedor apontando pra ela) ou só quer um backup local sem depender
de nuvem nenhuma. Por depender de diálogo nativo de sistema de arquivos, essa opção só existe
no desktop (ver [Status multiplataforma](../referencia/status-multiplataforma.md)).

Dropbox e OneDrive têm o cliente HTTP completo implementado e testado (listagem, download,
upload, rename, retry/backoff), mas ficam com o botão desativado (rótulo "em breve") na tela
de login enquanto as credenciais reais não são cadastradas nos consoles externos (App Console
do Dropbox / Azure App registrations) — ver a decisão registrada em
[Decisões técnicas](../decisoes/decisoes-tecnicas.md).

## Atribuição de dispositivo sem `appProperties`

O Google Drive tem um recurso nativo — `appProperties`, um dicionário chave-valor privado do
app anexado a cada arquivo — usado para gravar qual dispositivo publicou aquela versão (base
da resolução de conflito, ver [Sincronização e conflitos](./sincronizacao-e-conflitos.md)).
Dropbox e OneDrive não têm um equivalente simples, e a pasta local/de rede não tem metadado
nenhum além do que o próprio filesystem oferece (que não inclui "qual dispositivo escreveu
isto").

A solução para esses três é um índice-sidecar: um único arquivo JSON por provedor
(`.slot2sync-index.json`), mapeando caminho relativo → nome/ID do dispositivo, atualizado a
cada upload/rename e excluído da própria listagem de arquivos sincronizáveis. O Google Drive
não usa esse mecanismo — continua com `appProperties` nativas, sem mudança de comportamento.

## Trocar de provedor

Conectar a um provedor grava qual foi escolhido; desconectar limpa essa escolha e a
credencial correspondente (o keyring guarda uma chave de refresh token por provedor, não uma
única chave compartilhada). Trocar de provedor **não migra arquivos automaticamente** — o novo
provedor começa do zero, com o primeiro sync fazendo o papel de baseline completo, exatamente
como o primeiro sync de qualquer emulador novo.

## Ver também

- [Autenticação](./autenticacao.md) — como o fluxo OAuth2+PKCE foi parametrizado por provedor.
- [Referência — Boundary IPC](../referencia/boundary-ipc.md) — comandos `connect_*`/`disconnect_provider`.
- [Decisões técnicas](../decisoes/decisoes-tecnicas.md) — por que generalizar agora e por que
  Dropbox/OneDrive ficam desativados na UI antes de terem credenciais reais.
