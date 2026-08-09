# Como adicionar um novo idioma

O Slot2Sync hoje suporta **English** (padrão) e **Português (Brasil)**
(`src/i18n/locales/en/`, `src/i18n/locales/pt/`). A infraestrutura de i18n aceita um
idioma novo sem tocar nos componentes — veja [Internacionalização](../explicacao/internacionalizacao.md)
para o porquê do design. Passos:

1. Copiar `src/i18n/locales/pt/` → `src/i18n/locales/<codigo>/`.
2. Traduzir cada um dos cinco módulos (`common.ts`, `auth.ts`, `sync.ts`, `settings.ts`,
   `errors.ts`).
3. Registrar em `src/i18n/index.ts`:
   ```ts
   import { xx } from "./locales/xx/index";
   // SUPPORTED_LANGUAGES: adicionar { code: "xx", label: "...", locale: "xx-XX" }
   // resources: xx: { translation: xx }
   ```
4. Rodar `npm run i18n:check` — zero erros significa paridade de chaves garantida contra
   o locale `en` (fonte da verdade). O CI roda o mesmo check antes do build.

Cada `pt/*.ts` (e, pelo mesmo padrão, cada `<codigo>/*.ts` novo) é tipado contra o módulo
`en/*.ts` correspondente via `Localized<T>` — chave faltando ou sobrando é erro de
compilação do TypeScript, não algo descoberto em runtime.
