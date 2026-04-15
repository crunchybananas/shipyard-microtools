import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

// API key stored as a Firebase secret — never exposed to the client
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

interface GenerateRequest {
  model: string;
  messages: { role: string; content: string }[];
  system: string;
  maxTokens?: number;
}

/**
 * Authenticated Claude API proxy.
 *
 * - Requires Firebase Auth (only signed-in users can call)
 * - API key lives server-side in Firebase Secrets
 * - Tracks per-user token usage in Firestore
 * - Rate limits to prevent abuse
 */
export const generateDesign = onCall(
  {
    secrets: [anthropicApiKey],
    cors: true,
    enforceAppCheck: false,
    maxInstances: 10,
  },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to use AI generation");
    }

    const uid = request.auth.uid;
    const data = request.data as GenerateRequest;

    // Validate request
    if (!data.model || !data.messages || !data.system) {
      throw new HttpsError("invalid-argument", "Missing required fields: model, messages, system");
    }

    // Rate limit: check recent usage (max 30 requests per hour)
    const usageRef = db.collection("usage").doc(uid);
    const usageDoc = await usageRef.get();
    const now = Date.now();
    const hourAgo = now - 3600_000;

    if (usageDoc.exists) {
      const usage = usageDoc.data()!;
      const recentRequests: number[] = (usage.requestTimestamps ?? []).filter(
        (ts: number) => ts > hourAgo,
      );
      if (recentRequests.length >= 30) {
        throw new HttpsError(
          "resource-exhausted",
          "Rate limit exceeded — max 30 generations per hour",
        );
      }
    }

    // Call Anthropic API
    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      throw new HttpsError("internal", "API key not configured");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: data.model,
        max_tokens: data.maxTokens ?? 8192,
        system: data.system,
        messages: data.messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`Anthropic API error ${response.status}:`, err);
      throw new HttpsError("internal", `Claude API error: ${response.status}`);
    }

    const result = await response.json();

    // Track usage
    const inputTokens = result.usage?.input_tokens ?? 0;
    const outputTokens = result.usage?.output_tokens ?? 0;

    await usageRef.set(
      {
        totalInputTokens: FieldValue.increment(inputTokens),
        totalOutputTokens: FieldValue.increment(outputTokens),
        totalRequests: FieldValue.increment(1),
        requestTimestamps: FieldValue.arrayUnion(now),
        lastRequest: now,
      },
      { merge: true },
    );

    return {
      content: result.content,
      model: result.model,
      usage: result.usage,
    };
  },
);
