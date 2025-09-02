import { QueryClient } from '@tanstack/react-query';

/**
 * Utility function to update tweet data in React Query cache
 * @param queryClient - The React Query client instance
 * @param queryKey - The query key to update
 * @param updater - Function that receives old data and returns updated data
 */
export const updateTweetInCache = (
  queryClient: QueryClient,
  queryKey: any[],
  updater: (oldData: any) => any
) => {
  queryClient.setQueriesData({ queryKey }, (oldData: any) => {
    if (!oldData) return oldData;
    return updater(oldData);
  });
};
