import { useRouter } from 'next/router';
// import { useLocation } from 'react-router-dom';

// export function useQuerySearch() {
//   return new URLSearchParams(useLocation().search);
// }

export const useQuerySearch = () => {
  const router = useRouter();
  return new URLSearchParams(router.query);
};
