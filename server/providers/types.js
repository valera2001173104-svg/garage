/**
 * Provider contracts. Keys live in server/.env only and never reach the browser.
 *
 * @typedef {Object} ImageEditProvider
 * @property {string} id
 * @property {string} label
 * @property {() => boolean} configured
 * @property {{id:string,name:string,prompt:string}[]} presets
 * @property {(a:{image:Buffer, mask:Buffer, prompt:string, signal?:AbortSignal}) => Promise<{data:Buffer, mime:string}>} edit
 *
 * @typedef {Object} Reconstruct3DProvider   (CREATE 3D — no concrete provider is bundled)
 * @property {string} id
 * @property {() => boolean} configured
 * @property {(images:Buffer[]) => Promise<{jobId:string}>} submit
 * @property {(jobId:string) => Promise<{state:'queued'|'running'|'done'|'failed', progress?:number, modelUrl?:string, error?:string}>} status
 * progress is passed through only if the vendor API reports it.
 */
export {}
