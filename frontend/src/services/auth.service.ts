import { api } from "./api";
import { User } from "../types";

export interface LoginResponse {
  status: string;
  message: string;
  token: string;
  user: User;
}

export const authService = {
  async login(identifier: string, password: string): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>("/auth/login", {
      identifier,
      password,
    });
    if (res.token) {
      localStorage.setItem("rapor_token", res.token);
      localStorage.setItem("rapor_user", JSON.stringify(res.user));
    }
    return res;
  },

  async changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    return api.post("/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
  },

  async getMe(): Promise<{ user: User }> {
    const res = await api.get<{ user: User }>("/auth/me");
    localStorage.setItem("rapor_user", JSON.stringify(res.user));
    return res;
  },

  logout(): void {
    localStorage.removeItem("rapor_token");
    localStorage.removeItem("rapor_user");
  },
};
