# Referência — Status da portabilidade multiplataforma

> **Objetivo**: disponibilizar o Slot2Sync em **Windows, Linux, macOS, Steam Deck,
> Android e iOS**, a partir do app desktop Tauri v2. Esta página é a fonte única do
> status por fase.

## Estratégia

O Tauri v2 cobre as seis plataformas (desktop: Windows/macOS/Linux; mobile:
Android/iOS). O núcleo do Slot2Sync é agnóstico — o `SyncEngine` opera sobre
`SyncTarget` (rótulo + listas de caminhos) e não conhece emulador nem SO, o que torna a
portabilidade viável sem reescrever a lógica de sync.

A diferença essencial entre desktop e mobile não é linguagem/framework, é o **modelo de
acesso a arquivos e de gatilhos**:

| Aspecto | Desktop | Mobile (Android/iOS) |
| --- | --- | --- |
| Detecção de abrir/fechar emulador | `sysinfo` (process watcher) | Impossível (sandbox) — sync manual / ao abrir o app |
| Acesso aos saves de outro app | caminho de filesystem direto | Concessão explícita (SAF / Document Picker) |
| "Subir com o sistema" (autostart) | sim | não existe |
| Bandeja / janela escondível | sim | não existe (webview único) |
| Token OAuth | Keychain/Win/Secret Service | iOS Keychain / Android Keystore |
| Redirect do OAuth | loopback / proxy Worker | deep link (esquema de URI) |
| Provedor "pasta local/de rede" | sim (diálogo nativo de pasta) | não (nenhum caminho de filesystem direto sem SAF) |

Decisão de produto: no mobile o sync não precisa ser automático — o modelo é "configura
a pasta uma vez → sincroniza sob demanda".

## Status por fase

| Fase | Descrição | Status |
| --- | --- | --- |
| 0 — Compilação mobile (cfg gating) | `sysinfo`/autostart/tray/watcher isolados atrás de `#[cfg(desktop)]`; validado compilando para `aarch64-linux-android` via NDK. | ✅ Concluída |
| 1 — Desktop completo (Linux/Steam Deck/macOS) | Descoberta e perfis já são cross-platform (`data_dirs` por SO, incluindo caminhos Flatpak de Steam Deck/EmuDeck). Builds `.dmg`/`.deb`/AppImage já rodam via runners hospedados do GitHub Actions (`macos-latest`/`ubuntu-22.04` em `release.yml`) — não dependem de máquina própria. O que falta é notarização/assinatura Apple e o empacotamento Flatpak específico (o Tauri não gera Flatpak nativamente). | 🟡 Em andamento |
| 2 — Abstração de storage (`LocalStorage`/`FileLoc`) | Todo I/O do engine isolado atrás do trait; `DesktopStorage` implementa via `tokio::fs`. | ✅ Concluída |
| 3 — Scaffolding Android | SDK/NDK, `tauri android init`, APK debug em device físico. | ✅ Concluída |
| 4 — Plugin nativo de acesso a saves (SAF/bookmarks) | Lado Rust (`MobileStorage`, `PluginBridge`) pronto e validado por compilação Android. Esqueleto Kotlin (`StoragePlugin.kt`) escrito, não validado em device. iOS (Swift) não implementado. | 🟡 Interface Rust pronta |
| 5 — OAuth mobile (deep link) | Client OAuth Web único cobrindo desktop+Android via o proxy Worker (`/oauth/callback` + `MOBILE_REDIRECT_SUFFIX`), deep link `com.slot2sync.app:/oauth2redirect`. | ✅ Concluída |
| 6 — Keyring mobile (`SecretStore`) | Trait `SecretStore`; `KeyringStore` (desktop) e `SqliteSecretStore` (mobile, tabela `secrets`). | ✅ Concluída |
| 7 — Gatilhos e UI mobile | `resume`/`pause` como gatilhos de sync; `AddEmulatorModal`/`SettingsModal` adaptados por plataforma (`usePlatform`/`isMobile`). | ✅ Concluída |
| 8 — Empacotamento e distribuição mobile | APK assinado (`slot2sync.jks`) e job `android` no CI existem; secrets do GitHub ainda não cadastrados (`if: false` nos jobs `android`/`android-check`). iOS (App Store) não iniciado. | 🟡 Secrets pendentes |

## Onde rodar o quê

| Tarefa | Onde |
| --- | --- |
| `cargo check/test/clippy` (fases 0 e 2) | WSL (com `CARGO_TARGET_DIR`) |
| `tauri dev/build` desktop | Windows nativo (PowerShell) |
| `tauri android init/dev/build` | Linux/Windows/macOS com Android SDK/NDK |
| `tauri ios init/dev/build` | Somente macOS com Xcode |
| Empacotamento Flatpak / Steam Deck | Linux |
| Notarização macOS / assinatura iOS | macOS + conta Apple Developer |

## Riscos principais

- **Sandbox de armazenamento mobile**: se o emulador guardar saves em local inacessível
  (ex.: `Android/data/` no Android 11+, ou app iOS sem `UIFileSharingEnabled`), o sync
  vira import/export manual de arquivo. Varia por emulador.
- **Keyring Android**: sem suporte pronto na crate `keyring` — daí o `SecretStore`
  próprio via SQLite.
- **iOS**: custo de conta Apple Developer + revisão da App Store; prioridade menor que
  Android dado o sandbox mais rígido.
