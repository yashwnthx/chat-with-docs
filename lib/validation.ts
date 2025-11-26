/**
 * Input validation and sanitization utilities
 */

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate file upload
 */
export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024; // Default 10MB
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,txt,md').split(',');

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`,
    };
  }

  // Check file type
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !allowedTypes.includes(extension)) {
    return {
      valid: false,
      error: `File type .${extension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  // Check for suspicious file names
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      valid: false,
      error: 'Invalid file name',
    };
  }

  return { valid: true };
}

/**
 * Validate chat message
 */
export function validateChatMessage(message: string): { valid: boolean; error?: string } {
  if (!message || message.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (message.length > 10000) {
    return { valid: false, error: 'Message is too long (max 10,000 characters)' };
  }

  return { valid: true };
}

/**
 * Validate knowledge base name
 */
export function validateKnowledgeName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Name cannot be empty' };
  }

  if (name.length > 255) {
    return { valid: false, error: 'Name is too long (max 255 characters)' };
  }

  // Check for suspicious characters
  if (name.includes('<') || name.includes('>') || name.includes('script')) {
    return { valid: false, error: 'Name contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Validate conversation name
 */
export function validateConversationName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Conversation name cannot be empty' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Conversation name is too long (max 100 characters)' };
  }

  return { valid: true };
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars
    .replace(/\.+/g, '.') // Replace multiple dots
    .replace(/^\.+/, '') // Remove leading dots
    .substring(0, 255); // Limit length
}

/**
 * Validate UUID/CUID
 */
export function validateId(id: string): boolean {
  // Basic CUID validation
  return /^c[a-z0-9]{24}$/.test(id) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
}
