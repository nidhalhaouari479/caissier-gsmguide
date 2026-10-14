/**
 * Odoo JSON-RPC API integration
 */

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'http://localhost:8069';
const ODOO_DB = process.env.NEXT_PUBLIC_ODOO_DB || 'odoo';

type RPCPayload = {
  jsonrpc: '2.0';
  method: 'call';
  params: any;
  id: number;
};

export class OdooAPI {
  private static getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Universal RPC call function
   */
  public static async rpcAction(endpoint: string, params: any) {
    const payload: RPCPayload = {
      jsonrpc: '2.0',
      method: 'call',
      params: params,
      id: Math.floor(Math.random() * 1000000000),
    };

    try {
      const response = await fetch(`${ODOO_URL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        // Important: Include credentials so the session_id cookie is sent/received
        credentials: 'omit', // Use omit if CORS isn't set up, but typical Odoo requires 'include' for session cookie
        // For standard local development, managing session manually or ensuring CORS is best.
        // We will return the result, which might contain a session_id in the response body 
        // during `/web/session/authenticate`
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.data?.message || data.error.message || 'Odoo RPC Error');
      }

      return data.result;
    } catch (error) {
      console.error('Odoo API Error:', error);
      throw error;
    }
  }

  /**
   * Authenticate with Odoo
   */
  public static async authenticate(login: string, password: string) {
    const params = {
      db: ODOO_DB,
      login,
      password,
    };
    return this.rpcAction('/web/session/authenticate', params);
  }

  /**
   * Perform a model operation (search, read, search_read, create, write, unlink)
   */
  public static async callKw(
    sessionId: string, 
    model: string, 
    method: string, 
    args: any[] = [], 
    kwargs: any = {}
  ) {
    const params = {
      model,
      method,
      args,
      kwargs,
      // Since fetch might not attach cookies reliably cross-origin without CORS 'include',
      // we pass the session_id in the params or headers depending on Odoo version.
      // Odoo 16+ accepts session_id in the URL or sometimes cookie. 
      // This is a common workaround if credentials:'include' is problematic.
    };
    
    // We append session_id to URL
    return this.rpcAction(`/web/dataset/call_kw?session_id=${sessionId}`, params);
  }
}
