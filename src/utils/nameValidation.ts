export const MIN_DISPLAY_NAME_LENGTH = 2;
export const MAX_DISPLAY_NAME_LENGTH = 24;

// Severe slurs / hate-speech substrings (checked on stripped lowercase+leetspeak text)
const BLOCKED_SUBSTRINGS = [
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'chink',
  'spic',
  'kike',
  'wetback',
  'tranny',
  'retard',
  'rape',
  'rapist',
  'pedophile',
  'pedo',
  'nazi',
  'hitler',
  'kkk',
  'kys',
];

// Profanity words checked on word boundaries so normal names aren't falsely flagged
const BLOCKED_WORDS = [
  'fuck',
  'fucker',
  'fucking',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'whore',
  'slut',
  'asshole',
  'bastard',
  'twat',
  'wank',
  'wanker',
  'jizz',
  'cum',
  'porn',
  'penis',
  'vagina',
];

function normalizeLeetspeak(input: string): string {
  return input
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i');
}

export function containsOffensiveLanguage(rawName: string): boolean {
  const normalized = normalizeLeetspeak(rawName);
  const compact = normalized.replace(/[^a-z]/g, '');

  for (const term of BLOCKED_SUBSTRINGS) {
    if (compact.includes(term)) {
      return true;
    }
  }

  const words = normalized.split(/[^a-z]+/).filter(Boolean);
  for (const word of words) {
    for (const blocked of BLOCKED_WORDS) {
      if (word === blocked || word.startsWith(blocked)) {
        return true;
      }
    }
  }

  return false;
}

export function validateDisplayName(rawName: string): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  const sanitized = rawName.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (sanitized.length < MIN_DISPLAY_NAME_LENGTH) {
    return {
      valid: false,
      sanitized,
      error: `Display name must be at least ${MIN_DISPLAY_NAME_LENGTH} characters.`,
    };
  }

  if (sanitized.length > MAX_DISPLAY_NAME_LENGTH) {
    return {
      valid: false,
      sanitized,
      error: `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`,
    };
  }

  if (containsOffensiveLanguage(sanitized)) {
    return {
      valid: false,
      sanitized,
      error: 'Please choose a display name without offensive language.',
    };
  }

  return { valid: true, sanitized };
}
