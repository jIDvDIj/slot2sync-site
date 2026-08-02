# Resolução de conflitos

## Quando acontece

Um conflito acontece quando **o mesmo arquivo mudou nos dois lados** — na máquina local
e no Drive — desde a última sincronização. É o caso, por exemplo, de jogar a mesma
partida em dois computadores sem sincronizar entre uma sessão e outra.

O RetroSync nunca decide sozinho nesse caso: ele pausa a sincronização **daquele
emulador específico** e avisa você por notificação nativa. Os demais emuladores, sem
conflito, continuam sincronizando normalmente.

## Como resolver

No card do emulador afetado aparece um botão **Resolver conflito**. Ao clicar, você vê
os dois lados — data, tamanho e o nome do dispositivo de origem de cada versão — e
escolhe qual manter:

- **Manter local** — a versão do computador atual é enviada por cima da versão no
  Drive.
- **Manter Drive** — a versão do Drive é baixada por cima da versão local. Antes disso
  acontecer, a versão local é movida para uma pasta de backup, então nada é perdido de
  verdade.

Depois de resolver, a sincronização daquele emulador é desbloqueada automaticamente.
