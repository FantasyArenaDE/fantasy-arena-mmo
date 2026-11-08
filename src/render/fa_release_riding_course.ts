/** Exact release-only substitutes; placement and collision retain their logical keys. */
export const FA_RELEASE_RIDING_COURSE: Readonly<Record<string, string>> = {
  '/models/props/course_arch.glb': '/models/props/fantasy-arena/riding-course/course-arch.glb',
  '/models/props/jump_vertical.glb': '/models/props/fantasy-arena/riding-course/jump-vertical.glb',
  '/models/props/jump_oxer.glb': '/models/props/fantasy-arena/riding-course/jump-oxer.glb',
};

export function faReleaseRidingCourseSource(url: string, enabled: boolean): string {
  if (!enabled) return url;
  const key = `/${url.replace(/^\/+/, '')}`;
  return Object.hasOwn(FA_RELEASE_RIDING_COURSE, key) ? FA_RELEASE_RIDING_COURSE[key] : url;
}
