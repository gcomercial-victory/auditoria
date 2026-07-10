import Anthropic from "@anthropic-ai/sdk";
import type { FieldType } from "@prisma/client";

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cachedClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

export interface ExtractableField {
  label: string;
  type: FieldType;
}

export type ExtractedValues = Record<string, string | number | boolean>;

const JSON_TYPE: Record<FieldType, "string" | "number" | "boolean"> = {
  BOOLEAN: "boolean",
  NUMBER: "number",
  TEXT: "string",
};

// Uses Claude with a forced tool call to get strict, schema-validated JSON back
// instead of parsing free-form text.
export async function extractFieldsFromText(
  emailText: string,
  fields: ExtractableField[]
): Promise<ExtractedValues> {
  if (fields.length === 0 || !emailText.trim()) return {};

  const properties: Record<string, { type: string; description: string }> = {};
  for (const field of fields) {
    properties[field.label] = {
      type: JSON_TYPE[field.type],
      description: `Valor do campo "${field.label}", se estiver claramente presente no texto.`,
    };
  }

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content:
          "Extraia os campos abaixo do texto de um e-mail de logbook/auditoria de recepção de hotel. " +
          "Só inclua um campo se a informação estiver claramente presente no texto — não invente ou estime valores. " +
          "Para campos numéricos, extraia apenas o número (sem texto junto). " +
          "Para campos de texto, resuma de forma objetiva usando as informações do próprio e-mail.\n\n" +
          `Texto do e-mail:\n\n${emailText}`,
      },
    ],
    tools: [
      {
        name: "extracted_fields",
        description: "Campos extraídos do e-mail de logbook/auditoria.",
        input_schema: {
          type: "object",
          properties,
        },
      },
    ],
    tool_choice: { type: "tool", name: "extracted_fields" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return {};
  return (toolUse.input ?? {}) as ExtractedValues;
}
