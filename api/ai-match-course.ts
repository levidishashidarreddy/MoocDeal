// Server-Side Serverless API Handler: AI-Assisted Course Matching & Deduplication
// Supports interpreting abbreviations, common typos, and canonical course resolution

declare const process: any;

export interface CourseCandidate {
  id: string;
  name: string;
  code: string;
}

export interface CourseMatchResponse {
  matchedCourseId: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  reason: string;
}

export async function processAiCourseMatch(
  query: string,
  candidates: CourseCandidate[]
): Promise<CourseMatchResponse> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2 || !candidates || candidates.length === 0) {
    return {
      matchedCourseId: null,
      confidence: 'NONE',
      reason: 'Query too short or no candidates provided.',
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!geminiKey) {
    return {
      matchedCourseId: null,
      confidence: 'NONE',
      reason: 'AI service not configured.',
    };
  }

  try {
    const prompt = `You are a course deduplication and matching specialist for Indian NPTEL MOOC courses.
A student typed the following course query: "${cleanQuery}"

Candidate canonical courses currently registered:
${JSON.stringify(candidates.map(c => ({ id: c.id, name: c.name, code: c.code })))}

TASK:
Determine if the student's query refers to one of the existing canonical courses.
1. Match common academic abbreviations (e.g., "ML" -> "Machine Learning", "DL" -> "Deep Learning", "DBMS" -> "Database Management System", "DSA" -> "Design and Analysis of Algorithms", "NLP" -> "Natural Language Processing").
2. Match minor typographical errors or slight rephrasing (e.g., "Problem Solving in C" -> "Problem Solving Through Programming In C").
3. DO NOT match if the courses are fundamentally different subjects (e.g., "Deep Learning" is NOT "Cloud Computing"; "Machine Learning" is NOT "Deep Learning").

Return ONLY a valid JSON object with NO markdown code blocks:
{
  "matchedCourseId": string | null,
  "confidence": "HIGH" | "MEDIUM" | "LOW" | "NONE",
  "reason": string
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let response: any;
    try {
      response = await fetch(geminiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Client': 'moocdeal/1.0',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      console.warn('Gemini course match status:', response.status);
      return { matchedCourseId: null, confidence: 'NONE', reason: 'AI matching unavailable' };
    }

    const data: any = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return { matchedCourseId: null, confidence: 'NONE', reason: 'No output from model' };
    }

    const parsed = JSON.parse(candidateText);
    return {
      matchedCourseId: typeof parsed.matchedCourseId === 'string' ? parsed.matchedCourseId : null,
      confidence: parsed.confidence || 'NONE',
      reason: parsed.reason || 'AI candidate resolution',
    };
  } catch (err: any) {
    console.warn('AI course match non-fatal error:', err?.message);
    return { matchedCourseId: null, confidence: 'NONE', reason: 'AI matching error fallback' };
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { query, candidates } = req.body || {};
    const result = await processAiCourseMatch(query, candidates);
    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Matching failed' });
  }
}
