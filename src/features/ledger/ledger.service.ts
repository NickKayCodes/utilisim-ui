import { getAuthHeaders } from '../sentinel/sentinel.service';

export interface CreditCardPayload {
  name: string;
  balance: number;
  minimumPayment: number;
  apr: number;
}

export interface CreditCard extends CreditCardPayload {
  id: string;
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

export async function getCards(): Promise<{
  success: boolean;
  data?: CreditCard[];
  error?: string;
}> {
  try {
    const response = await fetch('/api/ledger/cards', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return {
        success: false,
        error: getApiMessage(errorData, 'Unable to load cards'),
      };
    }

    const cards = await response.json();
    return { success: true, data: cards };
  } catch (error) {
    console.error('Get cards error:', error);
    return { success: false, error: 'Unable to load credit card information' };
  }
}

export async function createCard(
  payload: CreditCardPayload,
): Promise<{ success: boolean; data?: CreditCard; error?: string }> {
  try {
    const response = await fetch('/api/ledger/cards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return {
        success: false,
        error: getApiMessage(errorData, 'Unable to create card'),
      };
    }

    const createdCard = await response.json();
    return { success: true, data: createdCard };
  } catch (error) {
    console.error('Create card error:', error);
    return { success: false, error: 'Unable to create credit card' };
  }
}

export async function updateCard(
  id: string,
  payload: CreditCardPayload,
): Promise<{ success: boolean; data?: CreditCard; error?: string }> {
  try {
    const response = await fetch(`/api/ledger/cards/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return {
        success: false,
        error: getApiMessage(errorData, 'Unable to update card'),
      };
    }

    const updatedCard = await response.json();
    return { success: true, data: updatedCard };
  } catch (error) {
    console.error('Update card error:', error);
    return { success: false, error: 'Unable to update credit card' };
  }
}

export async function deleteCard(
  id: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`/api/ledger/cards/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return {
        success: false,
        error: getApiMessage(errorData, 'Unable to delete card'),
      };
    }

    const responseData = await response.json().catch(() => null);
    return {
      success: true,
      message: getApiMessage(responseData, 'Card deleted successfully'),
    };
  } catch (error) {
    console.error('Delete card error:', error);
    return { success: false, error: 'Unable to delete credit card' };
  }
}
