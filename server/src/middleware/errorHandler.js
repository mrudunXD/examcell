export function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.message, err.stack);
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'A record with this value already exists.' });
  }
  const isKnown = err.status && err.status < 500;
  res.status(err.status || 500).json({ error: isKnown ? err.message : 'An internal error occurred.' });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
