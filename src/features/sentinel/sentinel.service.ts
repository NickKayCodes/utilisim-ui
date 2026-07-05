//calls all functions related to the sentinel backend, such as login, logout, and token management
import type {
  LoginPayload,
  AuthResponse,
  RegistrationPayload,
  UserUpdatePayload,
} from './sentinel.types';

const SENTINEL_TOKEN_KEY = 'sentinel.auth.token';

function persistToken(token: string | undefined) {
  if (token) {
    localStorage.setItem(SENTINEL_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(SENTINEL_TOKEN_KEY);
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(SENTINEL_TOKEN_KEY);
}

export function clearStoredToken() {
  persistToken(undefined);
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getApiMessage(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }
  }

  return fallback;
}

//login function that takes login payload and returns auth response from the server
export async function login(
  payload: LoginPayload,
): Promise<{ success: boolean; data?: AuthResponse; error?: string }> {
  try {
    const response = await fetch('/api/sentinel/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    //if response is not ok, return error message from server or default message
    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: getApiMessage(errorData, 'Login failed'),
      };
    }
    //otherwise the login is successful, return auth response data from server
    const responseData = await response.json();
    persistToken(responseData?.token);
    return { success: true, data: responseData };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'An error occurred during login' };
  }
}

export async function register(
  payload: RegistrationPayload,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch('/api/sentinel/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.status !== 200) {
      const errorData = await response.json().catch(() => null);
      return {
        success: false,
        error: getApiMessage(errorData, 'Registration failed'),
      };
    }

    const responseData = await response.json().catch(() => null);
    return {
      success: true,
      message: getApiMessage(responseData, 'Registration successful'),
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'An error occurred during registration' };
  }
}

export async function updateUser(
  payload: UserUpdatePayload,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch('/api/sentinel/update', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (response.status !== 200) {
      const errorData = await response.json().catch(() => null);
      return {
        success: false,
        error: getApiMessage(errorData, 'User update failed'),
      };
    }

    const responseData = await response.json().catch(() => null);
    return {
      success: true,
      message: getApiMessage(responseData, 'User updated successfully'),
    };
  } catch (error) {
    console.error('User update error:', error);
    return {
      success: false,
      error: 'An error occurred while updating user information',
    };
  }
}

export async function deleteUser(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/sentinel/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });

    if (response.status !== 200) {
      const errorData = await response.json().catch(() => null);
      return {
        success: false,
        error: getApiMessage(errorData, 'User deletion failed'),
      };
    }

    const responseData = await response.json().catch(() => null);
    clearStoredToken();
    return {
      success: true,
      message: getApiMessage(responseData, 'User deleted successfully'),
    };
  } catch (error) {
    console.error('User deletion error:', error);
    return {
      success: false,
      error: 'An error occurred while deleting the user',
    };
  }
}
