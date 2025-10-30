export function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  // Just now (< 1 minute)
  if (minutes < 1) return 'Just now';
  
  // Minutes ago (< 1 hour)
  if (minutes < 60) return `${minutes}m ago`;
  
  // Hours ago (< 24 hours)
  if (hours < 24) return `${hours}h ago`;
  
  // Days ago (< 7 days)
  if (days < 7) return `${days}d ago`;
  
  // Date format for older messages
  const isThisYear = date.getFullYear() === now.getFullYear();
  
  if (isThisYear) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatFullTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

