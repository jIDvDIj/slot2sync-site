# Privacidade e dados

## Acesso mínimo ao Google Drive

O RetroSync usa o escopo `drive.file` do Google Drive, o que significa que ele **só
enxerga os arquivos que ele próprio cria**. Ele não tem acesso ao resto do seu Drive —
suas fotos, documentos ou qualquer outra pasta permanecem invisíveis para o app.

## Onde seus arquivos ficam guardados

Tudo que o RetroSync sincroniza fica organizado numa pasta dedicada no seu Drive,
chamada `RetroSync`, com uma subpasta por emulador:

```
RetroSync/
  PPSSPP/
    saves/
    savestates/
  PCSX2/
    saves/
    savestates/
```

## Onde suas credenciais ficam guardadas

O token de acesso à sua conta Google **nunca fica em texto plano** e nunca é enviado
para nenhum servidor além do próprio Google — ele fica armazenado no cofre de
credenciais do seu sistema operacional (Windows Credential Manager, e equivalentes em
outras plataformas).

## O RetroSync nunca deleta seus arquivos

A sincronização é estritamente de adição e atualização. Nenhum arquivo é removido do
Drive pelo app, em nenhuma circunstância.
