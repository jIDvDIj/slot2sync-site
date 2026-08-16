# Decisões Técnicas

Registro consolidado das decisões de design e seus trade-offs. Formato leve de ADR
(Architecture Decision Record). Cada decisão lista o **contexto**, a **escolha** e a
**justificativa/alternativas**.

---

## Frontend "burro", backend "inteligente"

**Contexto**: app Tauri tem duas linguagens; onde colocar a lógica?

**Escolha**: 100% da lógica de negócio no Rust. O React só dispara comandos e renderiza
estado recebido por eventos.

**Justificativa**: evita estado duplicado entre JS e Rust; mantém credenciais e tokens
fora do contexto JS (superfície de ataque menor); torna o frontend trivialmente
substituível. Custo: todo dado de UI precisa cruzar a boundary explicitamente.

---

## Escopo OAuth `drive.file`

**Contexto**: escopos do Drive vão de `drive.file` (só o que o app cria) a `drive` (tudo).

**Escolha**: `drive.file` + `openid email`.

**Justificativa**: é exatamente o que o Slot2Sync precisa (ele cria a pasta `Slot2Sync/`);
é **não-sensível**, o que evita o processo de verificação restrita do Google (auditoria
cara e lenta); reduz o risco para o usuário (o app não vê o resto do Drive dele).
Alternativa `drive` rejeitada por excesso de permissão e fricção de publicação.

---

## Proxy Worker esconde o `client_secret`

**Contexto**: o token endpoint do Google exige `client_secret`. Compilado no binário
(`option_env!`), ele é extraível de uma release (`strings`/descompilador) e pode ser usado
para abusar das credenciais do app conforme a base de usuários cresce.

**Escolha**: um Cloudflare Worker minúsculo intermedia `/token` e `/refresh`, guardando o
`client_secret` como secret cifrado do Cloudflare. O app só conhece a URL pública do Worker
e um `PROXY_SECRET` compartilhado (header `X-Proxy-Secret`). No CI, apenas `CLIENT_ID`,
`TOKEN_PROXY_URL` e `PROXY_SECRET` são injetados — o `client_secret` nunca entra no GitHub.

**Justificativa**: o `client_secret` deixa de existir em qualquer artefato distribuído ou
versionado. O redirect continua sendo o loopback `http://127.0.0.1:<porta>` tratado pelo app
— o Worker **não** é redirect URI, então o cliente OAuth permanece do tipo **Desktop app**
(único que aceita loopback em porta arbitrária).

**Trade-off aceito**: o `PROXY_SECRET` ainda é embutido no binário, logo extraível — barra
abuso casual e permite rotação, mas não é segredo forte. A proteção real é o `client_secret`
fora do binário. Suficiente para o porte do projeto; atestação de cliente fica fora de escopo.

Detalhes em [Autenticação](../explicacao/autenticacao.md).

---

## Evolução do client OAuth: de "Desktop app only" para client Web único (desktop + Android)

**Contexto**: o design original do proxy Worker (acima) assumia um único cliente OAuth tipo
"Desktop app" (loopback `127.0.0.1`). Ao adicionar suporte Android, três tentativas de tipo de
client falharam: "Desktop app" rejeita custom URI schemes; "Web application" rejeita esses
schemes na UI do Console; "Android" (Google Sign-In SDK) não aceita o fluxo PKEC baseado em
browser usado pelo app (retorna `invalid_request`).

**Escolha**: um único client OAuth tipo **Web application**, com duas redirect URIs
registradas — `http://127.0.0.1` (desktop, qualquer porta) e `https://<worker>/oauth/callback`
(Android). O Worker ganhou um endpoint novo, `GET /oauth/callback`, que recebe o `code` do
Google e faz um redirect 302 para o deep link `com.slot2sync.app:/oauth2redirect?...`; o app
mobile escuta esse deep link e troca o `code` no `/token` do Worker normalmente.
`SLOT2SYNC_GOOGLE_CLIENT_ID_ANDROID` (client dedicado da tentativa anterior) foi removido —
desktop e mobile passaram a compartilhar as mesmas variáveis de ambiente.

