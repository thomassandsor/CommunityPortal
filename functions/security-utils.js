/**
 * Security utilities for Netlify Functions
 * Provides error sanitization, CORS handling, logging, and validation
 */

// Error sanitization utility
export function sanitizeError(error, isDevelopment = false) {
    // In development, show detailed errors for debugging
    if (isDevelopment || process.env.NODE_ENV === 'development') {
        return {
            error: error.message || 'An error occurred',
            details: error.details || 'No additional details'
        };
    }
    
    // In production, return generic messages
    const genericMessages = {
        'auth': 'Authentication service temporarily unavailable',
        'dataverse': 'Data service temporarily unavailable', 
        'validation': 'Invalid request data provided',
        'generic': 'Service temporarily unavailable'
    };
    
    // Map specific errors to generic categories
    if (error.message?.includes('token') || error.message?.includes('auth')) {
        return { error: genericMessages.auth };
    }
    if (error.message?.includes('dataverse') || error.message?.includes('dynamics')) {
        return { error: genericMessages.dataverse };
    }
    if (error.status === 400) {
        return { error: genericMessages.validation };
    }
    
    return { error: genericMessages.generic };
}

// CORS header configuration
export function getCorsHeaders(origin) {
    const allowedOrigins = [
        process.env.NETLIFY_URL,
        process.env.DEPLOY_PRIME_URL, 
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8888',
        process.env.ALLOWED_ORIGIN
    ].filter(Boolean);
    
    // For development, be more permissive
    if (process.env.NODE_ENV === 'development') {
        return {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        };
    }
    
    // Production: check allowed origins
    const isAllowed = allowedOrigins.includes(origin) || 
                     (origin && allowedOrigins.some(allowed => 
                         origin?.includes(allowed?.replace('https://', '').replace('http://', ''))
                     ));
    
    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : (allowedOrigins[0] || '*'),
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Max-Age': '86400'
    };
}

// Security headers
export function getSecurityHeaders() {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    };
}

// Secure logging utility
const isProduction = process.env.NODE_ENV === 'production';

export class SecureLogger {
    static sanitizeData(data) {
        if (typeof data !== 'object' || data === null) return data;
        
        const sensitiveKeys = [
            'access_token', 'client_secret', 'password', 
            'token', 'authorization', 'key', 'secret'
        ];
        
        const sanitized = { ...data };
        
        for (const key of Object.keys(sanitized)) {
            if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
                sanitized[key] = '[REDACTED]';
            }
        }
        
        return sanitized;
    }
    
    static error(message, data = null) {
        if (isProduction) {
            console.error(message);
        } else {
            console.error(message, this.sanitizeData(data));
        }
    }
    
    static info(message, data = null) {
        if (!isProduction) {
            console.log(message, this.sanitizeData(data));
        }
    }
    
    static debug(message, data = null) {
        if (!isProduction) {
            console.debug(message, this.sanitizeData(data));
        }
    }
}

// Input validation utility
export class InputValidator {
    static email(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }
    
    static phone(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return phone === '' || phoneRegex.test(phone);
    }
    
    static name(name) {
        const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
        return name === '' || (nameRegex.test(name) && name.length <= 50);
    }
    
    static sanitizeString(str) {
        if (typeof str !== 'string') return '';
        
        return str
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/[<>]/g, '')
            .trim()
            .substring(0, 255);
    }
    
    static validateContactData(data) {
        const errors = [];
        
        if (!data.emailaddress1 || !this.email(data.emailaddress1)) {
            errors.push('Valid email address is required');
        }
        
        if (data.firstname && !this.name(data.firstname)) {
            errors.push('First name contains invalid characters');
        }
        
        if (data.lastname && !this.name(data.lastname)) {
            errors.push('Last name contains invalid characters');
        }
        
        if (data.mobilephone && !this.phone(data.mobilephone)) {
            errors.push('Phone number format is invalid');
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            sanitized: {
                firstname: this.sanitizeString(data.firstname || ''),
                lastname: this.sanitizeString(data.lastname || ''),
                emailaddress1: data.emailaddress1?.toLowerCase().trim() || '',
                mobilephone: this.sanitizeString(data.mobilephone || '')
            }
        };
    }
}

// Rate limiting utility (basic in-memory implementation)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

export function checkRateLimit(identifier, customLimit = MAX_REQUESTS) {
    const now = Date.now();
    
    // Clean old entries
    for (const [key, data] of requestCounts.entries()) {
        if (data.resetTime < now) {
            requestCounts.delete(key);
        }
    }
    
    // Get or create user data
    const userData = requestCounts.get(identifier) || {
        count: 0,
        resetTime: now + RATE_LIMIT_WINDOW
    };
    
    // Check if rate limit exceeded
    if (userData.count >= customLimit) {
        return {
            allowed: false,
            resetTime: userData.resetTime,
            remaining: 0
        };
    }
    
    // Increment counter
    userData.count++;
    requestCounts.set(identifier, userData);
    
    return {
        allowed: true,
        resetTime: userData.resetTime,
        remaining: customLimit - userData.count
    };
}

// Common response builder with security headers
export function buildResponse(statusCode, body, origin) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(origin),
            ...getSecurityHeaders()
        },
        body: JSON.stringify(body)
    };
}