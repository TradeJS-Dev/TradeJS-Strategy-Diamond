export const createTestStateController = () =>
  jest.fn(
    <State, Result, Snapshot>(
      _key: string,
      createState: () => State,
      options?: { snapshot?: (state: State) => Snapshot },
    ) => {
      const state = createState();
      let lastTimestamp: number | null = null;
      let lastResult: Result;
      return {
        oncePerTimestamp: (
          timestamp: number,
          run: (current: State) => Result,
        ): Result => {
          if (lastTimestamp === timestamp) return lastResult;
          lastTimestamp = timestamp;
          lastResult = run(state);
          return lastResult;
        },
        get: () => state,
        getSnapshot: () => options?.snapshot?.(state),
      };
    },
  );