**Justificativa**: um client único simplifica a configuração (uma entrada no Google Console,
não uma por plataforma) e reaproveita a infraestrutura do Worker já existente para esconder o
`client_secret` — o endpoint `/oauth/callback` só faz um redirect, não expõe nenhum segredo.

---

## OAuth2 com PKCE + redirect loopback

**Contexto**: app desktop nativo não tem como guardar um client secret de verdade.

**Escolha**: PKCE (RFC 7636) com redirect para `127.0.0.1:porta-efêmera` (RFC 8252). O
client secret exigido pelo Google para clientes Desktop vem de env, nunca do código, e a
segurança real vem do PKCE.

**Justificativa**: padrão da indústria para apps instalados (rclone, gcloud SDK). O
`code_verifier` nunca trafega na URL de autorização; só o `challenge` S256. `state`
aleatório protege contra CSRF.

---

## Token storage: keyring + memória

**Contexto**: onde guardar refresh e access tokens.

**Escolha**: refresh token no keychain nativo do SO (`keyring`); access token só em
memória, renovado automaticamente com margem de 60s.

**Justificativa**: keychain é o local seguro do SO para segredos. Access token é efêmero
e não precisa persistir. **Tokens nunca cruzam a boundary** — o frontend só vê
`AuthStatus`. A trait de storage permite fallback futuro no Linux (Secret Service ausente
em setups minimalistas).

---

## Manifest: SQLite + snapshot JSON

**Contexto**: a spec pedia `sync_manifest.json` no Drive. JSON é frágil para estado
operacional (concorrência, consultas, corrupção).

**Escolha**: a **fonte de verdade operacional** é a tabela SQLite local
(`sync_manifest`); o `sync_manifest.json` no Drive é um **snapshot exportado** a cada sync.

**Justificativa**: SQLite é transacional, consultável e resistente a corrupção; serve à
fila offline e ao diff. O snapshot JSON cumpre a estrutura especificada e serve para
diagnóstico e bootstrap rápido de uma segunda máquina. Custo: duas representações, mas o
JSON é derivado (write-only do ponto de vista do app).

---

## Resolução de conflito por timestamp

**Contexto**: sync bidirecional precisa decidir quem vence quando um arquivo difere.

**Escolha**: o mais recente vence, com **tolerância de ±2s** e o **par de mtimes do último
sync** registrado no manifest. Nunca deleta.

**Justificativa**:
- A tolerância absorve granularidade de filesystem e pequenos desvios de relógio.
- O par `(local, drive)` do último sync distingue "nada mudou" de "mudou de um lado" —
  essencial porque os relógios local e remoto divergem; sem isso, qualquer skew causaria
  re-sync eterno.
- Uploads gravam o mtime local em `modifiedTime`; downloads aplicam o `modifiedTime` do
  Drive no arquivo local. Os dois lados convergem para o mesmo timestamp.
- Nunca deleta: o pior caso é um save antigo sobrescrito no lado perdedor — e o histórico
  de revisões do Drive ainda permite resgate manual.

Alternativa (hash de conteúdo puro, sem mtime) rejeitada como critério primário por custo
de I/O — hash entrou depois como pré-filtro complementar (ver decisão abaixo), não como
substituto do timestamp.

---

## Sem manifest prévio: primeiro sync, dispositivo desconhecido e conflito real

**Contexto**: além do caso "com manifest" acima, três cenários sem histórico de sync
precisavam de regra própria — sobrepor um save de 100h por um de 20 minutos, uma edição
simultânea silenciosamente resolvida por mtime sem aviso, e saves independentes de
dispositivos diferentes tratados como se fossem o mesmo progresso.

