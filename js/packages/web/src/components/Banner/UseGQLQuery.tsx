import { useQuery } from 'react-query';
import { GraphQLClient} from 'graphql-request';

// @ts-ignore
export const useGQLQuery = (key, query, variables, config = {}) => {
  const endpoint = 'https://graph-test.holaplex.com/v1';
  
 const graphQLClient = new GraphQLClient(endpoint);  
 const fetchData = async () => await graphQLClient.request(query, variables,);
  return useQuery(key, fetchData, config);
};