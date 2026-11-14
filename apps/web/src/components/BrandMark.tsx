/**
 * 앱 이름 앞에 붙는 마크를 그린다.
 */
export function BrandMark() {
  return (
    <span
      aria-hidden
      className="bg-fg grid size-6.5 shrink-0 place-items-center rounded-lg"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4.25"
      >
        <path
          d="M8 5v14h9"
          stroke="var(--canvas)"
          strokeWidth="2.8"
        />
        <rect
          x="13"
          y="5"
          width="5"
          height="5"
          rx="1.2"
          fill="var(--lime)"
        />
      </svg>
    </span>
  );
}
