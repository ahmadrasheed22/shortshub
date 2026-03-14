/**
 * Utility to sanitize and map YouTube API errors to user-friendly messages.
 * Handles quota limits and removes raw HTML tags.
 */
export function handleApiError(error: unknown): string {
  if (!error) return 'An unknown error occurred.';

  let message = '';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.message === 'string') {
      message = errorObj.message;
    } else if (Array.isArray(errorObj.errors) && errorObj.errors.length > 0) {
      // Handle the case where Google includes an 'errors' array
      const firstError = errorObj.errors[0] as Record<string, unknown>;
      if (typeof firstError.message === 'string') {
        message = firstError.message;
      }
    }
  }

  if (!message) {
    message = String(error);
  }

  // 1. Quota Check
  if (
    message.toLowerCase().includes('quota') ||
    message.includes('403') ||
    message.toLowerCase().includes('limitexceeded')
  ) {
    return 'YouTube API quota exceeded. Please try again tomorrow.';
  }

  // 2. Sanitize HTML tags if present (sometimes API returns raw HTML pages on 5xx)
  if (message.includes('<') && message.includes('>')) {
    // Basic regex to strip HTML tags
    message = message.replace(/<[^>]*>?/gm, ' ').trim();
    // Reduce multiple spaces to one
    message = message.replace(/\s+/g, ' ');
  }

  // 3. Common Error Mapping
  if (message.includes('invalidKey') || message.includes('API key not valid')) {
    return 'Invalid YouTube API Key. Please check your environment variables.';
  }

  if (message.includes('channelNotFound') || message.includes('NotFound')) {
    return 'The requested channel or video could not be found.';
  }

  return message || 'Failed to communicate with YouTube services.';
}
