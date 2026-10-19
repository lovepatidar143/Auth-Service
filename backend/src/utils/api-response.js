/**
 * Uniform success envelope so the frontend always receives the same shape:
 * { statusCode, data, message, success }
 */
export class ApiResponse {
    constructor(statusCode, data = null, message = "Success") {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }
}
