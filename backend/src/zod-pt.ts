import { z } from 'zod';

// Mensagens padrão do Zod em português. Mensagens definidas no próprio schema (ex.: "Não pode ser negativo") têm prioridade.
z.setErrorMap((issue) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return { message: issue.received === 'undefined' ? 'Obrigatório' : 'Valor inválido' };
    case z.ZodIssueCode.too_small:
      return { message: 'Valor abaixo do mínimo permitido' };
    case z.ZodIssueCode.too_big:
      return { message: 'Valor acima do máximo permitido' };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: 'Opção inválida' };
    default:
      return { message: 'Valor inválido' };
  }
});
