export interface ClingoResult {
    Solver?: string;
    Calls: number;
    Call: {
        Witnesses: {
            Value: string[];
            Costs?: number[];
            Consequences?: any;
        }[];
    }[];
    Models: {
        More: "yes" | "no";
        Number: number;
        Brave?: "yes" | "no";
        Consequences?: any;
    };
    Result: "SATISFIABLE" | "UNSATISFIABLE" | "UNKNOWN" | "OPTIMUM FOUND";
    Time: {
        CPU: number;
        Model: number;
        Solve: number;
        Total: number;
        Unsat: number;
    };
    Warnings: string[];
}
export interface ClingoError {
    Result: "ERROR";
    Error: string;
}
export declare class Runner {
    private extraParams;
    private results;
    private errors;
    private clingo;
    constructor(extraParams?: Partial<EmscriptenModule>);
    init(): Promise<void>;
    run(program: string, models?: number, options?: string[]): ClingoError | ClingoResult;
}
export type RunFunction = typeof Runner.prototype.run;
export declare function init(extraParams?: Partial<EmscriptenModule>): Promise<RunFunction>;
//# sourceMappingURL=run.d.ts.map