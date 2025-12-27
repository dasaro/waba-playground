export type { ClingoResult } from "./run";
import type { RunFunction } from "./run";
/**
 * @param program The logic program you wish to run.
 * @param models The number of models you wish returned. Defaults to 1.
 * @param options You pass in a string enumerating command line options for Clingo.
 *
 * These are described in detail in the Potassco guide: https://github.com/potassco/guide/releases/
 */
export declare function run(...args: Parameters<RunFunction>): Promise<ReturnType<RunFunction>>;
export declare function init(wasmUrl: string): Promise<void>;
export declare function restart(wasmUrl: string): Promise<void>;
export default run;
//# sourceMappingURL=index.web.d.ts.map