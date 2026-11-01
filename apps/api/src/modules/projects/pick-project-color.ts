import { PROJECT_COLORS, type ProjectColor } from '@lokibench/contracts';

/**
 * 새 프로젝트에 줄 색을 고른다.
 *
 * - 화면에 보이는 프로젝트끼리 색이 덜 겹치도록 가장 적게 쓰인 색을 고른다
 * - 아카이브된 프로젝트는 화면에 보이지 않으므로 세지 않는다
 * - 동률이면 팔레트 순서가 앞인 색을 고른다
 *
 * @param projects 지금 있는 프로젝트 전체 (아카이브 포함)
 * @returns 새 프로젝트에 줄 색
 */
export function pickProjectColor(
  projects: ReadonlyArray<{ color: ProjectColor; archivedAt: string | null }>,
): ProjectColor {
  const zeroCounts = PROJECT_COLORS.map((color) => [color, 0] as const);
  const counts = new Map<ProjectColor, number>(zeroCounts);

  for (const project of projects) {
    if (project.archivedAt !== null) continue;
    counts.set(project.color, (counts.get(project.color) ?? 0) + 1);
  }

  let picked: ProjectColor = PROJECT_COLORS[0];
  for (const color of PROJECT_COLORS) {
    const colorCount = counts.get(color) ?? 0;
    const pickedCount = counts.get(picked) ?? 0;

    if (colorCount < pickedCount) picked = color;
  }
  return picked;
}
