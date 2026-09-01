import {resolveAppRuntime} from './appRuntime';

// This is the single process-wide environment decision. Firebase initialization,
// app bootstrap, and local feature tooling all consume this exact frozen value.
export const appRuntime = resolveAppRuntime(process.env);
