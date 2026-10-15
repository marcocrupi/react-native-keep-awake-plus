import {FunctionComponent} from 'react';

export interface KeepAwakeOptions {
  /** Acquire an owner while true. Defaults to true. */
  enabled?: boolean;
}

export type KeepAwakeProps = KeepAwakeOptions;

/** Acquire the root API's implicit request, idempotently. Native errors propagate. */
export function activateKeepAwake(): void;

/** Release only the root API's implicit request, idempotently. Errors propagate. */
export function deactivateKeepAwake(): void;

/**
 * Acquire one shared owner. Call the returned idempotent release when done.
 * Native errors propagate synchronously; a throwing release is still consumed.
 * This requests keep-awake; it does not confirm OS state. Other owners survive.
 */
export function acquireKeepAwake(): () => void;

/** Keep the screen awake while mounted and enabled (true by default). */
export function useKeepAwake(options?: KeepAwakeOptions): void;

/** Keep the screen awake while mounted and enabled (true by default). */
declare const KeepAwake: FunctionComponent<KeepAwakeProps>;
export default KeepAwake;
