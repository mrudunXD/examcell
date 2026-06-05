export function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.message);
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'A record with this value already exists.' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
