# Privacidade e dados

## Acesso mínimo ao Google Drive

O Slot2Sync usa o escopo `drive.file` do Google Drive, o que significa que ele **só
enxerga os arquivos que ele próprio cria**. Ele não tem acesso ao resto do seu Drive:
suas fotos, documentos ou qualquer outra pasta permanecem invisíveis para o app.

Se preferir não usar uma conta na nuvem, dá para escolher uma pasta local ou de rede
como armazenamento no lugar do Google Drive.

## Onde seus arquivos ficam guardados

Tudo que o Slot2Sync sincroniza fica organizado numa pasta dedicada, chamada
`Slot2Sync`, com uma subpasta por emulador:

```
Slot2Sync/
  PPSSPP/
    saves/
    savestates/
  PCSX2/
    saves/
    savestates/
```

## Onde suas credenciais ficam guardadas

O token de acesso à sua conta Google **nunca fica em texto plano** e nunca é enviado
para nenhum servidor além do próprio Google. No computador, ele fica no cofre de
credenciais nativo do sistema operacional (Windows Credential Manager, Keychain no
macOS, Secret Service no Linux).

## O Slot2Sync nunca deleta seus arquivos

A sincronização é estritamente de adição e atualização. Nenhum arquivo é removido do
armazenamento remoto pelo app, em nenhuma circunstância.
