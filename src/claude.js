const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

const BRIEF_SYSTEM = 'You are a project intelligence assistant. Based on the following file structure, key files, recent commits, and open tasks, give me a concise 3-5 bullet brief covering: what has been built so far, what is currently in progress, and what needs attention next. Be specific and actionable. Format as plain bullet points, no markdown headers.';

const TASKS_SYSTEM = 'You are a task planning assistant. Given a project name and a goal, break it down into 3-6 specific, actionable tasks. Return ONLY the task texts, one per line. No numbering, no bullets, no extra text.';

function buildBriefUserMessage(context) {
  const fileContentsSummary = Object.entries(context.fileContents || {})
    .map(([name, content]) => `--- ${name} ---\n${content}`)
    .join('\n\n');

  const tasksSummary = (context.tasks || [])
    .map((t) => `[${t.status}] ${t.text}`)
    .join('\n');

  return `
Project: ${context.projectName}

File Structure:
${context.fileTree || 'No file tree available'}

Key Files:
${fileContentsSummary || 'No key files found'}

Recent Git Commits:
${context.gitLog || 'No git history'}

Current Tasks:
${tasksSummary || 'No tasks yet'}
`.trim();
}

async function anthropicChat(apiKey, system, userMessage, maxTokens) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });
  return response.content[0].text;
}

async function openaiChat(apiKey, system, userMessage, maxTokens) {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
  });
  return response.choices[0].message.content;
}

function chat(provider, apiKey, system, userMessage, maxTokens) {
  if (provider === 'openai') {
    return openaiChat(apiKey, system, userMessage, maxTokens);
  }
  return anthropicChat(apiKey, system, userMessage, maxTokens);
}

async function generateBrief(provider, apiKey, context) {
  const userMessage = buildBriefUserMessage(context);
  return chat(provider, apiKey, BRIEF_SYSTEM, userMessage, 500);
}

async function generateTasks(provider, apiKey, projectName, goal) {
  const userMessage = `Project: ${projectName}\nGoal: ${goal}`;
  const text = await chat(provider, apiKey, TASKS_SYSTEM, userMessage, 400);
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

module.exports = { generateBrief, generateTasks };
