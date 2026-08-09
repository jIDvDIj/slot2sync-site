# Autenticação

## Por que PKCE + `drive.file`

O Slot2Sync é um app instalado (desktop e mobile), incapaz de guardar um client secret de
verdade — qualquer segredo embutido no binário é extraível. A segurança real vem do fluxo
**OAuth2 com PKCE** (RFC 7636): o `code_verifier` nunca trafega na URL de autorização, só o
`code_challenge` (SHA-256). Um `state` aleatório protege contra CSRF. É o padrão da indústria
para apps instalados (mesmo modelo de `rclone`, `gcloud` SDK).

O escopo pedido é `drive.file` + `openid email`: `drive.file` é **não-sensível** — o app só
enxerga arquivos/pastas que ele mesmo criou, nunca o resto do Drive do usuário — o que evita
o processo de verificação restrita do Google e reduz o risco para quem instala o app.
`openid email` só serve para mostrar a conta conectada na UI. Ver
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

## Armazenamento de tokens

- **Refresh token**: nunca em texto plano no disco fora de um cofre de segredos. A interface
  `SecretStore` (`src-tauri/src/secrets.rs`) abstrai onde ele mora: `KeyringStore` usa o
  cofre nativo do SO no desktop (Credential Manager/Keychain/Secret Service); `SqliteSecretStore`
  usa uma tabela dedicada no SQLite privado do app no mobile, onde a crate de keyring não tem
  suporte — inacessível a outros apps pelo sandbox do Android/iOS. A mesma interface também
  guarda o `device_id` estável usado na resolução de conflito (ver
  [Sincronização e conflitos](./sincronizacao-e-conflitos.md)).
- **Access token**: só em memória, renovado automaticamente antes de expirar; nunca persiste.
- **Tokens nunca cruzam a boundary IPC.** O frontend só recebe `AuthStatus { connected, email }`.

## Configuração de credenciais (desenvolvimento)

O `build.rs` lê um `.env` na raiz em build-time e injeta as variáveis `SLOT2SYNC_*` (shell tem
precedência sobre o arquivo). Sem `SLOT2SYNC_GOOGLE_CLIENT_ID` configurado, o app sobe
normalmente, mas conectar ao Drive retorna um erro explicativo. Passo a passo de criação das
credenciais no Google Cloud Console e variáveis necessárias: veja o `.env.example` na raiz do
repositório e o [onboarding](../tutoriais/onboarding.md).
