import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from "axios";
import { load } from "cheerio";
import {
  CallToolResult,
  GetPromptResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";


export const setupMCPServer = (): McpServer => {

  const server = new McpServer(
    {
      name: "stateless-server",
      version: "1.0.0",
    },
    { capabilities: { logging: {} } }
  );

  // Register a prompt template that allows the server to
  // provide the context structure and (optionally) the variables
  // that should be placed inside of the prompt for client to fill in.
  server.prompt(
    "greeting-template",
    "A simple greeting prompt template",
    {
      name: z.string().describe("Name to include in greeting"),
    },
    async ({ name }): Promise<GetPromptResult> => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please greet ${name} in a friendly manner.`,
            },
          },
        ],
      };
    }
  );

  // Register a tool specifically for testing the ability
  // to resume notification streams to the client
  server.prompt(
    "generate-abm-email-prompt",
    "Generates a prompt for a personalized B2B ABM email",
    {
      companyWebsiteText: z
        .string()
        .describe("The text content of the target company's website"),
      ourProductInfo: z
        .string()
        .describe("Information about our product"),
    },
    async ({
      companyWebsiteText,
      ourProductInfo,
    }): Promise<GetPromptResult> => {
      const PROMPT = `
        Based on the following information about a target company (scraped from their website)
        and our product, please generate a personalized B2B account-based marketing email.

        **Target Company Information:**
        ${companyWebsiteText}

        **Our Product Information:**
        ${ourProductInfo}

        **Instructions:**
        1. Start with a personalized opening that references something specific from the company's website.
        2. Clearly and concisely introduce our product and its key value proposition.
        3. Connect our product's features to the company's needs, based on the information provided.
        4. End with a clear call to action, suggesting a next step (e.g., a brief call, a demo).
        5. Keep the tone professional, respectful, and tailored to a B2B audience.
      `;
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: PROMPT,
            },
          },
        ],
      };
    }
  );

  server.tool(
    "scrape-website",
    "Scrapes a website and returns the text content",
    {
      url: z.string().url().describe("The URL to scrape"),
    },
    async ({ url }): Promise<CallToolResult> => {
      try {
        const { data } = await axios.get(url);
        const $ = load(data);
        const text = $("body").text();
        // simple text cleaning
        const cleanText = text.replace(/\s\s+/g, " ").trim();
        return {
          content: [
            {
              type: "text",
              text: cleanText,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error scraping website: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "start-notification-stream",
    "Starts sending periodic notifications for testing resumability",
    {
      interval: z
        .number()
        .describe("Interval in milliseconds between notifications")
        .default(100),
      count: z
        .number()
        .describe("Number of notifications to send (0 for 100)")
        .default(10),
    },
    async (
      { interval, count },
      { sendNotification }
    ): Promise<CallToolResult> => {
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      let counter = 0;

      while (count === 0 || counter < count) {
        counter++;
        try {
          await sendNotification({
            method: "notifications/message",
            params: {
              level: "info",
              data: `Periodic notification #${counter} at ${new Date().toISOString()}`,
            },
          });
        } catch (error) {
          console.error("Error sending notification:", error);
        }
        // Wait for the specified interval
        await sleep(interval);
      }

      return {
        content: [
          {
            type: "text",
            text: `Started sending periodic notifications every ${interval}ms`,
          },
        ],
      };
    }
  );

  // Create a resource that can be fetched by the client through
  // this MCP server.
  server.resource(
    "greeting-resource",
    "https://example.com/greetings/default",
    { mimeType: "text/plain" },
    async (): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: "https://example.com/greetings/default",
            text: "Hello, world!",
          },
        ],
      };
    }
  );
  return server;
};
