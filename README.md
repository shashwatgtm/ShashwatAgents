![Netlify Examples](https://github.com/netlify/examples/assets/5865/4145aa2f-b915-404f-af02-deacee24f7bf)

# MCP example Netlify Express

**View this demo site**: https://mcp-example-express.netlify.app/

[![Netlify Status](https://api.netlify.com/api/v1/badges/f15f03f9-55d8-4adc-97d5-f6e085141610/deploy-status)](https://app.netlify.com/sites/mcp-example-express/deploys)

## About this example site

This site showcases an advanced B2B research agent. The agent can perform a deep, multi-step analysis of a company in a single call, synthesizing information from a company's website into a comprehensive, actionable report.

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [Docs: Netlify Functions](https://docs.netlify.com/functions/overview/?utm_campaign=dx-examples&utm_source=example-site&utm_medium=web&utm_content=example-mcp-express)
- [Agent Experience (AX)](https://agentexperience.ax?utm_source=express-mcp-guide&utm_medium=web&utm_content=example-mcp-express)

## "Deep B2B Research" Workflow

The agent's primary workflow is the `deep_b2b_research` prompt. This powerful, "one-shot" prompt performs a complete B2B research task, from initial scraping to final analysis, in a single invocation.

**Workflow:**
1.  **Crawl & Scrape:** The agent crawls the target company's website, looking for pages with keywords like "case-study," "press-release," etc.
2.  **Extract Intelligence:** It then analyzes the scraped content to extract a structured JSON object containing the company's value proposition, reasons to believe, jobs to be done, and ABM triggers.
3.  **Synthesize Report:** Finally, it synthesizes this structured data into a comprehensive, markdown-formatted report.

**Example Interaction:**
1. **User:** "Please begin your research on Acme Corp (domain: acme.com)."
2. **Agent:** Returns a complete, markdown-formatted report:
   -   **Value Proposition:** What is their core offering?
   -   **Reasons to Believe:** What evidence supports their claims?
   -   **Jobs to be Done:** What problems do they solve for their customers?
   -   **ABM Triggers:** What recent events make them a good target for outreach?
   -   **Overall Summary:** A brief, high-level summary of the company.

## Other Workflows and Tools

The agent also has a number of other tools and workflows that can be used independently or as part of a larger task.

### "Corporate Intelligence" Workflow
- **`corporate_intelligence_report` prompt:** A single-call workflow that takes a company's domain, crawls its website for relevant pages, and returns a structured JSON object with a deep analysis of the company's value proposition, reasons to believe, jobs to be done, and ABM triggers.

## Speedily deploy your own version

Deploy your own version of this example site, by clicking the Deploy to Netlify Button below. This will automatically:

- Clone a copy of this example from the examples repo to your own GitHub account
- Create a new project in your [Netlify account](https://app.netlify.com/?utm_medium=social&utm_source=github&utm_campaign=devex-ph&utm_content=devex-examples), linked to your new repo
- Create an automated deployment pipeline to watch for changes on your repo
- Build and deploy your new site
- This repo can then be used to iterate on locally using `netlify dev`

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/netlify/examples/&create_from_path=examples/mcp/express-mcp&utm_campaign=dx-examples)

## Install and run the examples locally

You can clone this entire examples repo to explore this and other examples, and to run them locally.

```shell

# 1. Clone the examples repository to your local development environment
git clone git@github.com:netlify/examples

# 2. Move into the project directory for this example
cd examples/mcp/express-mcp

# 3. Install the Netlify CLI to let you locally serve your site using Netlify's features
npm i -g netlify-cli

# 4. Serve your site using Netlify Dev to get local serverless functions
netlify dev

# 5. While the site is running locally, open a separate terminal tab to run the MCP inspector or client you desire
npx @modelcontextprotocol/inspector npx mcp-remote@next http://localhost:8888/mcp

```
