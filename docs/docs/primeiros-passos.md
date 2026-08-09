# Primeiros passos

## 1. Conecte sua conta Google

Abra o Slot2Sync e clique em **Conectar conta Google**. Você será levado à tela padrão
de login do Google — o Slot2Sync pede apenas o escopo mínimo (`drive.file`), o que
significa que ele **só enxerga os arquivos que ele mesmo cria** no seu Drive. O resto do
seu Drive permanece invisível para o app.

## 2. Aponte a pasta do seu emulador

Clique em **Adicionar emulador** e selecione a pasta raiz do emulador instalado na sua
máquina (ex.: a pasta de instalação do PPSSPP ou do PCSX2). O Slot2Sync reconhece
sozinho qual emulador é, a partir de arquivos e pastas característicos daquela
instalação.

## 3. Esqueça que ele existe

A partir daqui, o Slot2Sync fica rodando na bandeja do sistema (perto do relógio) e
sincroniza sozinho, nos momentos certos:

- ao abrir o Slot2Sync;
- ao abrir um emulador configurado (baixa os saves mais recentes antes do jogo começar);
- ao fechar um emulador configurado (envia o progresso novo para o Drive);
- ao sair do Slot2Sync pelo menu da bandeja.

Veja todos os gatilhos e como ajustá-los em [Sincronização](sincronizacao.md).

## Fechar a janela não fecha o app

Fechar a janela principal só a esconde — o Slot2Sync continua rodando na bandeja para
poder sincronizar quando o emulador abrir ou fechar. Para sair de verdade, use o item
**Sair** no menu da bandeja.
