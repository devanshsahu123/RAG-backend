// Error Handling Middleware
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error('[Error:', err.message, ']');
  
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
