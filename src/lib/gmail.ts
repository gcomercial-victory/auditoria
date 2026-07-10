import { google, gmail_v1 } from "googleapis";

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Credenciais do Google não configuradas (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)."
    );
  }
  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

function getGmailClient(): gmail_v1.Gmail {
  return google.gmail({ version: "v1", auth: getOAuth2Client() });
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  bodyText: string;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPlainText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    const plainPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (plainPart?.body?.data) return decodeBase64Url(plainPart.body.data);

    for (const part of payload.parts) {
      const nested = extractPlainText(part);
      if (nested) return nested;
    }

    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) return stripHtml(decodeBase64Url(htmlPart.body.data));
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    return stripHtml(decodeBase64Url(payload.body.data));
  }

  return "";
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function toSummary(message: gmail_v1.Schema$Message): GmailMessageSummary {
  const headers = message.payload?.headers;
  return {
    id: message.id ?? "",
    threadId: message.threadId ?? "",
    subject: getHeader(headers, "Subject"),
    from: getHeader(headers, "From"),
    date: getHeader(headers, "Date"),
    bodyText: extractPlainText(message.payload),
  };
}

export async function searchMessages(query: string, maxResults = 30): Promise<GmailMessageSummary[]> {
  const gmail = getGmailClient();
  const listRes = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
  const refs = listRes.data.messages ?? [];

  const results: GmailMessageSummary[] = [];
  for (const ref of refs) {
    if (!ref.id) continue;
    const msgRes = await gmail.users.messages.get({ userId: "me", id: ref.id, format: "full" });
    results.push(toSummary(msgRes.data));
  }
  return results;
}

export async function getThreadMessages(threadId: string): Promise<GmailMessageSummary[]> {
  const gmail = getGmailClient();
  const threadRes = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
  return (threadRes.data.messages ?? []).map(toSummary);
}
