type InstructorTheme = {
  accent: string;
  soft: string;
  softStrong: string;
};

const EXPLICIT_INSTRUCTOR_THEMES: Record<string, InstructorTheme> = {
  phuong: {
    accent: "#7a5f74",
    soft: "#f1e7ed",
    softStrong: "#e8dae2",
  },
  phoebe: {
    accent: "#72826e",
    soft: "#e8eee5",
    softStrong: "#dde8d9",
  },
};

const FALLBACK_THEMES: InstructorTheme[] = [
  {
    accent: "#7a5f74",
    soft: "#f1e7ed",
    softStrong: "#e8dae2",
  },
  {
    accent: "#72826e",
    soft: "#e8eee5",
    softStrong: "#dde8d9",
  },
  {
    accent: "#907868",
    soft: "#f1e9e2",
    softStrong: "#e7ddd5",
  },
];

function normalizeInstructorKey(value: string) {
  return value.trim().toLowerCase();
}

function hashString(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash << 5) - hash + character.charCodeAt(0);
    hash |= 0;
  }

  return Math.abs(hash);
}

export function getInstructorCalendarTheme(instructorName: string): InstructorTheme {
  const normalized = normalizeInstructorKey(instructorName);

  if (EXPLICIT_INSTRUCTOR_THEMES[normalized]) {
    return EXPLICIT_INSTRUCTOR_THEMES[normalized];
  }

  return FALLBACK_THEMES[hashString(normalized) % FALLBACK_THEMES.length];
}
