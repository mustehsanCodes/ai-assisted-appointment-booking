import { z } from "zod";
export const extractionSchema = z
  .object({
    intent: z.enum(["BOOK", "CHANGE", "OTHER"]),
    date: z.string().nullable(),
    time: z.string().nullable(),
    missing: z.array(z.enum(["date", "time"])),
    ambiguous: z.array(z.string()),
    reply: z.string().min(1).max(800),
  })
  .strict();
export type Extraction = z.infer<typeof extractionSchema>;
export interface AiProvider {
  extract(input: {
    message: string;
    draft: unknown;
    now: string;
    availabilityHint?: string;
  }): Promise<Extraction>;
}
