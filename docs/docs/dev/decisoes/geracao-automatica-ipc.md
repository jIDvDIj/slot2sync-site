# Geração automática da boundary IPC

**Status:** proposta, não implementada.

## Contexto

A boundary IPC do RetroSync exige sincronização manual de **três lugares** a cada mudança de
struct, enum ou evento: a struct Rust (`#[derive(Serialize, Deserialize)]` +
`#[serde(rename_all = "camelCase")]`), a interface TypeScript espelho em `src/types/ipc.ts`, e
o wrapper tipado de `invoke()` em `src/lib/ipc.ts`. Não há nenhuma verificação em tempo de
compilação — uma divergência produz `undefined` silencioso em runtime, detectável só por
teste manual ou crash na UI (ver [Referência — Boundary IPC](../referencia/boundary-ipc.md) e
a decisão "Tipos compartilhados espelhados manualmente" em [Decisões técnicas](./decisoes-tecnicas.md)).

A boundary cresceu bastante desde a análise original que embasa esta decisão: dezenas de
comandos hoje (confira `src-tauri/src/commands.rs`), o que torna o custo do espelhamento
manual mais alto do que quando a prioridade "média-baixa" abaixo foi atribuída — vale
reavaliar a urgência à luz do tamanho atual.

## Duas alternativas para o mesmo objetivo

Ambas visam eliminar a manutenção manual de `src/types/ipc.ts`, gerando-o a partir das
structs Rust. Nenhuma foi adotada ainda.

### `ts-rs`

Derive macro que gera um `.d.ts`/`.ts` por tipo anotado (`#[derive(TS)]`), sem integração
direta com o `Builder` do Tauri — só gera tipos, não comandos nem eventos. Mencionado
anteriormente em `decisoes-tecnicas.md` como "evolução possível" antes desta análise mais
aprofundada existir.

### `tauri-specta`

Plugin para Tauri que usa a crate `specta` para inspecionar tipos Rust em tempo de compilação
e gerar comandos, eventos e tipos tipados de uma vez — mais integrado ao ciclo de vida do
`Builder` que o `ts-rs` puro.

**Ganhos de qualquer uma das duas**: drift torna-se impossível por construção (hoje é
detectado em runtime, não em build); menor custo por comando/tipo novo (deixa de exigir
edição manual do lado TS); eventos e seus payloads também podem ser gerados
(`tauri-specta` cobre isso nativamente; `ts-rs` cobriria só os tipos de payload).

**Perdas/custos comuns**: dependência nova com histórico mais curto que o próprio Tauri
(mitigável — o projeto já usa outros plugins de terceiros, como `tauri-plugin-autostart` e
`tauri-plugin-single-instance`); todas as structs/enums da boundary precisam do derive
adicional (`#[derive(specta::Type)]` ou `#[derive(TS)]`) — trabalho de migração, não de
manutenção contínua; `src/types/ipc.ts` deixa de ser editável à mão (qualquer customização
precisa ir para o lado Rust); `src/lib/ipc.ts` (os wrappers de `invoke()`) continua manual em
ambos os casos — `tauri-specta` reduz mais essa fricção por gerar as assinaturas dos
comandos também, não só os tipos; `AppErrorPayload.code` é um caso especial (o shape
`{ code, message, detail }` é construído à mão em `error.rs` via `Serialize` customizado) e
precisaria ser revisitado para ficar compatível com geração automática, em qualquer das duas
ferramentas.

## Esforço de migração estimado

Adicionar a dependência (`Cargo.toml`); anotar as structs/enums da boundary com o derive
escolhido; ajustar `AppError` para gerar corretamente (ou manter o union `code` manual com
teste de regressão); criar o passo de geração e integrá-lo ao CI antes do `npm run build`;
remover `src/types/ipc.ts` do controle manual (gerado) e ajustar o `.gitignore` se for o caso.
Estimativa original: 4–8 horas de trabalho mecânico — sem risco de regressão funcional, é
infraestrutura de tipos.

## Recomendação

Vale adotar uma das duas — a escolha entre `ts-rs` (mais simples, só tipos) e `tauri-specta`
(mais completo, cobre comandos/eventos também) ainda não foi feita. Dado o tamanho atual da
boundary, a prioridade deveria subir de "média-baixa" (avaliação original) para algo a
resolver nas próximas mudanças estruturais da boundary, não indefinidamente adiado — cada
novo emulador ou feature adiciona comandos, e o custo da manutenção manual só cresce. O
momento ideal para migrar continua sendo o início de uma sprint de feature nova, para
amortizar o esforço junto com as anotações dos tipos novos.
