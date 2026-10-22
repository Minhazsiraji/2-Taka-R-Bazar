// Expo substitutes EXPO_PUBLIC_* at bundle time; no secrets are exposed here.
declare const process: { readonly env: Record<string, string | undefined> };
