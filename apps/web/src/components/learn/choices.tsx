import { cn } from "cn";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Single-choice options of an exercise, as large tap targets. After grading, `correct` marks the
 * key and `wrong` the option the student picked when it was not the key.
 */
export function Choices({ options, selected, onSelect, disabled, correct = null, wrong = null }: {
  options: string[];
  selected: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
  correct?: number | null;
  wrong?: number | null;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-2.5">
      <legend className="sr-only">Opciones</legend>
      {options.map((o, k) => {
        const isKey = correct === k;
        const isWrong = wrong === k;
        const isPicked = selected === k;
        return (
          <label key={k}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-[16px] border-2 bg-card p-3.5 transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-violeta",
              !disabled && "hover:border-violeta/60",
              isPicked && "border-violeta bg-[#f1eefe]",
              isKey && "border-emerald-600 bg-emerald-50",
              isWrong && "border-amber-500 bg-amber-50",
              disabled && "cursor-default",
            )}>
            <input type="radio" name="option" value={k} checked={isPicked} onChange={() => onSelect(k)} className="sr-only" />
            <span aria-hidden
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold",
                isKey ? "bg-emerald-600 text-white" : isWrong ? "bg-amber-500 text-tinta" : isPicked ? "bg-violeta text-white" : "bg-secondary",
              )}>
              {LETTERS[k] ?? k + 1}
            </span>
            <span className="min-w-0 flex-1 pt-0.5">{o}</span>
            {isKey && <span className="shrink-0 pt-1 text-xs font-semibold text-emerald-800">Correcta</span>}
            {isWrong && <span className="shrink-0 pt-1 text-xs font-semibold text-amber-900">Tu respuesta</span>}
          </label>
        );
      })}
    </fieldset>
  );
}
