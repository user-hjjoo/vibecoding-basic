import { z } from "zod";

export const maxForms = 30;
export const maxQuestions = 30;
export const maxFormText = 10000;
export const maxAnswer = 5000;
export const unknown = "확인 필요";
export const bases = ["공백 포함", "공백 제외", unknown] as const;
export const requirements = ["필수", "선택", unknown] as const;
export const questionFields = z.object({
  details: z.string(),
  prompt: z.string().trim().min(1),
  limit: z.union([z.number().int().positive(), z.enum(["제한 없음", unknown])]),
  basis: z.enum(bases),
  required: z.enum(requirements),
});
export type Fields = z.infer<typeof questionFields>;
export const splitResult = z.strictObject({ commonRequirements: z.string(), questions: z.array(questionFields.strict()).max(maxQuestions) });
export const emptyFields: Fields = { prompt: "", details: "", limit: unknown, basis: unknown, required: unknown };
export const charCount = (value: string) => Array.from(value).length;
export const takeChars = (value: string, limit: number) => Array.from(value).slice(0, limit).join("");
