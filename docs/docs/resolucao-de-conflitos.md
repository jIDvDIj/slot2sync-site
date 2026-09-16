# Resolução de conflitos

## Quando acontece

Um conflito acontece quando **o mesmo arquivo mudou nos dois lados**, na máquina local
e no armazenamento remoto, desde a última sincronização. É o caso, por exemplo, de
jogar a mesma partida em dois computadores sem sincronizar entre uma sessão e outra.

O Slot2Sync nunca decide sozinho nesse caso: ele pausa a sincronização **daquele
emulador específico** e avisa você por notificação nativa. Os demais emuladores, sem
conflito, continuam sincronizando normalmente.

## Como resolver

Na página do emulador afetado aparece um aviso listando os arquivos em conflito. Para
cada um, você vê os dois lados, este dispositivo e o armazenamento remoto, com data,
tamanho e nome do dispositivo de origem, e escolhe qual manter clicando em **Manter
esta versão** do lado desejado:

- manter a versão deste dispositivo envia ela por cima da versão no armazenamento
  remoto;
- manter a versão remota baixa ela por cima da versão local. Antes disso acontecer, a
  versão local é guardada como backup, então nada é perdido de verdade (dá para abrir
  essa cópia pelo botão **Mostrar cópia local**).

Depois de resolver, a sincronização daquele emulador é desbloqueada automaticamente.
