import { Icon } from "./Icon";
import { cx } from "./controls";

export type WizardStep = { title: string; hint?: string };

/**
 * One step visible at a time. The list above the card shows where the person is and what is left;
 * completed steps get a check, the current one an amber marker, and later ones stay muted.
 */
export function WizardSteps({ steps, current, label }: { steps: WizardStep[]; current: number; label: string }) {
  return (
    <ol className="jp-wizard-steps" aria-label={label}>
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "todo";
        return (
          <li
            key={step.title}
            className={cx("jp-wizard-step", `is-${state}`)}
            aria-current={index === current ? "step" : undefined}
          >
            <span className="jp-wizard-no" aria-hidden="true">
              {state === "done" ? <Icon name="check" size={14} /> : index + 1}
            </span>
            <span className="jp-wizard-text">
              <strong>{step.title}</strong>
              {step.hint && <span>{step.hint}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
