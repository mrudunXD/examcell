export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[${level}] ${method} ${originalUrl} → ${statusCode} (${duration}ms) IP: ${ip}`);
  });

  next();
}
