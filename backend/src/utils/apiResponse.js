export const apiSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  // If arguments were passed as (res, data, statusCode, message) e.g. (res, doc, 201, 'Created')
  if (typeof message === 'number') {
    const tempStatus = message;
    message = typeof statusCode === 'string' ? statusCode : 'Success';
    statusCode = tempStatus;
  } else if (typeof data === 'string' && typeof message === 'object' && message !== null) {
    // If first argument after res is a string and second is an object, swap them for backwards-compatibility
    const temp = data;
    data = message;
    message = temp;
  }

  // Ensure statusCode is always a valid integer
  const finalStatus = Number.isInteger(Number(statusCode)) ? Number(statusCode) : 200;

  return res.status(finalStatus).json({
    success: true,
    message: typeof message === 'string' ? message : 'Success',
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
