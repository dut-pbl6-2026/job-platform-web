/** Response of POST /api/ai/score-resume (job-platform-docs/docs/ai/resume-scoring.md §6.1). */
export type ScoreBand = "Strong" | "Good" | "Partial" | "Weak";

export interface ResumeScore {
  overall_score: number;
  band: ScoreBand;
  breakdown: {
    skills: {
      score: number | null;
      matching: string[];
      missing: string[];
      negated: string[];
      extra: string[];
      evidence: Record<string, string>;
    };
    semantic: {
      score: number;
      title_fit: number;
      top_matches: { requirement: string; cv_excerpt: string; similarity: number }[];
    };
    experience: { score: number | null; cv_years: number; required_years: number | null };
    education: { score: number | null; cv_level: string; required_level: string };
  };
  suggestions: string[];
  warnings: string[];
  meta: {
    parser: string;
    pages: number;
    language: string;
    model: string;
    cached: boolean;
    elapsed_ms: number;
  };
}

export interface ScoreError {
  code: string;
  message: string;
}
