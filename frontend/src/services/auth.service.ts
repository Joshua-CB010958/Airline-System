import { authApi } from "./apiClients";
import type { LoginResponse, UserProfile } from "@/types";

export const authService = {
  /** POST /login — OAuth2 password flow (x-www-form-urlencoded). */
  async login(username: string, password: string): Promise<LoginResponse> {
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);
    const { data } = await authApi.post<LoginResponse>("/login", body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data;
  },

  /** GET /me — resolve the current user's profile from their token. */
  async me(): Promise<UserProfile> {
    const { data } = await authApi.get<UserProfile>("/me");
    return data;
  },

  /** GET /admin/users — admin-only directory listing. */
  async adminUsers(): Promise<{
    requested_by: string;
    users: UserProfile[];
  }> {
    const { data } = await authApi.get("/admin/users");
    return data;
  },
};
