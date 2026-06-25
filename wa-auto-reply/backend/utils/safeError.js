const getSafeErrorMessage = (error, fallback = 'Internal server error') => {
  if (process.env.NODE_ENV !== 'production') {
    return error?.message || fallback;
  }
  return fallback;
};

module.exports = { getSafeErrorMessage };
