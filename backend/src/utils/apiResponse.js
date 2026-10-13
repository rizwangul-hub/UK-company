export const apiSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  // If first argument after res is a string and second is an object, swap them for backwards-compatibility
  if (typeof data === 'string' && typeof message === 'object' && message !== null) {
    const temp = data;
    data = message;
    message = temp;
  }
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const apiError = (res, message = 'An error occurred', statusCode = 500, error = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && error ? { error: error.message || error } : {}),
  });
};
