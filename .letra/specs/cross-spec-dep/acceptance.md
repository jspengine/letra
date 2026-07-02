## Acceptance Criteria

- [x] **Inferência de dependência**: Detecta referências entre specs via IDs e paths de API
- [x] **Grafo temporal**: Compara `updatedAt` entre specs dependentes
- [x] **Alerta de drift**: Se spec B mudou depois de spec A referenciá-la, sugere revisão de A
- [x] **Testes**: Spec A referencia B, B alterado → alerta; B não alterado → silêncio
