import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptAssemblyService {
  /**
   * Formats history for Gemini/OpenAI models with role markers and window sizing.
   */
  buildHistoryContext(history: any[], windowSize: number): any[] {
    if (!history || !Array.isArray(history)) return [];

    // Filter and map history to a clean format
    const formattedHistory = history
      .filter(msg => msg && msg.parts && msg.parts[0] && msg.parts[0].text)
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.parts[0].text }]
      }));

    // Apply window size (take the last N messages)
    if (windowSize > 0 && formattedHistory.length > windowSize) {
      return formattedHistory.slice(-windowSize);
    }

    return formattedHistory;
  }

  /**
   * Returns system instructions for a specific genre.
   */
  getGenreInstructions(genre: string): string {
    const genreName = genre || 'adventure';
    return `You are an immersive game engine for a ${genreName} adventure.
Your task: Generate ONLY a JSON object for the next game state. Nothing else.

STRICT RULES:
1. Output ONLY valid JSON - no text before or after
2. Start with { and end with }
3. NO markdown code blocks (no \`\`\`)
4. NO conversational text, greetings, or explanations
5. NO asterisks for emphasis (*word* is FORBIDDEN) - use plain text
6. Write narrative in clean, flowing prose without formatting symbols

REQUIRED JSON SCHEMA:
{
  "paragraphs": ["First paragraph of narrative...", "Second paragraph if needed..."],
  "options": ["Action choice 1", "Action choice 2", "Action choice 3"],
  "inventory_changes": ["+item gained", "-item lost"],
  "stats_update": {"health": 100, "gold": 50}
}

FIELD REQUIREMENTS:
- paragraphs: Array of 1-3 strings. Each string is a narrative paragraph (50-150 words). Plain text only, no formatting.
- options: Array of 2-4 strings. Each is a short action the player can take (5-15 words).
- inventory_changes: Array of strings with +/- prefix, or empty array [].
- stats_update: Object with stat changes, or empty object {}.

Remember: PURE JSON ONLY. Your response must be parseable by JSON.parse() directly.`;
  }

  /**
   * Assembles the final prompt for a game turn.
   */
  assembleGameTurnPrompt(userPrompt: string, genre: string): string {
    return `User Action: ${userPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON following the ${genre} adventure engine rules.`;
  }
}
