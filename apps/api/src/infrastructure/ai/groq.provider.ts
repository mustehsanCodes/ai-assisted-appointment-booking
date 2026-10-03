import Groq from "groq-sdk";
import type { AiProvider, Extraction } from "../../modules/ai/ai.types.js";
import { extractionSchema } from "../../modules/ai/ai.types.js";

export class GroqProvider implements AiProvider {
  private client: Groq;
  constructor(
    key: string,
    private model: string,
    private timeoutMs: number,
  ) {
    this.client = new Groq({ apiKey: key, timeout: timeoutMs, maxRetries: 1 });
  }
  async extract(input: {
    message: string;
    draft: unknown;
    now: string;
    availabilityHint?: string;
  }): Promise<Extraction> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content: [
            "You help collect booking preferences for 30-minute consultations in Islamabad, Pakistan (PKT, UTC+05:00).",
            "Business hours: Monday–Friday 09:00–17:00 Islamabad time.",
            "CRITICAL: You NEVER create, confirm, approve, or finalize a booking. Chat only builds a draft.",
            "Never say: scheduled, booked, confirmed, approved, locked in, or 'I've booked/scheduled'.",
            "If the user says confirm/yes/final, reply that the draft is ready and they must submit it in the Manual Booking form,",
            "after which status becomes PENDING until an administrator approves.",
            "Always speak about Islamabad timing (not Karachi). List times as HH:mm PKT.",
            "Return JSON with intent BOOK|CHANGE|OTHER, nullable date YYYY-MM-DD, nullable time HH:mm,",
            "missing array, ambiguous array, and a short helpful reply (max 800 chars).",
            "When the user asks for available slots/dates, include concrete times from availabilityHint.",
            "Current time (ISO): " + input.now + ".",
            "Draft: " + JSON.stringify(input.draft) + ".",
            "Availability hint: " + (input.availabilityHint ?? "none"),
          ].join(" "),
        },
        { role: "user", content: input.message },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });
    return extractionSchema.parse(JSON.parse(response.choices[0]?.message.content ?? "{}"));
  }
}
