# Acceptance Criteria — Validate Intelligence

- [x] **Verificação de Conteúdo Mínimo**: Specs com menos de 50 caracteres em Outcome são marcadas como FAIL.
- [x] **Consistência de Terminologia**: Se o glossary define um termo, a spec deve usá-lo.
- [x] **Detecção de Tom**: Specs marcadas como "formal" não devem conter gírias ou coloquialismos.
- [x] **Drift Temporal**: Alertar se a spec tem mais de 30 dias sem atualização.
- [x] **Seções Vazias**: Seções obrigatórias com conteúdo placeholder ou vazio são marcadas como FAIL.
- [x] **ACs sem Métrica**: ACs com verbos vagos ("melhorar", "otimizar") sem métrica numérica são marcados como FAIL.
- [x] **Baixa Confiança**: Spec contendo palavras de baixa confiança ("provavelmente", "talvez") é marcada como FAIL.
