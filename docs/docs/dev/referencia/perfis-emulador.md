# Referência — Perfis de emulador

Como o RetroSync reconhece emuladores e monta o `EmulatorProfile` que alimenta o sync.
Fonte de verdade: `src-tauri/src/emulator/mod.rs`, `profiles.rs` e `profiles.toml`.

## `EmulatorProfile`

```rust
pub struct EmulatorProfile {
    pub name: String,               // nome canônico, também nome da pasta no Drive
    pub root_path: PathBuf,         // pasta raiz selecionada pelo usuário
    pub saves_paths: Vec<PathBuf>,     // relativos a root_path
    pub config_paths: Vec<PathBuf>,    // relativos a root_path
    pub state_paths: Vec<PathBuf>,     // relativos a root_path
    pub exclude_patterns: Vec<String>, // padrões glob ignorados no sync (ex.: "*.tmp", "cache/**")
}
```

`exclude_patterns` vem com um default por emulador definido no catálogo, mas o usuário
pode editá-lo por emulador nas configurações (comando `set_exclude_patterns`).

## Catálogo declarativo (`profiles.toml`)

O RetroSync **não** tem um módulo Rust por emulador. Cada emulador conhecido é uma
entrada `[[emulator]]` em `src-tauri/src/emulator/profiles.toml`, embutida no binário
via `include_str!` e parseada uma vez (`OnceLock`). Campos:

| Campo | Uso |
| --- | --- |
| `name` | Nome canônico, usado como pasta no Drive. |
| `process_names` | Nomes de processo do SO, para o process watcher. |
| `base_candidates` | Candidatos a "base" relativos à raiz — o primeiro que existir é usado. Vazio = a própria raiz. |
| `required` | Pastas que TODAS precisam existir sob a base (E lógico). |
| `markers` | Pastas das quais AO MENOS UMA precisa existir sob a base (OU lógico). |
| `saves` / `states` / `config` | Pastas a sincronizar, relativas à base. |
| `exclude` | Padrões glob ignorados por padrão (ex.: temporários e cache do próprio emulador). |
| `data_dirs.{windows,macos,linux}` | Locais padrão de instalação, com placeholders (`{documents}`, `{localappdata}`, `{appdata}`, `{config}`, `{home}`) resolvidos via crate `dirs`. Usado pela descoberta automática. Inclui variantes Flatpak (Steam Deck/EmuDeck) no Linux. |
| `registry.uninstall_names` / `registry.app_paths` | Só Windows: confirmam instalação via registro mesmo sem pasta de dados ainda. |

Hoje o catálogo tem duas entradas, PPSSPP e PCSX2, cada uma com sua própria lógica de
base/marcadores (PPSSPP tem base relocável `PSP/` ou `memstick/PSP/`; PCSX2 exige
`inis/` e mais um marcador secundário) — é exatamente essa diferença que motivou os
campos `base_candidates`/`required`/`markers` serem independentes em vez de uma regra
única.

## Três caminhos para registrar um emulador

1. **Detecção automática numa pasta** (`detect_emulator`) — o usuário aponta uma pasta
   raiz; o backend testa cada spec do catálogo contra ela. `None` = nenhum casou.
2. **Descoberta automática de instalações** (`discover_emulators`) — varre os
   `data_dirs` do SO atual e, no Windows, o registro, para sugerir emuladores já
   instalados sem o usuário precisar apontar nada. Não persiste nada por si só; a UI
   ainda chama `add_emulator` com a raiz resolvida. Combina dois sinais independentes:
   pasta de dados encontrada (`DiscoverySource::DataDir`) e/ou confirmação via registro
   do Windows (`DiscoverySource::Registry`; os dois juntos são `Both`).
3. **Fallback manual** (`add_emulator_manual`) — para instalações portáteis ou
   emuladores fora do catálogo: o usuário informa nome e pastas (saves/savestates/config)
   relativas à raiz. Caminhos absolutos ou com `..` são rejeitados; ao menos uma
   categoria precisa ter pasta. Um emulador manual não tem `process_names`, então os
   gatilhos `emulator-start`/`emulator-stop` não disparam para ele — sync `manual` e
   `startup` continuam funcionando normalmente.

## Adicionar um emulador ao catálogo

Editar `profiles.toml` é a única mudança necessária para suportar um emulador novo que
siga o padrão de detecção por marcadores de filesystem — não é preciso escrever código
Rust. Passo a passo completo, com exemplo prático e checklist, em
[Como adicionar um emulador](../guias/como-adicionar-emulador.md).

Emuladores que não seguem esse padrão (sem marcadores de filesystem estáveis, ou com
lógica de detecção que não se encaixa em `base_candidates`/`required`/`markers`) exigem
mudança em `profiles.rs`, não só no TOML.
