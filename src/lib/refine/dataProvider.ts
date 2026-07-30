import { DataProvider } from "@refinedev/core";
import { ENV } from "@/config/env";

export const dataProvider: DataProvider = {
  getApiUrl: () => ENV.API_BASE_URL,

  getList: async ({ resource, pagination, filters, sorters }) => {
    const token = localStorage.getItem("yts_auth_token") || "";
    const params = new URLSearchParams();

    const pag = pagination as { current?: number; pageSize?: number } | undefined;
    if (pag) {
      params.append("page", String(pag.current || 1));
      params.append("pageSize", String(pag.pageSize || 25));
    }

    const url = `${ENV.API_BASE_URL}/${resource}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || "Gagal mengambil data list");
    }

    return {
      data: result.data || [],
      total: result.meta?.total || 0,
    };
  },

  getOne: async ({ resource, id }) => {
    const token = localStorage.getItem("yts_auth_token") || "";
    const response = await fetch(`${ENV.API_BASE_URL}/${resource}/${id}`, {
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || "Gagal mengambil item data");
    }

    return {
      data: result.data,
    };
  },

  create: async ({ resource, variables }) => {
    const token = localStorage.getItem("yts_auth_token") || "";
    const response = await fetch(`${ENV.API_BASE_URL}/${resource}`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(variables),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || "Gagal membuat data baru");
    }

    return {
      data: result.data,
    };
  },

  update: async ({ resource, id, variables }) => {
    const token = localStorage.getItem("yts_auth_token") || "";
    const response = await fetch(`${ENV.API_BASE_URL}/${resource}/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(variables),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || "Gagal memperbarui data");
    }

    return {
      data: result.data,
    };
  },

  deleteOne: async ({ resource, id }) => {
    const token = localStorage.getItem("yts_auth_token") || "";
    const response = await fetch(`${ENV.API_BASE_URL}/${resource}/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: token,
      },
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || "Gagal menghapus data");
    }

    return {
      data: result.data,
    };
  },
};
