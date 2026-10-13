export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is missing. Set a secure secret in .env');
  }
  return secret;
};

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
