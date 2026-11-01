const API_BASE = "/api/v1";

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem("rapor_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      if (endpoint.includes("/auth/login")) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || errorData.error || "NIP/NIK/Email atau kata sandi salah.",
        );
      }

      // Picu event in-place re-auth agar dialog login muncul tanpa reload halaman atau kehilangan data draf
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("rapor:session-expired", {
            detail: { message: "Sesi Anda telah kedaluwarsa." },
          }),
        );
      }

      throw new Error("Sesi Anda telah kedaluwarsa. Silakan verifikasi akun kembali.");
    }

    const contentType = response.headers.get("content-type") || "";
    let data: any = null;
    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Request gagal dengan status HTTP ${response.status}`);
      }
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Terjadi kesalahan pada server (${response.status})`,
      );
    }

    return data as T;
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    if (response.status === 401) {
      localStorage.removeItem("rapor_token");
      localStorage.removeItem("rapor_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      throw new Error("Sesi Anda telah kedaluwarsa. Silakan login kembali.");
    }

    const contentType = response.headers.get("content-type") || "";
    let data: any = null;
    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Request gagal dengan status HTTP ${response.status}`);
      }
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Terjadi kesalahan pada server (${response.status})`,
      );
    }

    return data as T;
  }
}

export const api = new ApiClient();
