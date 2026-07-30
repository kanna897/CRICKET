import { useCallback, useReducer, type Dispatch, type SetStateAction } from "react";

function stateReducer<T>(state: T, action: SetStateAction<T>): T {
  return typeof action === "function"
    ? (action as (current: T) => T)(state)
    : action;
}

export function useReducerState<T>(initialState: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const initializer = useCallback(
    (value: T | (() => T)) => typeof value === "function" ? (value as () => T)() : value,
    [],
  );
  return useReducer(stateReducer<T>, initialState, initializer);
}
