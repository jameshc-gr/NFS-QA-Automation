import { Anthropic } from '@anthropic-ai/sdk';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface GenerateTestInput {
  jiraKey: string;
  jiraSummary: string;
  jiraDescription: string;
}

export async function generatePlaywrightSpec(input: GenerateTestInput): Promise<{ filePath: string; code: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required to generate tests.');
  }

  const anthropic = new Anthropic({ apiKey });
  const promptPath = path.resolve(process.cwd(), 'ai/agents/agents/test_generator/prompt.md');
  const promptTemplate = readFileSync(promptPath, 'utf8');

  const prompt = [
    promptTemplate,
    '',
    'JIRA ticket',
    `- Key: ${input.jiraKey}`,
    `- Summary: ${input.jiraSummary}`,
    '- Description:',
    input.jiraDescription
  ].join('\n');

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-0',
    max_tokens: 2400,
    messages: [{ role: 'user', content: prompt }]
  });

  const firstTextBlock = response.content.find((block) => block.type === 'text');
  const generated = firstTextBlock && 'text' in firstTextBlock ? firstTextBlock.text : '';
  if (!generated.trim()) {
    throw new Error('Model returned empty test content.');
  }

  const generatedDir = path.resolve(process.cwd(), 'tests/projects/student-loan-refi/generated');
  mkdirSync(generatedDir, { recursive: true });
  const safeName = input.jiraKey.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const filePath = path.join(generatedDir, `${safeName}.spec.ts`);

  writeFileSync(filePath, generated.trim() + '\n', 'utf8');
  return { filePath, code: generated.trim() };
}
