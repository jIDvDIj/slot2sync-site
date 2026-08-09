# Como adicionar suporte a um novo emulador

Vale para qualquer emulador que salve saves/savestates/config em pastas fixas e
identificáveis dentro de uma raiz — que é o caso comum. Se o emulador não seguir esse
padrão (schema não fixo, tudo num arquivo único etc.), veja a nota no final.

Pré-requisito: ambiente de dev rodando (veja [Onboarding](../tutoriais/onboarding.md)) e
familiaridade com os campos do catálogo em
[Referência — Perfis de emulador](../referencia/perfis-emulador.md).

## 1. Descubra os marcadores de filesystem do emulador

Instale o emulador, rode-o uma vez para ele criar sua estrutura de pastas, e identifique:

- A pasta raiz que o usuário vai apontar no Slot2Sync (ou, se o emulador só grava saves
  dentro da própria instalação, essa raiz).
- Uma **base** dentro dela — a pasta que efetivamente contém saves/config (às vezes é a
  própria raiz, às vezes uma subpasta como `PSP/` ou `memstick/PSP/` no PPSSPP).
- Marcadores: pastas cuja presença confirma "isto é uma instalação deste emulador" (ex.:
  `SAVEDATA/`, `inis/`). Evite marcadores genéricos demais (`config/`, `data/`) que possam
  casar com outro programa.
- As subpastas relativas à base onde ficam saves, savestates e configuração.

## 2. Adicione a entrada no catálogo

Edite `src-tauri/src/emulator/profiles.toml` e adicione um bloco `[[emulator]]`. Exemplo
ilustrativo, para um emulador fictício "SuperEmu" cuja base fica em `SuperEmu/` (relativa à
raiz apontada) ou, em instalação portátil, em `data/SuperEmu/`:

```toml
[[emulator]]
name = "SuperEmu"
process_names = ["SuperEmu.exe", "superemu"]
base_candidates = ["SuperEmu", "data/SuperEmu"]
markers = ["saves", "states"]
saves = ["saves"]
states = ["states"]
config = ["config"]
exclude = ["*.tmp", "cache/**"]
data_dirs.windows = ["{documents}/SuperEmu"]
data_dirs.macos = ["{home}/Library/Application Support/SuperEmu"]
data_dirs.linux = ["{config}/superemu"]
registry.uninstall_names = ["SuperEmu"]
registry.app_paths = ["SuperEmu.exe"]
```

Campos obrigatórios para o emulador funcionar via detecção numa pasta: `name`,
`process_names`, `markers` (ou `required`), `saves`/`states`/`config` (ao menos uma
categoria). `base_candidates` só é necessário se a base não for a própria raiz.
`exclude`, `data_dirs.*` e `registry.*` são opcionais — sem eles o emulador ainda funciona
via detecção numa pasta apontada ou fallback manual, só fica de fora da descoberta
automática (veja o passo 4).

Use `required` em vez de `markers` quando **todas** as pastas listadas precisam existir
(E lógico) — é o caso do PCSX2, que exige `inis/` obrigatoriamente e usa `markers` só para
o resto. `markers` é OU lógico: basta uma delas existir.

## 3. Escreva um teste de detecção

Em `src-tauri/src/emulator/mod.rs`, dentro de `mod tests`, adicione um teste que monta a
árvore mínima de marcadores num diretório temporário e confirma que `detect_emulator`
reconhece o novo perfil:

```rust
#[test]
fn detecta_superemu_em_pasta_de_dados() {
    let tmp = tempfile::tempdir().unwrap();
    mkdirs(tmp.path(), &["SuperEmu/saves", "SuperEmu/states"]);

    let profile = detect_emulator(tmp.path()).expect("deveria detectar SuperEmu");

    assert_eq!(profile.name, "SuperEmu");
    assert_eq!(
        profile.saves_paths,
        vec![Path::new("SuperEmu").join("saves")]
    );
}
```

Rode `cargo test --manifest-path src-tauri/Cargo.toml detecta_superemu` (com
`CARGO_TARGET_DIR` configurado — veja o Onboarding) para confirmar.

## 4. Habilite a descoberta automática (opcional)

Se preencheu `data_dirs`/`registry`, teste `discover_emulators` manualmente: instale o
emulador de verdade numa máquina (ou VM) sem apontar nada no Slot2Sync, abra o app e
confirme que ele aparece como sugestão. No Windows, `registry.uninstall_names` casa contra
o `DisplayName` das chaves de desinstalação — confira o nome exato na chave de registro do
instalador, não assuma que bate com o nome do processo.

## 5. Teste de ponta a ponta

1. Aponte manualmente a pasta raiz do emulador instalado na UI do Slot2Sync e confirme que
   ele é reconhecido (`add_emulator`/`detect_emulator`).
2. Rode um sync manual e confirme no Google Drive que a estrutura
   `Slot2Sync/SuperEmu/{saves,savestates,config}` foi criada e os arquivos certos foram
   enviados.
3. Abra e feche o emulador com o Slot2Sync rodando e confirme que os gatilhos automáticos
   (`emulator-start`/`emulator-stop`) disparam — o nome em `process_names` precisa bater
   exatamente com o processo do SO (case-insensitive, mas sem sufixos/prefixos extras).

## Checklist

- [ ] Entrada `[[emulator]]` em `profiles.toml` com marcadores inequívocos
- [ ] Teste de detecção em `emulator/mod.rs`
- [ ] Testado manualmente: detecção numa pasta, sync completo, gatilhos de processo
- [ ] `data_dirs`/`registry` preenchidos e testados, se aplicável

## Emuladores fora do padrão

Se o emulador não usa pastas fixas para saves/savestates/config (schema por jogo, tudo
num único arquivo binário, etc.), o catálogo declarativo não é suficiente — é preciso
estender a lógica de detecção em `src-tauri/src/emulator/profiles.rs` além de adicionar a
entrada no TOML. Isso está fora do escopo deste guia; veja a estrutura de
`EmulatorProfile` e `detect_emulator` em
[Referência — Perfis de emulador](../referencia/perfis-emulador.md) como ponto de partida.
