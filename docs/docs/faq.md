# FAQ

**O RetroSync tem acesso a todo o meu Google Drive?**

Não. Ele usa o escopo `drive.file`, que só permite enxergar os arquivos que ele mesmo
cria. Veja mais em [Privacidade e dados](privacidade-e-dados.md).

**Ele apaga arquivos no Drive?**

Nunca. A sincronização só adiciona e atualiza arquivos.

**Preciso deixar o RetroSync aberto o tempo todo?**

Sim, no sentido de que ele precisa estar rodando (na bandeja do sistema) para detectar
quando um emulador abre ou fecha e sincronizar automaticamente. Fechar a janela não
encerra o app — só o item **Sair** da bandeja faz isso.

**O que acontece se eu editar o mesmo save em duas máquinas sem sincronizar entre uma
sessão e outra?**

Vira um conflito explícito — o RetroSync nunca escolhe sozinho qual versão manter. Veja
[Resolução de conflitos](resolucao-de-conflitos.md).

**Funciona sem internet?**

A sincronização em si precisa de internet para falar com o Drive, mas o app não trava
sem conexão — sem rede vira uma pendência resolvida automaticamente quando a conexão
voltar.

**Quais emuladores são suportados hoje?**

Veja [Emuladores suportados](emuladores-suportados.md) e como sugerir um
novo.

**O código é aberto?**

Sim, licenciado sob GPL-3.0-or-later — o
[repositório está no GitHub](https://github.com/jIDvDIj/retro-sync).
