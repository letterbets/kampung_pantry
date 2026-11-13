import type { IncomingMessage, ServerResponse } from 'node:http';

export interface ServerlessRequest extends IncomingMessage {
  body?: unknown;
}

/**
 * Safely reads and parses a JSON request body in Vercel Node serverless functions,
 * using req.body if Vercel already parsed it or reading the raw stream otherwise.
 */
export async function readJsonBody(req: ServerlessRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Sends a clean JSON response with standard HTTP headers.
 */
export function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}
