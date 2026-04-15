import { test as base } from "@playwright/test";

/**
 * Mock response for the Anthropic API.
 * A minimal design with a few elements — enough to test the full flow
 * without hitting the real API.
 */
const MOCK_CLAUDE_RESPONSE = {
  id: "msg_mock_test",
  type: "message",
  role: "assistant",
  content: [
    {
      type: "text",
      text: JSON.stringify([
        // Hero Section
        {
          type: "frame",
          x: 0,
          y: 0,
          width: 1440,
          height: 500,
          fill: "#0f0f12",
          stroke: "transparent",
          name: "Home Page",
          cornerRadius: 0,
          elementRole: "container",
        },
        // Nav Bar
        {
          type: "rectangle",
          x: 0,
          y: 0,
          width: 1440,
          height: 64,
          fill: "#1a1a1f",
          stroke: "transparent",
          name: "NavBar",
          elementRole: "nav",
        },
        {
          type: "text",
          x: 40,
          y: 16,
          width: 160,
          height: 32,
          text: "Atelier",
          fontSize: 24,
          fontWeight: "700",
          fill: "#10b981",
          name: "Logo",
        },
        // Hero content
        {
          type: "text",
          x: 320,
          y: 140,
          width: 800,
          height: 64,
          text: "Design. Export. Ship.",
          fontSize: 56,
          fontWeight: "800",
          fill: "#ffffff",
          name: "Hero Title",
          elementRole: "heading",
        },
        {
          type: "text",
          x: 370,
          y: 220,
          width: 700,
          height: 32,
          text: "AI-powered design tool that exports working Ember apps",
          fontSize: 20,
          fontWeight: "400",
          fill: "#a1a1aa",
          name: "Hero Subtitle",
        },
        // CTA
        {
          type: "rectangle",
          x: 570,
          y: 290,
          width: 180,
          height: 48,
          fill: "#10b981",
          cornerRadius: 10,
          name: "CTA Button",
          elementRole: "button",
        },
        {
          type: "text",
          x: 610,
          y: 302,
          width: 100,
          height: 24,
          text: "Get Started",
          fontSize: 16,
          fontWeight: "600",
          fill: "#ffffff",
          name: "CTA Text",
        },
        {
          type: "rectangle",
          x: 770,
          y: 290,
          width: 180,
          height: 48,
          fill: "transparent",
          stroke: "#52525b",
          strokeWidth: 2,
          cornerRadius: 10,
          name: "Secondary CTA",
          elementRole: "button",
        },
        {
          type: "text",
          x: 810,
          y: 302,
          width: 100,
          height: 24,
          text: "Watch Demo",
          fontSize: 16,
          fontWeight: "500",
          fill: "#e4e4e7",
          name: "Secondary CTA Text",
        },
        // Feature cards
        {
          type: "rectangle",
          x: 120,
          y: 380,
          width: 380,
          height: 100,
          fill: "#1a1a1f",
          cornerRadius: 12,
          stroke: "#2a2a32",
          strokeWidth: 1,
          name: "Feature Card 1",
          elementRole: "card",
        },
        {
          type: "text",
          x: 140,
          y: 400,
          width: 340,
          height: 24,
          text: "One-Click Export",
          fontSize: 18,
          fontWeight: "600",
          fill: "#ffffff",
          name: "Feature 1 Title",
        },
        {
          type: "text",
          x: 140,
          y: 432,
          width: 340,
          height: 32,
          text: "Generate complete Ember apps with routes and components",
          fontSize: 14,
          fontWeight: "400",
          fill: "#71717a",
          name: "Feature 1 Desc",
        },
      ]),
    },
  ],
  model: "claude-haiku-4-5-20251001",
  usage: { input_tokens: 850, output_tokens: 420 },
};

/**
 * Extended test fixture that intercepts Anthropic API calls
 * so Playwright tests never hit the real API.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Intercept all Anthropic API calls and return mock data
    await page.route("https://api.anthropic.com/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CLAUDE_RESPONSE),
      });
    });
    await use(page);
  },
});

export { expect } from "@playwright/test";
