# Autenticação

Esta página descreve o fluxo OAuth2 usando o Google Drive como exemplo — é o provedor em
produção hoje. Dropbox e OneDrive passam pelo mesmo mecanismo, só com endpoints, escopo e o
formato de "quem sou eu" próprios de cada um (ver [Provedores de storage](./provedores-de-storage.md)
e [OAuthConfig parametrizado por provedor](#oauthconfig-parametrizado-por-provedor) abaixo). A
pasta local/de rede não usa nada disto — não tem autenticação nenhuma.

## Por que PKCE + escopo restrito ao app

O Slot2Sync é um app instalado (desktop e mobile), incapaz de guardar um client secret de
verdade — qualquer segredo embutido no binário é extraível. A segurança real vem do fluxo
**OAuth2 com PKCE** (RFC 7636): o `code_verifier` nunca trafega na URL de autorização, só o
`code_challenge` (SHA-256). Um `state` aleatório protege contra CSRF. É o padrão da indústria
para apps instalados (mesmo modelo de `rclone`, `gcloud` SDK).

No Google, o escopo pedido é `drive.file` + `openid email`: `drive.file` é **não-sensível** —
o app só enxerga arquivos/pastas que ele mesmo criou, nunca o resto do Drive do usuário — o
que evita o processo de verificação restrita do Google e reduz o risco para quem instala o
app. `openid email` só serve para mostrar a conta conectada na UI. Dropbox e OneDrive seguem
o mesmo princípio com seus próprios mecanismos de restrição (App Folder do Dropbox, pasta
especial `approot` do Microsoft Graph — ambos equivalentes ao `drive.file`, mas resolvidos
pelo **tipo de acesso do app** registrado no console, não por um parâmetro de escopo). Ver
[Decisões técnicas](../decisoes/decisoes-tecnicas.md#escopo-oauth-drivefile).

## Fluxo no desktop: loopback

```
1. Gera code_verifier (aleatório) + code_challenge = BASE64URL(SHA256(verifier))
2. Sobe um listener TCP em 127.0.0.1:porta-efêmera
3. Abre o navegador do sistema na tela de consentimento do Google
4. Usuário autoriza → Google redireciona para 127.0.0.1:porta?code=...&state=...
5. Valida o state (anti-CSRF), extrai o authorization code
6. Troca code + code_verifier por tokens
7. Salva o refresh token no armazenamento de segredos; mantém o access token em memória
```

O listener ignora requisições alheias ao fluxo (ex.: o `favicon.ico` que o navegador pede)
sem encerrar a espera, tem timeout de alguns minutos, e serve páginas HTML simples de
sucesso/erro para o usuário fechar a aba.

O tipo de cliente OAuth precisa ser compatível com **redirect loopback em porta arbitrária**
— só o tipo **Web application** com URIs específicas registradas (ver abaixo) cobre isso hoje;
um cliente Desktop-app clássico também aceitaria loopback, mas foi abandonado em favor de um
único client compartilhado com o mobile (próxima seção).

## Por que existe um proxy Cloudflare Worker

O Google exige um `client_secret` no token endpoint. Compilado no binário, ele é extraível de
uma release publicada e poderia ser abusado conforme a base de usuários cresce. A solução foi
mover a troca de token para um Cloudflare Worker minúsculo, que guarda o `client_secret` como
secret cifrado do Cloudflare — o app só conhece a URL pública do Worker e um `PROXY_SECRET`
compartilhado (header `X-Proxy-Secret`, que barra abuso casual da quota do Worker, não é um
segredo forte por si só, já que também está embutido no binário). O `client_secret` nunca entra
em nenhum artefato distribuído ou versionado; no CI, apenas `CLIENT_ID`, a URL do Worker e o
`PROXY_SECRET` são injetados. Um fallback de desenvolvimento local (chamar o Google direto com
um `client_secret` de dev, sem Worker) continua disponível. Ver
[Decisões técnicas](../decisoes/decisoes-tecnicas.md#proxy-worker-esconde-o-client_secret).

O **sync em si não passa pelo Worker** — só a troca/renovação de token. As chamadas à Drive
API saem direto do app com o `access_token`.

Esse Worker é uma particularidade do Google: Dropbox e a Microsoft (OneDrive) suportam PKCE
puro para apps nativos — cliente público, sem `client_secret` nenhum — então a troca de código
por token vai direto para o endpoint de cada um, sem proxy. Só o Google precisou desse desvio.

## Fluxo no mobile: deep link via o mesmo Worker

O Android não aceita redirect loopback (sandbox), e custom URI schemes puros (`slot2sync://`)
não funcionam bem com os tipos de cliente que o Google oferece para fluxo PKCE via navegador.
A solução final unifica desktop e mobile num único cliente OAuth do tipo **Web application**,
com duas URIs de redirect registradas: `http://127.0.0.1` (desktop) e a URL do Worker (Android).

No Android, o Worker ganhou um endpoint adicional (`GET /oauth/callback`, chamado pelo Google)
que responde com um redirect 302 para o deep link do app
(`com.slot2sync.app:/oauth2redirect?code=...`). O app registra o listener de deep link antes
de abrir o navegador (Custom Tab), recebe o código por aí, e troca o código pelo token chamando
o mesmo endpoint `/token` do Worker — o redirect URI mobile usado nessa troca é calculado em
runtime como `{url_do_worker}/oauth/callback`. Esse desenho substituiu uma primeira tentativa
com um client Android dedicado (rejeitada pelo Google para fluxo PKCE via navegador) — não há
mais variável de client ID separada para Android.

## `OAuthConfig` parametrizado por provedor

O que antes eram constantes fixas do módulo (`GOOGLE_AUTH_ENDPOINT`, `OAUTH_SCOPE`, ...) virou
campos de uma struct `OAuthConfig` (endpoint de autorização, endpoint de token, endpoint de
"quem sou eu", escopo, parâmetros extras da URL de autorização que pedem refresh token — cada
provedor tem sua própria convenção: Google usa `access_type=offline&prompt=consent`, Dropbox
usa `token_access_type=offline`, a Microsoft já cobre isso via o escopo `offline_access`). O
mecanismo de PKCE/loopback/deep-link em si (`authorize_interactive`, `exchange_code`,
`refresh_access_token`) não mudou — só passou a ler esses campos do `config` em vez de
constantes do Google hardcoded. `AuthManager::new_for(provider, ...)` monta o `OAuthConfig`
certo a partir das variáveis de ambiente daquele provedor.

## Armazenamento de tokens

- **Refresh token**: nunca em texto plano no disco fora de um cofre de segredos. A interface
  `SecretStore` (`src-tauri/src/secrets.rs`) abstrai onde ele mora: `KeyringStore` usa o
  cofre nativo do SO no desktop (Credential Manager/Keychain/Secret Service); `SqliteSecretStore`
  usa uma tabela dedicada no SQLite privado do app no mobile, onde a crate de keyring não tem
  suporte — inacessível a outros apps pelo sandbox do Android/iOS. Cada provedor OAuth grava
  numa chave própria do cofre (não existe uma única chave compartilhada) — trocar de provedor
  não sobrescreve nem invalida o refresh token de outro já conectado antes. A mesma interface
  também guarda o `device_id` estável usado na resolução de conflito (ver
  [Sincronização e conflitos](./sincronizacao-e-conflitos.md)).
- **Access token**: só em memória, renovado automaticamente antes de expirar; nunca persiste.
- **Tokens nunca cruzam a boundary IPC.** O frontend só recebe `AuthStatus { connected, email }`.

## Configuração de credenciais (desenvolvimento)

O `build.rs` lê um `.env` na raiz em build-time e injeta as variáveis `SLOT2SYNC_*` (shell tem
precedência sobre o arquivo). Sem `SLOT2SYNC_GOOGLE_CLIENT_ID` configurado, o app sobe
normalmente, mas conectar ao Drive retorna um erro explicativo — o mesmo vale para
`SLOT2SYNC_DROPBOX_CLIENT_ID`/`SLOT2SYNC_ONEDRIVE_CLIENT_ID`, hoje sem valor de produção
cadastrado (por isso os dois aparecem desativados na tela de login, ver
[Provedores de storage](./provedores-de-storage.md)). Passo a passo de criação das
credenciais em cada console e variáveis necessárias: veja o `.env.example` na raiz do
repositório e o [onboarding](../tutoriais/onboarding.md).
