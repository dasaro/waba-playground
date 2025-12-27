import type { RunFunction } from "./run";
export type Messages = {
    type: "init";
    wasmUrl?: string;
} | {
    type: "run";
    args: Parameters<RunFunction>;
};
declare const _default: any;
export default _default;
//# sourceMappingURL=run.worker.d.ts.map