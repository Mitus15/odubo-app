import { NextResponse } from 'next/server';
import { queryDatabase } from '@/lib/db';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

const openai = DEEPSEEK_API_KEY ? new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
}) : null;

async function getProjectContext(projectId: string): Promise<string> {
  const [projects, tasks, milestones, recentTimeline, notes] = await Promise.all([
    queryDatabase(
      `SELECT p.*, c.name as category_name, s.name as status_name
       FROM ark_projects p LEFT JOIN ark_categories c ON p.category_id = c.id LEFT JOIN ark_statuses s ON p.status_id = s.id
       WHERE p.id = ?`, [projectId]
    ),
    queryDatabase(
      `SELECT t.title, t.priority, t.due_date, t.scheduled_date, s.name as status, s.is_closed
       FROM ark_tasks t LEFT JOIN ark_statuses s ON t.status_id = s.id
       WHERE t.project_id = ? ORDER BY s.is_closed ASC, t.sort_order ASC LIMIT 30`, [projectId]
    ),
    queryDatabase(
      `SELECT m.title, m.target_date, s.name as status, s.is_closed,
        (SELECT COUNT(*) FROM ark_tasks WHERE milestone_id = m.id) as task_count,
        (SELECT COUNT(*) FROM ark_tasks t2 JOIN ark_statuses s2 ON t2.status_id = s2.id WHERE t2.milestone_id = m.id AND s2.is_closed = 1) as done_count
       FROM ark_milestones m LEFT JOIN ark_statuses s ON m.status_id = s.id
       WHERE m.project_id = ? ORDER BY m.sort_order ASC`, [projectId]
    ),
    queryDatabase(
      `SELECT entry_type, title, description, created_at FROM ark_timeline
       WHERE project_id = ? ORDER BY created_at DESC LIMIT 15`, [projectId]
    ),
    queryDatabase(
      `SELECT title, content, category FROM ark_notes WHERE project_id = ? ORDER BY is_pinned DESC, updated_at DESC LIMIT 5`, [projectId]
    ),
  ]);

  const project = projects?.[0];
  if (!project) return 'Project not found.';

  const objectives = project.objectives ? JSON.parse(project.objectives) : [];
  const today = new Date().toISOString().split('T')[0];

  let ctx = `PROJECT: "${project.title}"
Category: ${project.category_name || 'None'}
Status: ${project.status_name || 'Unknown'}
Priority: ${project.priority || 'medium'}
Charter: ${project.charter || 'Not defined'}
Objectives: ${objectives.length > 0 ? objectives.join('; ') : 'None defined'}
Start: ${project.start_date || 'Not set'} | Target: ${project.target_date || 'Not set'}
Progress: ${project.progress_percent || 0}%
Today: ${today}

MILESTONES (${(milestones || []).length}):
${(milestones || []).map((m: any) => `- ${m.title} [${m.status || 'no status'}] ${m.target_date ? `due ${m.target_date}` : ''} (${m.done_count}/${m.task_count} tasks done)`).join('\n') || 'None'}

TASKS (${(tasks || []).length}):
${(tasks || []).map((t: any) => `- ${t.title} [${t.status || 'no status'}] priority:${t.priority} ${t.due_date ? `due:${t.due_date}` : ''} ${t.scheduled_date ? `scheduled:${t.scheduled_date}` : ''}`).join('\n') || 'None'}

RECENT ACTIVITY:
${(recentTimeline || []).map((e: any) => `- [${e.entry_type}] ${e.title} (${e.created_at})`).join('\n') || 'No activity'}

NOTES:
${(notes || []).map((n: any) => `- ${n.title || 'Untitled'} [${n.category || 'general'}]: ${(n.content || '').substring(0, 100)}`).join('\n') || 'None'}`;

  return ctx;
}

const SYSTEM_PROMPT = `You are an AI project coach embedded in a project management tool called "The Ark". You have full context about the user's project — its charter, objectives, tasks, milestones, notes, and recent activity.

Your role is to help the user think clearly, plan effectively, and make progress. You're direct, practical, and encouraging. You understand creative projects (music, film, writing) as well as professional ones (tech, career, immigration).

When suggesting tasks or milestones, format them as actionable items the user can immediately add to their project.

Keep responses concise and focused. Use bullet points and clear structure.`;

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    if (!openai) {
      return NextResponse.json({ success: false, error: 'AI not configured (DEEPSEEK_API_KEY missing)' }, { status: 500 });
    }

    const { projectId } = await params;
    const body = await req.json();
    const { action, input } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 });
    }

    const projectContext = await getProjectContext(projectId);

    const actionPrompts: Record<string, string> = {
      'break_down': `Based on the project context below, break down the project objectives into a structured plan of milestones and tasks. For each milestone, list 3-7 specific, actionable tasks.

Format your response as:
## Milestone: [name]
- Task: [specific action]
- Task: [specific action]
...

${input ? `The user specifically wants to break down: "${input}"` : ''}`,

      'next_steps': `Based on the project's current state (completed tasks, open tasks, milestones, and deadlines), what should the user focus on next? Consider:
1. What's overdue or urgent
2. What's blocking progress
3. What's the highest-impact next action
4. What can be done today

Give 3-5 prioritized next steps with brief reasoning.`,

      'summarize': `Write a brief progress summary for this project. Include:
1. Overall status and progress percentage
2. What's been accomplished recently
3. What's coming up / upcoming deadlines
4. Any concerns or blockers
5. A motivational note

Keep it to 1-2 paragraphs.`,

      'think_through': `The user needs help thinking through something about this project.

User's question/challenge: "${input || 'How should I approach this project?'}"

Consider the full project context and provide thoughtful, practical advice. Think step by step.`,

      'plan_week': `Look at all open tasks, their priorities, and deadlines. Create a suggested weekly schedule:

For each day (Monday through Sunday), suggest 2-4 tasks the user should work on, based on:
1. Deadline proximity
2. Priority level
3. Logical task ordering (dependencies)
4. Not overloading any single day

Format as:
**Monday**: task 1, task 2
**Tuesday**: task 1, task 2
...`,
    };

    const actionPrompt = actionPrompts[action] || `${action}: ${input || ''}`;

    const response = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${projectContext}\n\n---\n\n${actionPrompt}` },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      stream: false,
    });

    const text = response.choices[0]?.message?.content || '';

    return NextResponse.json({ success: true, response: text, action });
  } catch (error) {
    console.error('Ark coach error:', error);
    return NextResponse.json({ success: false, error: 'AI request failed' }, { status: 500 });
  }
}
