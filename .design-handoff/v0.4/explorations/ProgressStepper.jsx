/* global React */
// Vertical progress stepper — used in WaitApproachB.
// Each step is a row: gutter node + connector line + body. Three node
// states: done (filled green + tick), current (ring + breathing dot inside),
// pending (grey ring with the step number).

function ProgressStepper({ steps }) {
  return (
    <div className="tx-card tx-stepper">
      {steps.map((s, i) => (
        <div key={i} className={"tx-stepper__row tx-stepper__row--" + s.state}>
          <div className="tx-stepper__gutter">
            <div className="tx-stepper__node">
              {s.state === "done" && <span className="tx-stepper__tick"></span>}
              {s.state === "current" && <span className="tx-stepper__dot"></span>}
              {s.state === "pending" && <span style={{ color: "var(--text-3)" }}>{i + 1}</span>}
            </div>
            <div className="tx-stepper__line"></div>
          </div>
          <div className="tx-stepper__body">
            <div className="tx-stepper__title">{s.title}</div>
            {s.time && <div className="tx-stepper__time">{s.time}</div>}
            {s.sub && <div className="tx-stepper__sub">{s.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

window.ProgressStepper = ProgressStepper;
