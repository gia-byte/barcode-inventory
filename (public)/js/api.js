// api.js - Frontend API Integration for Oriental Photographix
// Place this file in your public/js folder and include it in your HTML files

const API_BASE_URL = 'http://localhost:3000/api';

class OrientalPhotographixAPI {
  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  // Helper method to make authenticated requests
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle token expiration
        if (response.status === 401 || response.status === 403) {
          this.logout();
          window.location.href = 'index.html';
          throw new Error('Session expired. Please login again.');
        }
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // ============================================
  // AUTHENTICATION METHODS
  // ============================================

  async login(username, password) {
    try {
      const data = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (data.token) {
        this.token = data.token;
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  async verifyToken() {
    try {
      return await this.request('/auth/verify');
    } catch (error) {
      return { valid: false };
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  // ============================================
  // INVENTORY METHODS
  // ============================================

  async getAllInventory() {
    return await this.request('/inventory');
  }

  async getInventoryItem(id) {
    return await this.request(`/inventory/${id}`);
  }

  async addInventoryItem(itemData) {
    return await this.request('/inventory', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  }

  async updateInventoryItem(id, itemData) {
    return await this.request(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(itemData)
    });
  }

  async deleteInventoryItem(id) {
    return await this.request(`/inventory/${id}`, {
      method: 'DELETE'
    });
  }

  async searchInventory(query, category = '') {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (category) params.append('category', category);
    
    return await this.request(`/inventory/search?${params.toString()}`);
  }

  // ============================================
  // DASHBOARD/STATISTICS METHODS
  // ============================================

  async getDashboardStats() {
    return await this.request('/dashboard/stats');
  }

  async getRecentActivity(limit = 10) {
    return await this.request(`/activity?limit=${limit}`);
  }

  // ============================================
  // REPORTS METHODS
  // ============================================

  async getInventoryReport(filters = {}) {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.stockLevel) params.append('stockLevel', filters.stockLevel);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    
    return await this.request(`/reports/inventory?${params.toString()}`);
  }

  async getLowStockAlerts() {
    return await this.request('/reports/low-stock');
  }
}

// Create a global instance
const api = new OrientalPhotographixAPI();

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Check if user is authenticated
function isAuthenticated() {
  return !!localStorage.getItem('authToken');
}

// Redirect to login if not authenticated
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
  }
}

// Show alert messages
function showAlert(message, type = 'success', containerId = 'alertContainer') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const alertId = 'alert-' + Date.now();
  const iconClass = type === 'success' ? 'check-circle' : 
                    type === 'danger' ? 'exclamation-triangle' : 
                    type === 'warning' ? 'exclamation-circle' : 'info-circle';
  
  const alertHtml = `
    <div class="alert alert-${type} alert-dismissible fade show" id="${alertId}" role="alert">
      <i class="bi bi-${iconClass}"></i> ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
  
  container.innerHTML = alertHtml;
  
  setTimeout(() => {
    const alert = document.getElementById(alertId);
    if (alert) {
      const bsAlert = bootstrap.Alert.getInstance(alert);
      if (bsAlert) bsAlert.close();
    }
  }, 5000);
}

// Format currency
function formatCurrency(amount) {
  return '₱' + parseFloat(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Format relative time
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Get stock status
function getStockStatus(quantity, minStock) {
  if (quantity === 0) {
    return { class: 'stock-low', text: 'Out of Stock', badge: 'danger' };
  } else if (quantity <= minStock) {
    return { class: 'stock-low', text: 'Low Stock', badge: 'danger' };
  } else if (quantity <= 50) {
    return { class: 'stock-medium', text: 'Medium Stock', badge: 'warning' };
  } else {
    return { class: 'stock-high', text: 'High Stock', badge: 'success' };
  }
}

// Export data to CSV
function exportToCSV(data, filename) {
  const csv = convertToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Loading state management
function showLoading(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 text-muted">Loading data...</p>
      </div>
    `;
  }
}

function hideLoading(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = '';
  }
}

// Console log for debugging
console.log('Oriental Photographix API initialized');
console.log('API Base URL:', API_BASE_URL);