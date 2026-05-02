export const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message || 'Internal Server Error';
    if (err.name === 'CastError') {
        statusCode = 404;
        message = 'Resource not found';
    }
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors)
            .map((val) => val.message)
            .join(', ');
    }
    if (err.code === 11000) {
        statusCode = 400;
        message = 'Duplicate field value entered';
    }
    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};
