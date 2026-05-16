# Acceptance Criteria — validate-conflict

- [ ] **Detecção de Exclusão Mútua**: "usuário faz login com email" vs "usuário faz login apenas com Google" → alerta de conflito.
- [ ] **Detecção de Negação**: "sistema envia email" vs "sistema não envia email" → alerta de conflito.
- [ ] **Report por Spec**: Mostra quais specs estão em conflito e o AC específico de cada uma.
- [ ] **Severity Configurável**: `config.json` permite definir `"validate-conflict": "error" | "warning" | "off"`.
- [ ] **Silêncio para Specs Irmãs**: Duas specs que compartilham prefixo (ex: `adapter-*`) têm tolerância maior.