**Escolha**: quando não há manifest e o arquivo existe nos dois lados, o Drive vence por
padrão, mas com **backup local automático** antes de sobrescrever (`DownloadWithBackup`).
Quando ambos os lados mudaram desde o último sync (com manifest), vira **conflito
explícito** (`SyncAction::Conflict`): bloqueia o emulador, notifica e espera o usuário
escolher via UI. O device_id estável refina ainda mais o caso "sem manifest": se a versão
do Drive foi publicada por outro dispositivo, vira conflito em vez de Drive-vence-cego.

**Justificativa**: entre as alternativas avaliadas (sufixo de conflito preservando as duas
versões no filesystem, notificação com decisão do usuário, backup automático, histórico de
revisões do Drive, merge por formato de emulador), a combinação final prioriza
não-destrutividade sem exigir UI nova nos casos mais comuns (backup automático resolve o
primeiro sync) e decisão explícita só quando é genuinamente ambíguo (conflito real). Merge
por formato foi descartado por quebrar o princípio de núcleo agnóstico ao emulador e por
risco de corrupção de save. Detalhes em [Sincronização e conflitos](../explicacao/sincronizacao-e-conflitos.md).

---

## Fila offline como registro de intenção

**Contexto**: como retomar transferências que falharam por rede/arquivo em uso.

**Escolha**: a pendência registra *que* um arquivo precisa sincronizar, não *como*. O
próximo sync re-detecta a diferença pelo diff (fonte da verdade) e refaz a operação;
`resolve` limpa a pendência ao concluir.

**Justificativa**: imune a replay de operação obsoleta (ex.: enfileirou um upload, mas o
arquivo mudou de novo antes do retry). Mais simples que uma fila de comandos com payload.
A tabela tem dedupe (`UNIQUE`) e contagem de tentativas para diagnóstico.

---

## Engine agnóstico a emuladores (`SyncTarget`)

**Contexto**: a arquitetura precisa suportar emuladores novos sem reescrever o sync.

**Escolha**: o engine opera sobre `SyncTarget` (rótulo + listas de caminhos). A conversão
`EmulatorProfile → SyncTarget` é função de dados, fora do engine.

**Justificativa**: adicionar um emulador novo é editar dados (`profiles.toml`), não
escrever código em `sync/`. Testável isoladamente (o diff e o conflito não tocam disco
real além do scan). Ver [Referência — Perfis de emulador](../referencia/perfis-emulador.md).

---

## Diff por hash SHA-256 como pré-filtro do mtime

**Contexto**: comparar só por mtime tem um falso positivo comum: um arquivo é tocado (ex.:
o emulador reescreve o mesmo conteúdo, ou o sync anterior reancorou o mtime local) sem que
o conteúdo mude — o que dispararia um upload/download desnecessário.

**Escolha**: quando o mtime local diverge do manifest mas o hash SHA-256 do conteúdo é
igual ao registrado, o diff trata como "arquivo não mudou de verdade" — reancora o mtime no
manifest sem transferir. O hash não substitui o timestamp como critério de decisão entre
`Upload`/`Download` (isso continua sendo por mtime); ele só evita transferências
desnecessárias quando o conteúdo é idêntico.

**Justificativa**: menos tráfego e menos chamadas à API do Drive em cenários onde o
filesystem toca o mtime sem mudar bytes (comum em alguns emuladores). Calcular hash de
todo arquivo a cada scan seria caro; o pré-filtro só entra quando o mtime já diverge.

---

## Watcher de filesystem nativo, complementar ao watcher de processos

**Contexto**: o watcher de processos (abaixo) detecta abertura/fechamento do emulador, mas
não mudanças de arquivo em si — útil para outros sinais (ex.: save recém-escrito enquanto o
emulador já está rodando).

**Escolha**: um segundo watcher, baseado na crate `notify` (eventos nativos do SO), observa
as pastas monitoradas em paralelo ao watcher de processos baseado em `sysinfo`.

