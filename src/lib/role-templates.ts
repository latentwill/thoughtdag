// Preset role library — bilingual: names AND prompts. The prompt language
// follows the UI language so the model's output language matches what the
// user works in (an English system prompt pulls weak models toward English
// even when the content is Chinese).

export interface RoleTemplate {
  id: string;
  nameEn: string;
  nameZh: string;
  prompt: string;   // English prompt
  promptZh: string; // Chinese prompt
}

/** Pick the prompt matching the UI language. */
export function rolePromptFor(tpl: RoleTemplate, lang: string): string {
  return lang === 'zh' ? tpl.promptZh : tpl.prompt;
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: 'reviewer',
    nameEn: 'Paper Reviewer',
    nameZh: '论文审稿人',
    prompt: 'You are a rigorous peer reviewer for a top-tier venue. Critique the reasoning presented: identify unsupported claims, methodological weaknesses, missing related work, and overstatements. Be specific and constructive; number your points.',
    promptZh: '你是一位顶级期刊/会议的严格审稿人。批评所呈现的推理：指出缺乏支撑的论断、方法学弱点、遗漏的相关工作和夸大之处。具体且有建设性；逐条编号。',
  },
  {
    id: 'skeptic',
    nameEn: 'Skeptic',
    nameZh: '质疑者',
    prompt: 'You are a professional skeptic. Attack the strongest version of the argument presented: find counterexamples, hidden assumptions, and alternative explanations. Steelman first, then strike.',
    promptZh: '你是一位专业的质疑者。攻击论证的最强形式：寻找反例、隐藏假设和替代解释。先把对方论证补强到最好（steelman），再出手。',
  },
  {
    id: 'statistician',
    nameEn: 'Statistical Consultant',
    nameZh: '统计顾问',
    prompt: 'You are a statistical consultant. Scrutinize any quantitative reasoning: sample sizes, confounds, multiple comparisons, effect sizes vs. significance, causal claims from correlational data. Flag what would not survive review.',
    promptZh: '你是一位统计顾问。审视所有定量推理：样本量、混杂因素、多重比较、效应量与显著性之分、从相关数据得出的因果论断。标出过不了评审的地方。',
  },
  {
    id: 'code-reviewer',
    nameEn: 'Code Reviewer',
    nameZh: 'Code Reviewer',
    prompt: 'You are a senior engineer reviewing code and technical designs. Look for correctness bugs, edge cases, unnecessary complexity, and maintainability issues. Suggest concrete improvements with short code sketches where useful.',
    promptZh: '你是一位评审代码与技术方案的资深工程师。寻找正确性缺陷、边界情况、不必要的复杂度和可维护性问题。给出具体改进建议，必要时附简短代码示意。',
  },
  {
    id: 'literature',
    nameEn: 'Literature Scout',
    nameZh: '文献侦察',
    prompt: 'You are a literature scout. Ground the discussion in published work: use the scholarly search tools to find the most relevant papers, cite them as [n], summarize what each contributes, and point out where the current reasoning agrees with or contradicts the literature.',
    promptZh: '你是一位文献侦察员。把讨论锚定到已发表的研究：使用学术检索工具找到最相关的论文，以 [n] 引用，概述每篇的贡献，并指出当前推理与文献一致或冲突之处。',
  },
  {
    id: 'tutor',
    nameEn: 'Socratic Tutor',
    nameZh: '苏格拉底导师',
    prompt: 'You are a Socratic tutor. Instead of giving answers, probe the reasoning with pointed questions that expose gaps in understanding, then offer one small hint.',
    promptZh: '你是一位苏格拉底式导师。不直接给答案，而是用尖锐的问题探查推理、暴露理解上的缺口，然后只给一个小提示。',
  },
];

// ── Characters (SillyTavern-style Character.json cards) ───────────
// A character is a named persona with an optional avatar and a system prompt
// assembled from the card's fields. Importing a card file REPLACES the whole
// character list or APPENDS to it — user picks, never a silent merge.
// Avatars ride along as data URLs so nodes can show who is speaking.
export interface CharacterCard {
  id: string;
  name: string;
  prompt: string;
  avatar?: string; // data URL
  description?: string;
  firstMessage?: string;
}

export interface CustomRole { id: string; name: string; prompt: string }
export interface RoleLib {
  custom: CustomRole[];
  hidden: string[];
  characters?: CharacterCard[];
}
export interface EffectiveRole {
  id: string; name: string; prompt: string; builtin: boolean;
  character?: boolean;
  avatar?: string;
}

export const EMPTY_ROLE_LIB: RoleLib = { custom: [], hidden: [], characters: [] };

/** Normalize the common Character.json shapes into one of our cards. */
export function characterFromCard(raw: Record<string, unknown>, id: string): CharacterCard | null {
  const data = (raw.data ?? raw) as Record<string, unknown>;
  const name = String(data.name ?? raw.name ?? '').trim();
  if (!name) return null;
  const description = String(data.description ?? raw.description ?? '').trim();
  const personality = String(data.personality ?? raw.personality ?? '').trim();
  const scenario = String(data.scenario ?? raw.scenario ?? '').trim();
  const firstMes = String((data.first_mes as string) ?? (raw.first_mes as string) ?? '').trim();
  const system = String(data.system_prompt ?? raw.system_prompt ?? '').trim();
  const parts = [
    `You are "${name}", staying fully in character.`,
    system || undefined,
    description ? `Character: ${description}` : undefined,
    personality ? `Personality: ${personality}` : undefined,
    scenario ? `Scenario: ${scenario}` : undefined,
    firstMes ? `Your greeting message (stay consistent with it): ${firstMes}` : undefined,
    'Never break character and never mention being an AI.',
  ].filter(Boolean);
  const avatarRaw = (raw.avatar ?? data.avatar) as unknown;
  const avatar = typeof avatarRaw === 'string' && avatarRaw.startsWith('data:') ? avatarRaw : undefined;
  return { id, name, prompt: parts.join('\n\n'), avatar, description, firstMessage: firstMes || undefined };
}

/** Build the effective role list: built-ins, custom roles, then characters. */
export function effectiveRoles(lang: string, lib?: RoleLib | null): EffectiveRole[] {
  const hidden = new Set(lib?.hidden ?? []);
  const builtins = ROLE_TEMPLATES.filter((t) => !hidden.has(t.id)).map((t) => ({
    id: t.id,
    name: lang === 'zh' ? t.nameZh : t.nameEn,
    prompt: rolePromptFor(t, lang),
    builtin: true,
  }));
  const customs = (lib?.custom ?? []).map((c) => ({ ...c, builtin: false }));
  const chars = (lib?.characters ?? []).map((c) => ({
    id: c.id, name: c.name, prompt: c.prompt, builtin: false,
    character: true as const, avatar: c.avatar,
  }));
  return [...builtins, ...customs, ...chars];
}

/** Find the character whose prompt matches an applied role (prefix match:
    the node may have appended instructions after the persona block). */
export function characterAvatarFor(appliedRole: string | undefined, lib?: RoleLib | null): string | undefined {
  if (!appliedRole) return undefined;
  for (const c of lib?.characters ?? []) {
    if (appliedRole.startsWith(c.prompt.slice(0, Math.min(60, c.prompt.length)))) return c.avatar;
  }
  return undefined;
}
