import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from "axios";
import { load } from "cheerio";
import {
  CallToolResult,
  GetPromptResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";

export const internal = {
  findAndScrape: async (domain: string, keywords: string[]): Promise<string> => {
    const { data: homepageHtml } = await axios.get(domain);
    const $ = load(homepageHtml);
    const allLinks = $("a")
      .map((i, el) => $(el).attr("href"))
      .get();

    const targetLinks = allLinks
      .map((link) => {
        try {
          return new URL(link, domain).href;
        } catch (e) {
          return null;
        }
      })
      .filter(
        (link): link is string =>
          !!link &&
          link.startsWith(domain) &&
          keywords.some((keyword) => link.includes(keyword))
      );

    let combinedText = "";
    for (const link of [...new Set(targetLinks)]) {
      try {
        const { data: pageHtml } = await axios.get(link);
        const $$ = load(pageHtml);
        combinedText += `\n\n--- Content from ${link} ---\n\n${$$("body").text()}`;
      } catch (error) {
        console.warn(`Failed to scrape ${link}:`, error);
      }
    }

    return combinedText.replace(/\s\s+/g, " ").trim();
  }
};

export const summarizeB2bEvidenceHandler = async ({ crawledContent }): Promise<GetPromptResult> => {
  const PROMPT = `
    **Objective:** Analyze the provided corporate texts (case studies, press releases, etc.) and extract key B2B intelligence.

    **Crawled Content:**
    ${crawledContent}

    **Instructions:**
    Analyze the text and extract the following information. Respond with ONLY a valid JSON object.
    - **valueProposition:** What is the core value proposition offered to their customers?
    - **reasonsToBelieve:** What specific evidence, results, or customer quotes support their claims?
    - **jobsToBeDone:** What are the underlying "jobs to be done" that their customers are hiring their product for?
    - **abmTriggers:** Are there any recent events like new funding, product launches, or executive hires that could be used as triggers for outreach?

    **JSON Output Format:**
    {
      "valueProposition": "...",
      "reasonsToBelieve": ["...", "..."],
      "jobsToBeDone": ["...", "..."],
      "abmTriggers": ["...", "..."]
    }
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
};

export const deepB2bResearchHandler = async ({ companyName, domain }): Promise<GetPromptResult> => {
    const keywords = ['case-study', 'press-release', 'news', 'blog', 'customer-stories'];
    let cleanText = "";
    try {
        cleanText = await internal.findAndScrape(domain, keywords);
        if (!cleanText) {
            return {
                messages: [{ role: "assistant", content: { type: "text", text: `Could not find any relevant content on ${domain} for keywords: ${keywords.join(', ')}` } }],
            };
        }
    } catch (error) {
        return {
            messages: [{ role: "assistant", content: { type: "text", text: `Error crawling website: ${error.message}` } }],
        };
    }

    const intelPromptResult = await summarizeB2bEvidenceHandler({ crawledContent: cleanText });
    const intelContent = intelPromptResult.messages[0].content;
    let intelJson = {};
    if (typeof intelContent !== 'string' && intelContent.type === 'text') {
        const jsonMatch = intelContent.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                intelJson = JSON.parse(jsonMatch[0]);
            } catch(e) {
                // Ignore parsing errors, proceed with empty JSON
            }
        }
    }

    const synthesisPrompt = `
You are an expert B2B research assistant. Your task is to synthesize the provided corporate intelligence into a comprehensive report.

**Corporate Intelligence:**
${JSON.stringify(intelJson, null, 2)}

**Instructions:**
Based on the intelligence provided, please generate a detailed B2B research report for ${companyName}. The report should be in markdown format and include the following sections:
-   **Value Proposition:** What is their core offering?
-   **Reasons to Believe:** What evidence supports their claims?
-   **Jobs to be Done:** What problems do they solve for their customers?
-   **ABM Triggers:** What recent events make them a good target for outreach?
-   **Overall Summary:** A brief, high-level summary of the company.
`;

    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: synthesisPrompt,
                },
            },
        ],
    };
};

export const setupMCPServer = (): McpServer => {

  const server = new McpServer(
    {
      name: "stateless-server",
      version: "1.0.0",
    },
    { capabilities: { logging: {} } }
  );

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

  server.prompt(
    "deep_b2b_research",
    "Performs in-depth B2B research for a given company",
    {
      companyName: z.string().describe("The name of the company to research"),
      domain: z.string().url().describe("The domain of the company to research"),
    },
    deepB2bResearchHandler
  );

  server.prompt(
    "summarize_b2b_evidence",
    "Summarizes B2B evidence from crawled website content",
    {
      crawledContent: z
        .string()
        .describe(
          "The combined text content from the crawled pages (case studies, press releases, etc.)"
        ),
    },
    summarizeB2bEvidenceHandler
  );

  server.prompt(
    "corporate_intelligence_report",
    "Generates a corporate intelligence report for a given domain",
    {
      domain: z.string().url().describe("The domain of the company to research"),
    },
    async ({ domain }): Promise<GetPromptResult> => {
      const keywords = ['case-study', 'press-release', 'news', 'blog', 'customer-stories'];
      try {
        const cleanText = await internal.findAndScrape(domain, keywords);

        if (!cleanText) {
          return {
            messages: [{ role: "assistant", content: { type: "text", text: `Could not find any relevant content on ${domain} for keywords: ${keywords.join(', ')}` } }],
          };
        }
        return summarizeB2bEvidenceHandler({ crawledContent: cleanText });
      } catch (error) {
        return {
          messages: [{ role: "assistant", content: { type: "text", text: `Error crawling website: ${error.message}` } }],
        };
      }
    }
  );

  server.prompt(
    "identify-target-persona",
    "Identifies the best target persona based on structured company data",
    {
      companyData: z
        .string()
        .describe(
          "A JSON string of structured data about the target company"
        ),
      ourProductInfo: z
        .string()
        .describe("Information about our product"),
    },
    async ({
      companyData,
      ourProductInfo,
    }): Promise<GetPromptResult> => {
      const PROMPT = `
        **Objective:** Identify the best persona to target for B2B outreach.
        **Our Product Information:**
        ${ourProductInfo}
        **Target Company Data (JSON):**
        ${companyData}
        **Instructions:**
        1.  **Analyze:** Based on our product and the target company's data, determine which persona within the company would be the most receptive to our outreach.
        2.  **Suggest Persona:** Suggest a single, specific persona (e.g., "CTO", "Lead Developer", "Marketing Manager").
        3.  **Provide Reasoning:** Briefly explain your choice.
        **Respond with ONLY a valid JSON object in the following format:**
        {
          "suggestedPersona": "...",
          "reasoning": "..."
        }
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

  server.prompt(
    "extract-company-data",
    "Extracts structured data from a company's website text",
    {
      companyWebsiteText: z
        .string()
        .describe("The text content of the target company's website"),
    },
    async ({ companyWebsiteText }): Promise<GetPromptResult> => {
      const PROMPT = `
        **Objective:** Extract structured data from the following company website text.
        **Website Text:**
        ${companyWebsiteText}
        **Instructions:**
        Analyze the text and extract the following information. Respond with ONLY a valid JSON object.
        - **industry:** The primary industry the company operates in.
        - **keyProducts:** A list of the company's main products or services.
        - **recentInitiatives:** Any recent news, blog posts, or initiatives mentioned.
        - **targetAudience:** The likely target audience for their products/services.
        **JSON Output Format:**
        {
          "industry": "...",
          "keyProducts": ["...", "..."],
          "recentInitiatives": ["...", "..."],
          "targetAudience": "..."
        }
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

  server.prompt(
    "generate-b2b-outreach-content",
    "Generates personalized B2B outreach content for a specific persona and channel",
    {
      targetCompanyInfo: z
        .string()
        .describe(
          "A JSON string of structured data about the target company"
        ),
      ourProductInfo: z
        .string()
        .describe("Information about our product from our website"),
      buyingGroupPersona: z
        .string()
        .describe(
          "The persona of the buying group member (e.g., CTO, Marketing Manager)"
        ),
      channel: z
        .enum(["email", "linkedin", "whatsapp"])
        .describe("The communication channel for the outreach"),
    },
    async ({
      targetCompanyInfo,
      ourProductInfo,
      buyingGroupPersona,
      channel,
    }): Promise<GetPromptResult> => {
      const PROMPT = `
        **Objective:** Generate a personalized B2B outreach message.
        **Context:**
        - **Our Product:** ${ourProductInfo}
        - **Target Company:** ${targetCompanyInfo}
        - **Target Persona:** ${buyingGroupPersona}
        - **Channel:** ${channel}
        **Instructions:**
        1.  **Synthesize:** Read and understand both our product information and the target company's information. Identify potential synergies, pain points, and value propositions.
        2.  **Personalize for Persona:** Tailor the message specifically for the **${buyingGroupPersona}**.
            *   If they are technical (e.g., CTO, Lead Developer), focus on technical benefits, integration, and efficiency gains.
            *   If they are business-focused (e.g., Marketing Manager, CEO), focus on ROI, market advantage, and strategic value.
        3.  **Adapt for Channel (${channel}):**
            *   **Email:** Professional, well-structured, with a clear subject line, introduction, value proposition, and call to action. Keep it concise (3-4 short paragraphs).
            *   **LinkedIn:** Slightly more conversational. Start with a hook related to a shared connection or a recent company post. Keep it shorter than an email. End with a soft call to action, like "Would you be open to connecting?"
            *   **WhatsApp:** Very informal and direct. Use this only if a prior connection exists. The message should be very short, reference a specific, timely event, and ask a direct question.
        4.  **Generate Content:** Based on the above, generate the outreach message.
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
    "find_and_scrape_pages",
    "Finds and scrapes specific pages on a website based on keywords",
    {
      domain: z.string().url().describe("The base URL of the website to crawl"),
      keywords: z
        .array(z.string())
        .describe(
          "A list of keywords to find in the URLs (e.g., 'case-study', 'press-release')"
        ),
    },
    async ({ domain, keywords }): Promise<CallToolResult> => {
      try {
        const cleanText = await internal.findAndScrape(domain, keywords);
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
              text: `Error crawling website: ${error.message}`,
            },
          ],
        };
      }
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
