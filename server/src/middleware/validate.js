export function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      for (const rule of rules) {
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors.push({ field, message: `${field} is required` });
          break;
        }

        if (value === undefined || value === null || value === '') continue;

        if (rule.type === 'string' && typeof value !== 'string') {
          errors.push({ field, message: `${field} must be a string` });
          break;
        }

        if (rule.type === 'number') {
          const num = parseInt(value, 10);
          if (isNaN(num)) {
            errors.push({ field, message: `${field} must be a number` });
            break;
          }
        }

        if (rule.type === 'array' && !Array.isArray(value)) {
          errors.push({ field, message: `${field} must be an array` });
          break;
        }

        if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
          errors.push({ field, message: `${field} must be at least ${rule.minLength} characters` });
          break;
        }

        if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
          errors.push({ field, message: `${field} must be at most ${rule.maxLength} characters` });
          break;
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push({ field, message: rule.patternMessage || `${field} has an invalid format` });
          break;
        }

        if (rule.oneOf && !rule.oneOf.includes(value)) {
          errors.push({ field, message: `${field} must be one of: ${rule.oneOf.join(', ')}` });
          break;
        }

        if (rule.min && parseInt(value, 10) < rule.min) {
          errors.push({ field, message: `${field} must be at least ${rule.min}` });
          break;
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    next();
  };
}
