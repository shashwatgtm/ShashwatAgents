import { describe, it, expect, vi } from 'vitest';
import * as server from '../netlify/mcp-server';

describe('B2B Agent', () => {

    describe('Prompts', () => {
        it('summarize_b2b_evidence prompt should return a valid JSON structure', async () => {
            const crawledContent = `
              Acme Corp is a leading provider of cloud-based solutions. Our flagship product, AcmeCloud,
              helps businesses scale their operations. A recent press release announced a new partnership
              with Globex Corporation. In a case study, a customer reported a 50% increase in efficiency.
              Our CEO, Jane Doe, was recently hired.
            `;

            const result = await server.summarizeB2bEvidenceHandler({ crawledContent });
            const messageContent = result.messages[0].content;

            if (typeof messageContent !== 'string' && messageContent.type === 'text') {
                const text = messageContent.text;

                // Find the JSON part of the prompt
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                expect(jsonMatch).not.toBeNull();

                if (jsonMatch) {
                    const json = JSON.parse(jsonMatch[0]);
                    expect(json).toHaveProperty('valueProposition');
                    expect(json).toHaveProperty('reasonsToBelieve');
                    expect(json).toHaveProperty('jobsToBeDone');
                    expect(json).toHaveProperty('abmTriggers');
                }
            } else {
                throw new Error('Unexpected message content format');
            }
        });

        it('deep_b2b_research prompt should return a markdown report', async () => {
            const findAndScrapeSpy = vi.spyOn(server.internal, 'findAndScrape');
            findAndScrapeSpy.mockResolvedValue('Some scraped content');

            const result = await server.deepB2bResearchHandler({ companyName: "Acme Corp", domain: "https://example.com" });
            const messageContent = result.messages[0].content;

            if (typeof messageContent !== 'string' && messageContent.type === 'text') {
                const text = messageContent.text;
                expect(text).toContain('B2B research report for Acme Corp');
                expect(text).toContain('Value Proposition');
                expect(text).toContain('Reasons to Believe');
                expect(text).toContain('Jobs to be Done');
                expect(text).toContain('ABM Triggers');
                expect(text).toContain('Overall Summary');
            } else {
                throw new Error('Unexpected message content format');
            }

            findAndScrapeSpy.mockRestore();
        }, 10000);
    });
});
