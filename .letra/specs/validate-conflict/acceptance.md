## Acceptance Criteria

- [x] **Detecção de Exclusão Mútua**: "usuário faz login com email" vs "usuário faz login apenas com Google" → alerta de conflito.
- [x] **Detecção de Negação**: "sistema envia email" vs "sistema não envia email" → alerta de conflito.
- [x] **Report por Spec**: Mostra quais specs estão em conflito e o AC específico de cada uma.
- [x] **Severity Configurável**: `config.json` permite definir `"validate-conflict": "error" | "warning" | "off"`.
- [x] **Silêncio para Specs Irmãs**: Duas specs que compartilham prefixo (ex: `adapter-*`) têm tolerância maior (assume-se que são complementares).
