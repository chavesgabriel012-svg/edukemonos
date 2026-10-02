import { BookOpenText, Calculator, Earth, FlaskConical, Languages, Users, type LucideProps } from "lucide-react";

const ICON = {
  matematicas: Calculator,
  espanol: BookOpenText,
  ciencias: FlaskConical,
  estudios_sociales: Earth,
  ingles: Languages,
  civica: Users,
} as const;

/** One icon per subject. Thick stroke, single color (Tinta or white), as the brand manual asks. */
export function SubjectIcon({ subject, ...props }: { subject: string } & LucideProps) {
  const Icon = ICON[subject as keyof typeof ICON] ?? BookOpenText;
  return <Icon aria-hidden strokeWidth={2.5} {...props} />;
}
