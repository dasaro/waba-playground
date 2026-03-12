/**
 * Small observable store for the playground UI state.
 *
 * @template T
 * @param {T} initialState
 */
export function createStore(initialState) {
    let state = { ...initialState };
    const listeners = new Set();

    return {
        getState() {
            return state;
        },
        /**
         * @param {Partial<T> | ((current: T) => Partial<T>)} update
         */
        setState(update) {
            const patch = typeof update === 'function' ? update(state) : update;
            state = { ...state, ...patch };
            listeners.forEach((listener) => listener(state));
            return state;
        },
        /**
         * @param {(state: T) => void} listener
         */
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
}
