/** URL of a file shipped with the app. Works at the site root and under a sub-path such as /garage/ (GitHub Pages). */
export const url = (p: string) => import.meta.env.BASE_URL + p.replace(/^\//, '')
