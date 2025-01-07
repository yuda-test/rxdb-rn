import { useState } from "react";

const authURL: string = process.env.EXPO_PUBLIC_AUTHURL || "";
const authApiKey: string = process.env.EXPO_PUBLIC_API_KEY || "";

const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string>();
  const [user, setUser] = useState<string>("Not Login");

  const login = async (data: { username: string; password: string }) => {
    setLoading(true);
    setError(null);
    setUser(data.username);

    try {
      const response = await fetch(authURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": authApiKey, // Add the API key in the headers
        },
        body: JSON.stringify({
          query: `
            query login($username: String!, $password: String!) {
              login(username: $username, password: $password) {
                jwt
              }
            }
          `,
          variables: {
            username: data.username,
            password: data.password,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      if (result.errors) {
        console.error("GraphQL errors:", result.errors);
        throw new Error("GraphQL error occurred");
      }
      setJwt(`Bearer ${result.data.login.jwt}`);
    } catch (error: any) {
      setError(error.message);
      console.error("Fetch error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { login, jwt, user, loading, error };
};

export default useAuth;
