# Solução de problemas

## O Windows bloqueou o instalador (SmartScreen)

Normal para aplicativos de desenvolvedores independentes sem certificado de assinatura
de código pago. Clique em **Mais informações → Executar assim mesmo**. O código-fonte é
público — veja o [repositório no GitHub](https://github.com/jIDvDIj/retro-sync) se
quiser conferir o que está sendo instalado.

## O RetroSync não detectou meu emulador

Confirme que apontou para a **pasta raiz de instalação** do emulador, não uma subpasta
específica. Se o emulador estiver instalado corretamente e mesmo assim não for
detectado, [abra uma issue](https://github.com/jIDvDIj/retro-sync/issues) informando o
emulador, a versão e o sistema operacional.

## Meu save não sincronizou

1. Confira se o gatilho relevante está ligado em **Configurações → Sincronização** (veja
   [Sincronização](sincronizacao.md#gatilhos-automaticos)).
2. Confira se aquele emulador não está com um
   [conflito pendente](resolucao-de-conflitos.md) — enquanto houver conflito, a
   sincronização automática daquele emulador fica pausada.
3. Sem internet? A sincronização vira uma pendência e é retomada automaticamente assim
   que a conexão voltar.

## Fechei a janela e o app "desapareceu"

Ele não fechou — fechar a janela só a esconde, para o RetroSync continuar rodando na
bandeja do sistema e sincronizando quando o emulador abrir ou fechar. Procure o ícone
perto do relógio do Windows. Para sair de verdade, use **Sair** no menu da bandeja.

## Nenhuma dessas resolveu

[Abra uma issue no GitHub](https://github.com/jIDvDIj/retro-sync/issues) descrevendo o
problema, com a versão do RetroSync e do sistema operacional. Se for uma vulnerabilidade
de segurança, siga o processo de divulgação responsável em
[`SECURITY.md`](https://github.com/jIDvDIj/retro-sync/blob/main/SECURITY.md) em vez de
abrir uma issue pública.
