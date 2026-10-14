import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';

export interface Customer {
  id: number;
  name: string;
  phone: string | false;
  mobile: string | false;
  email: string | false;
  street: string | false;
  city: string | false;
  state_id: [number, string] | false;
  country_id: [number, string] | false;
  vat: string | false;
  barcode: string | false;
}

export function useOdooCustomers() {
  const { sessionId } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/odoo/customers?session_id=${sessionId}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch customers');
      }

      setCustomers(data.customers || []);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const createCustomer = async (customerData: {
    name: string;
    phone?: string;
    mobile?: string;
    email?: string;
    street?: string;
    city?: string;
    vat?: string;
  }) => {
    if (!sessionId) {
        throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`/api/odoo/customers?session_id=${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create customer');
      }

      // Add the new customer to the list
      if (data.customer) {
          setCustomers(prev => [...prev, data.customer]);
      }
      return data.customer;
    } catch (err: any) {
      throw err;
    }
  };

  // Initially fetch customers
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return {
    customers,
    isLoading,
    error,
    refetch: fetchCustomers,
    createCustomer,
  };
}
