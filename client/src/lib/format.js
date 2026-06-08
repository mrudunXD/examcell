export function formatDate(dateVal) {
  if (!dateVal) return '';
  // If it's a date-like string or Date object
  let dateStr = typeof dateVal === 'string' ? dateVal : new Date(dateVal).toISOString();
  // If it contains a space or T (e.g. ISO string), extract just the date part
  if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
  if (dateStr.includes(' ')) dateStr = dateStr.split(' ')[0];
  
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  // Convert HH:MM (24-hour) or ISO time to H:MM AM/PM
  const timePart = typeof timeStr === 'string' && timeStr.includes('T') 
    ? timeStr.split('T')[1].substring(0, 5) 
    : timeStr;
  const parts = timePart.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].substring(0, 2);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${hours}:${minutes} ${ampm}`;
  }
  return timeStr;
}

export function formatDateTime(dateTimeVal) {
  if (!dateTimeVal) return '';
  const d = new Date(dateTimeVal);
  if (isNaN(d.getTime())) return String(dateTimeVal);
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  
  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}