**Justificativa**: os dois mecanismos respondem a perguntas diferentes ("o processo está
rodando?" vs. "um arquivo mudou?") e são complementares, não substitutos um do outro.

---

## Instância única do app via `tauri_plugin_single_instance`

**Contexto**: o Slot2Sync vive na bandeja; abrir o executável de novo enquanto já está
rodando não deveria criar uma segunda instância (watchers e sync duplicados, conflito de
lock do SQLite).

**Escolha**: plugin oficial `tauri_plugin_single_instance`, que detecta a instância já
rodando e foca a janela existente em vez de subir um processo novo.

**Justificativa**: solução mantida pelo ecossistema Tauri, em vez de lock de arquivo manual
— menos código próprio para uma garantia que é essencialmente do SO.

---

## Versionamento e retenção de backups locais

**Contexto**: backups automáticos (primeiro sync, resolução de conflito) acumulam no disco
indefinidamente se nada os limitar.

**Escolha**: cada arquivo sobrescrito é arquivado com carimbo de data/hora num histórico
por emulador/categoria (`list_file_versions`/`restore_version`), com um número máximo de
versões configurável por arquivo e uma retenção em dias configurável para o conjunto.

**Justificativa**: dá ao usuário uma forma de desfazer manualmente uma sobrescrita sem
depender só do histórico de revisões do Drive, mantendo o crescimento de disco sob
controle via limites explícitos em vez de acúmulo indefinido.

---

## Limitação de banda e intervalo de scan configuráveis

**Contexto**: o Slot2Sync roda em segundo plano; usuários com conexões limitadas ou muitos
arquivos monitorados podem querer conter o impacto do sync automático.

**Escolha**: limites de upload/download em KB/s (0 = ilimitado) e intervalo do scan
periódico em minutos (0 = desativado), configuráveis pelo usuário e relidos a cada operação
sem precisar reiniciar o app.

**Justificativa**: dá controle ao usuário sobre o custo de rede/CPU do sync automático sem
exigir que ele desative gatilhos inteiros para isso.

---

## Padrões de exclusão por emulador

**Contexto**: nem todo arquivo sob as pastas monitoradas deve ser sincronizado — caches e
temporários específicos de um emulador não têm valor de save e infláveis desnecessariamente
o volume sincronizado.

**Escolha**: cada `EmulatorProfile` carrega `exclude_patterns` (glob), com um default por
emulador vindo do catálogo (`profiles.toml`) e editável pelo usuário por emulador.

**Justificativa**: mantém o filtro próximo de onde o perfil já é definido, em vez de uma
lista global — cada emulador tem seus próprios arquivos de cache/temporário.

---

## Process watcher: abertura imediata, fechamento com debounce

**Contexto**: o watcher de `sysinfo` ocasionalmente não lista um processo num tick, e
emuladores spawnam processos auxiliares — ambos causam flapping. Mas os dois gatilhos têm
urgências opostas.

**Escolha**: `EmulatorStarted` é emitido **no primeiro tick** em que o processo aparece;
`EmulatorStopped` só após alguns ticks consecutivos ausente. A máquina de estados
(`RunStateTracker::reconcile`) é pura, sem `sysinfo`.

**Justificativa**: baixar os saves do Drive (abertura → Drive → Local) deve acontecer o
quanto antes, antes de o jogo ler os arquivos — atraso aqui é prejudicial. Já declarar
"fechou" cedo demais dispararia um upload Local → Drive no meio de um flicker, então vale
esperar a confirmação. Separar a lógica pura do `sysinfo` torna o debounce 100% testável.
Alternativa (debounce simétrico) rejeitada por atrasar o download de abertura sem ganho.

---

## Watcher: `sysinfo` síncrono em `spawn_blocking`, estado dinâmico via SQLite

**Contexto**: `refresh_processes` é bloqueante; a spec pede loop `tokio::time::interval` +
`mpsc`. A lista de emuladores a monitorar muda em runtime (`add_emulator`/`remove_emulator`).

**Escolha**: o `System` e o `RunStateTracker` viajam para dentro de um `spawn_blocking` a
cada tick e voltam com os eventos; o produtor relê os emuladores do SQLite a cada tick.
Refresh com `ProcessRefreshKind::nothing()` (só o nome do processo).

**Justificativa**: mover o estado para o thread bloqueante mantém o runtime async livre sem
recriar o `System` (caro) a cada poll. Reler o SQLite a cada tick é barato (local, poucos
registros) e dispensa um canal extra de invalidação. O refresh mínimo mantém o tick leve.

---

## `rustls` em vez de OpenSSL

**Contexto**: o TLS padrão do reqwest exige OpenSSL do sistema.

**Escolha**: `reqwest` com `rustls-tls` e `default-features = false`.

**Justificativa**: TLS puro Rust, mesma stack em Windows/Linux/macOS, sem dependência de
biblioteca de sistema — melhor para distribuição, não só para o dev no WSL.

---

## Retry centralizado no transporte

**Contexto**: a regra exige retry exponencial (máx 3) em cada chamada ao Drive.

**Escolha**: um único `send_with_retry` em `drive/client.rs` por onde passa toda chamada;
a closure `build` reconstrói o request a cada tentativa.

**Justificativa**: evita espalhar lógica de retry por dezenas de chamadas. Trata 401
(renova token), 429/403-rate-limit/5xx e falha de rede de forma uniforme. Backoff
500ms/1s/2s + jitter. Concorrência de transferências limitada por semáforo lógico
(`buffer_unordered`).

---

## App vive na tray; fechar a janela ≠ sair

**Contexto**: o gatilho "sync ao fechar o Slot2Sync" precisa rodar de forma confiável.

**Escolha**: fechar a janela (`WindowEvent::CloseRequested`) apenas a esconde
(`prevent_close` + `hide`); o app continua na bandeja. O sync de despedida
(`TRIGGER_SHUTDOWN`) roda no handler do menu **"Sair"**, imediatamente antes de
`app.exit(0)`.

**Justificativa**: como fechar a janela só minimiza para a tray, o único caminho de saída
real passa pelo "Sair" — então o sync de despedida sempre executa. Coloquei o sync nesse
handler em vez do `RunEvent::ExitRequested` (a ideia inicial) porque é uma saída
intencional e controlável: evita a dança de `prevent_exit` + re-disparar o exit depois do
sync async. Todas as operações de tray/janela são feitas no Rust, então não exigem
permissões novas nas capabilities.

---

## Último sync em célula compartilhada

**Contexto**: a UI mostra o "último sync", mas o startup sync roda antes de a tela montar
e o estado do React se perde se o app reiniciar.

**Escolha**: `Arc<Mutex<Option<LastSync>>>` compartilhado entre o `SyncEngine` (escreve ao
concluir, **antes** de emitir `sync:completed`) e o `AppState` (lê via `get_last_sync`). A
UI busca no mount e atualiza ao vivo pelo evento.

**Justificativa**: cobre o mount tardio sem persistir nada (o estado é efêmero por
execução, e cada inicialização gera um sync novo de qualquer forma). Gravar antes de emitir
o evento garante que o `get_last_sync` disparado no `sync:completed` seja consistente.
Alternativa (nova tabela SQLite + migração) rejeitada por excesso para um dado volátil.

---

## Notificações de erro no backend

**Contexto**: a spec cita o plugin JS `@tauri-apps/plugin-notification` para erros críticos
de sync.

**Escolha**: disparar a notificação no **backend** (`NotificationExt` do Rust), no mesmo
ponto em que o engine emite `sync:error`.

**Justificativa**: o sync acontece no backend e precisa notificar mesmo quando a janela
está oculta (gatilhos de startup/watcher) ou durante o sync de despedida no shutdown,
quando o webview pode já não estar responsivo. Disparar do frontend dependeria do webview
vivo. O plugin continua inicializado no JS, então a alternativa pelo frontend segue
disponível se necessário.

---

## Tipos compartilhados espelhados manualmente

**Contexto**: drift entre struct Rust e interface TS quebra em runtime, não em compile time.

**Escolha**: espelhamento manual concentrado em `src/types/ipc.ts` (TS) e nas structs com
`#[serde(rename_all = "camelCase")]` (Rust), com testes de serialização.

**Justificativa**: para a quantidade de tipos do início do projeto, manual + testes era
suficiente e sem dependência extra. O drift do `file_busy` (encontrado numa revisão anterior
da documentação) mostrou o risco — daí os testes de serialização e a centralização num
arquivo só de cada lado. A boundary cresceu bastante desde então (dezenas de comandos hoje);
a decisão de migrar ou não para geração automática está registrada, em aberto, em
[Geração automática da boundary IPC](./geracao-automatica-ipc.md).

## Storage remoto generalizado atrás de um trait (`RemoteProvider`)

**Contexto**: o `SyncEngine` dependia de `DriveApi`, um trait já existente mas pensado só para
permitir mockar o Drive em teste — todo o resto do núcleo (schema do manifest, struct de
conflito, fluxo OAuth) assumia Google Drive como único backend possível, com nomes de
campo/coluna literalmente prefixados `drive_`.

**Escolha**: generalizar `DriveApi` para `remote::RemoteProvider` (mesmas operações, tipo de
retorno `RemoteFile` achatado e genérico em vez de aninhar o shape específico do Drive),
renomear os campos `drive_*` do manifest/conflito para `remote_*` (com migração de schema), e
parametrizar o `OAuthConfig`/`AuthManager` por provedor em vez de constantes fixas do Google.
Três novas implementações concretas do trait entraram no mesmo commit: Dropbox, OneDrive e uma
pasta local/de rede sem OAuth nenhum. Detalhes em
[Provedores de storage](../explicacao/provedores-de-storage.md).

**Justificativa**: a alternativa — deixar o Drive hardcoded e reabrir esse mesmo trabalho de
generalização quando um segundo provedor fosse pedido — teria custo maior depois do que agora,
porque o acoplamento só cresce (mais telas, mais campos, mais lugares citando "Drive"
explicitamente). Como o trait de injeção de dependência para teste já existia, generalizá-lo
era estrutural, não uma reescrita: o `DriveClient` continuou implementando o trait sem mudança
de comportamento, só de forma.

## Dropbox/OneDrive prontos no backend, desativados na UI até terem credenciais

**Contexto**: depois de implementar e testar os clientes Dropbox/OneDrive por completo, as
credenciais de produção (App Console do Dropbox, Azure App registrations) ainda não tinham
sido cadastradas. Deixar os botões clicáveis levaria a um fluxo OAuth que sempre falharia com
"credenciais não configuradas".

**Escolha**: manter os comandos `connect_dropbox`/`connect_onedrive` registrados na boundary
(o backend não muda), mas desativar os dois botões no seletor de provedor da tela de login,
com um rótulo "em breve" — em vez de escondê-los ou de criar uma branch separada sem esse
código.

**Justificativa**: duas alternativas foram descartadas. Esconder os botões por completo
jogaria fora a sinalização de que o suporte já existe e está a caminho. Criar uma branch nova
só com a generalização (sem Dropbox/OneDrive) evitaria qualquer código "desligado" no binário,
mas descartaria trabalho já pronto e testado só para reaplicá-lo depois — sem ganho real, já
que os comandos desativados falham graciosamente (erro de credencial ausente) se alguém os
chamar fora da UI, sem risco de segurança nem de dado corrompido.
