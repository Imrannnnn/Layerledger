const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (error) {
        const issues = error.errors || error.issues;
        if (issues && Array.isArray(issues)) {
            const errorMessages = issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
            res.status(400);
            return next(new Error(`Validation error: ${errorMessages}`));
        }
        next(error);
    }
};

module.exports = { validate };
