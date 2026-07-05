const { logger, addTimeStamp } = require('./custommiddleware');

describe('custommiddleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            method: 'GET',
            url: '/api/test',
            headers: {
                'user-agent': 'JestTest'
            }
        };
        res = {};
        next = jest.fn();
    });

    describe('addTimeStamp middleware', () => {
        it('should append a TimeStamp string to the req object and call next', () => {
            addTimeStamp(req, res, next);
            expect(req.TimeStamp).toBeDefined();
            expect(typeof req.TimeStamp).toBe('string');
            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe('logger middleware', () => {
        let consoleSpy;

        beforeEach(() => {
            consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('should log request details and call next', () => {
            logger(req, res, next);
            expect(consoleSpy).toHaveBeenCalled();
            expect(next).toHaveBeenCalledTimes(1);
        });
    });
});
