/**
 * Wraps an async route handler so a rejected promise is forwarded to the
 * error middleware via next(err). (Express 5 already does this natively, but
 * keeping the wrapper makes the intent explicit and keeps the code working if
 * you ever copy these controllers into an Express 4 project.)
 */
export const asyncHandler = (requestHandler) => (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch(next);
};
