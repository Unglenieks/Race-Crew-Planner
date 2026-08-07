# Component tests

Component tests run in jsdom through Vitest and React Testing Library. Keep
tests beside the component they cover, use accessible roles and labels to find
controls, and mock only the Convex hooks or browser boundary needed by the
component.

Every new interactive screen must cover its successful action, an actionable
failure state, and the controls hidden by its role gate. Run `pnpm test` from
the repository root before opening a pull request.
