"use client";

type Props = {
  onClick: () => void;
  loading?: boolean;
  label?: string;
};

export function Fab({ onClick, loading, label = "Создать объявление" }: Props) {
  return (
    <button
      type="button"
      className="oz-fab"
      onClick={onClick}
      disabled={loading}
      aria-label={label}
      title={label}
    >
      {loading ? (
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <circle
            cx="11"
            cy="11"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="14 42"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 11 11"
              to="360 11 11"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 5V19M5 12H19"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
