"use client";

type Props = {
  size?: "lg" | "md" | "sm";
};

// primary-soft circle with a green tick. Entry animation subdued under
// prefers-reduced-motion (handled in CSS).
export function SuccessCheck({ size = "lg" }: Props) {
  return (
    <div className={"tc-success tc-success--" + size}>
      <div className="tc-success__ring">
        <span className="tc-success__tick" />
      </div>
    </div>
  );
}
