// Auth mutations are now in @/lib/hooks/use-swr-hooks (loginMutate, signupMutate, logoutMutate).
// Auth reads (user, isLoading) are now via the useUser() SWR hook.
// This file re-exports them for convenience.
export { useUser, loginMutate, signupMutate, logoutMutate } from "@/lib/hooks/use-swr-hooks";
