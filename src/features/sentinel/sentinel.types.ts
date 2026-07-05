// User object can be used for creating user accounts, logging in, and managing user profiles
export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
}

// login payload for authentication
export interface LoginPayload {
  username: string;
  password: string;
}

// registration payload for creating new user accounts
export interface RegistrationPayload {
  username: string;
  email: string;
  password: string;
}

// update payload for changing user profile information such as email or password
export interface UserUpdatePayload {
  email?: string;
  password?: string;
}

//authentication response from the server
export interface AuthResponse {
  token?: string;
  user?: User;
  message?: string;
}
