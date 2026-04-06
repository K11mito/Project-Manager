const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const SYSTEM_PROMPT = `You are MAGI-04, the fourth supercomputer of the NERV project monitoring system, built to assist the pilot in managing active operations. You have full situational awareness of all registered units (projects), their tasks, briefs, and operational status. Respond in a clipped, direct, mission-control tone. Be concise unless detail is requested. Never use markdown headers. Use // to separate logical sections if needed. Address the user as PILOT.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task for a project',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'number', description: 'Project ID' },
          text: { type: 'string', description: 'Task description' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Task status' },
        },
        required: ['projectId', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update a task status (move between todo, in_progress, done)',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'number', description: 'Task ID' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'New status' },
        },
        required: ['taskId', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description: 'Delete a task from the system',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'number', description: 'Task ID to delete' },
        },
        required: ['taskId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trigger_scan',
      description: 'Trigger a deep scan of a project: file scan, git log, and regenerate AI brief',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'number', description: 'Project ID to scan' },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_brief',
      description: 'Get the most recent stored AI brief for a project',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'number', description: 'Project ID' },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prioritize_today',
      description: 'Scan all active projects and open tasks to determine what the pilot should work on today. Returns detailed project/task data for priority ranking.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

module.exports = function initMagi(db, scanner, claude, store, app) {
  function buildContext() {
    const projects = db.getAllProjects();
    const lines = ['// CURRENT SYSTEM STATE'];
    for (const p of projects) {
      const tasks = db.getTasksByProject(p.id);
      const todo = tasks.filter((t) => t.status === 'todo').length;
      const inProg = tasks.filter((t) => t.status === 'in_progress').length;
      const done = tasks.filter((t) => t.status === 'done').length;
      if (p.status === 'active') {
        const brief = p.brief
          ? p.brief.split('\n').find((l) => l.trim())?.replace(/^[-\u2022*]\s*/, '').slice(0, 150) || 'No brief'
          : 'No brief available';
        lines.push(`UNIT ${p.name} [ID:${p.id}] // STATUS: ACTIVE // TASKS: ${todo} todo, ${inProg} active, ${done} done // BRIEF: ${brief}`);
      } else {
        lines.push(`UNIT ${p.name} [ID:${p.id}] // STATUS: ${p.status.toUpperCase()}`);
      }
    }
    return lines.join('\n');
  }

  async function executeTool(toolCall) {
    const name = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    switch (name) {
      case 'create_task': {
        const task = db.addTask(args.projectId, args.text, args.status || 'todo');
        const project = db.getProject(args.projectId);
        return { success: true, task, projectName: project?.name };
      }
      case 'update_task': {
        db.updateTask(args.taskId, { status: args.status });
        const task = db.getTask(args.taskId);
        return { success: true, task };
      }
      case 'delete_task': {
        db.deleteTask(args.taskId);
        return { success: true };
      }
      case 'trigger_scan': {
        const project = db.getProject(args.projectId);
        if (!project || !project.folder_path) return { error: 'Project not found or no folder path' };
        const scanResult = await scanner.scanProject(project.folder_path);
        const aiProvider = store.get('aiProvider', 'anthropic');
        const apiKey = aiProvider === 'openai' ? store.get('openaiKey') : store.get('anthropicKey');
        if (apiKey) {
          try {
            const tasks = db.getTasksByProject(args.projectId);
            const brief = await claude.generateBrief(aiProvider, apiKey, {
              projectName: project.name,
              fileTree: scanResult.fileTree,
              fileContents: scanResult.fileContents,
              gitLog: scanResult.gitLog,
              tasks,
            });
            db.saveBrief(args.projectId, brief);
            return { success: true, projectName: project.name, brief };
          } catch (e) {
            return { success: true, projectName: project.name, scanComplete: true, briefError: e.message };
          }
        }
        return { success: true, projectName: project.name, scanComplete: true };
      }
      case 'get_brief': {
        const project = db.getProject(args.projectId);
        if (!project) return { error: 'Project not found' };
        return { projectName: project.name, brief: project.brief || 'No brief available', timestamp: project.brief_timestamp };
      }
      case 'prioritize_today': {
        const projects = db.getAllProjects().filter((p) => p.status === 'active');
        return {
          projects: projects.map((p) => {
            const tasks = db.getTasksByProject(p.id);
            const urgent = tasks.filter((t) => {
              if (!t.deadline || t.status === 'done') return false;
              const dl = new Date(t.deadline + (t.deadline.includes('T') ? '' : 'T23:59:59')).getTime();
              return (dl - Date.now()) / 36e5 < 72;
            });
            return {
              name: p.name, id: p.id,
              todo: tasks.filter((t) => t.status === 'todo').map((t) => ({ id: t.id, text: t.text, deadline: t.deadline })),
              inProgress: tasks.filter((t) => t.status === 'in_progress').map((t) => ({ id: t.id, text: t.text, deadline: t.deadline })),
              doneCount: tasks.filter((t) => t.status === 'done').length,
              urgentTasks: urgent.map((t) => ({ id: t.id, text: t.text, deadline: t.deadline, status: t.status })),
              briefSummary: p.brief ? p.brief.split('\n').find((l) => l.trim())?.slice(0, 100) : null,
              lastUpdated: p.updated_at,
            };
          }),
        };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  async function chat(messages) {
    const apiKey = store.get('openaiKey');
    if (!apiKey) throw new Error('MAGI-04 OFFLINE — OPENAI API KEY NOT CONFIGURED');

    const client = new OpenAI({ apiKey });
    const context = buildContext();
    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT + '\n\n' + context },
      ...messages,
    ];

    let response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: fullMessages,
      tools: TOOLS,
    });

    let msg = response.choices[0].message;

    // Tool call loop
    while (msg.tool_calls && msg.tool_calls.length > 0) {
      fullMessages.push(msg);
      for (const tc of msg.tool_calls) {
        const result = await executeTool(tc);
        fullMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
      }
      response = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: fullMessages,
        tools: TOOLS,
      });
      msg = response.choices[0].message;
    }

    return msg.content;
  }

  async function transcribe(audioBuffer) {
    const apiKey = store.get('openaiKey');
    if (!apiKey) throw new Error('OPENAI API KEY NOT CONFIGURED');

    const client = new OpenAI({ apiKey });
    const tmpPath = path.join(app.getPath('temp'), `whisper_${Date.now()}.webm`);
    fs.writeFileSync(tmpPath, Buffer.from(audioBuffer));

    try {
      const result = await client.audio.transcriptions.create({
        file: fs.createReadStream(tmpPath),
        model: 'whisper-1',
      });
      return result.text;
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (e) {}
    }
  }

  return { chat, transcribe };
};
