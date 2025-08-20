# 🔒 Security Implementation Guide

## Overview
This document provides practical implementation steps for the security recommendations identified in the security assessment.

## Implementation Priority

### 🔴 Critical (Implement Immediately)
1. Sanitize error messages
2. Implement restrictive CORS policy  
3. Reduce production logging

### 🟡 High (Implement Soon)
4. Add security headers
5. Implement rate limiting
6. Add input validation

## Detailed Implementation

### 1. Error Message Sanitization

**Problem**: Raw error messages from Azure AD and Dataverse are exposed to clients.

**Solution**: Implement error sanitization utility.

```javascript
// utils/errorHandler.js
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
```

### 2. CORS Policy Configuration

**Problem**: Wildcard CORS (`*`) allows requests from any domain.

**Solution**: Implement domain-specific CORS.

```javascript
// utils/corsHandler.js
export function getCorsHeaders(origin) {
    const allowedOrigins = [
        process.env.NETLIFY_URL, // Netlify deployment URL
        process.env.DEPLOY_PRIME_URL, // Branch deploys
        'http://localhost:3000', // Local development
        'http://localhost:5173', // Vite dev server
        'http://localhost:8888', // Netlify dev
        // Add your production domain here
        'https://your-domain.com'
    ].filter(Boolean);
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.includes(origin) || 
                     (origin && allowedOrigins.some(allowed => 
                         origin.includes(allowed.replace('https://', '').replace('http://', ''))
                     ));
    
    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Max-Age': '86400' // 24 hours
    };
}
```

### 3. Production Logging Configuration

**Problem**: Sensitive data logged to console in production.

**Solution**: Implement secure logging utility.

```javascript
// utils/logger.js
const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn', 
    INFO: 'info',
    DEBUG: 'debug'
};

const isProduction = process.env.NODE_ENV === 'production';

export class SecureLogger {
    static sanitizeData(data) {
        if (typeof data !== 'object') return data;
        
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
            console.error(message); // Only log message in production
        } else {
            console.error(message, this.sanitizeData(data));
        }
    }
    
    static info(message, data = null) {
        if (!isProduction) {
            console.log(message, this.sanitizeData(data));
        }
        // In production, only log critical info
    }
    
    static debug(message, data = null) {
        if (!isProduction) {
            console.debug(message, this.sanitizeData(data));
        }
        // Never log debug info in production
    }
}
```

### 4. Security Headers Implementation

**Problem**: Missing security headers in responses.

**Solution**: Add comprehensive security headers.

```javascript
// utils/securityHeaders.js
export function getSecurityHeaders() {
    return {
        // Prevent MIME type sniffing
        'X-Content-Type-Options': 'nosniff',
        
        // Prevent embedding in frames (clickjacking protection)
        'X-Frame-Options': 'DENY',
        
        // XSS protection (legacy browsers)
        'X-XSS-Protection': '1; mode=block',
        
        // Referrer policy
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        
        // Content Security Policy (basic)
        'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://clerk.dev",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "connect-src 'self' https://api.clerk.dev https://login.microsoftonline.com https://*.dynamics.com",
            "font-src 'self' https:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; '),
        
        // Strict Transport Security (HTTPS only)
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        
        // Permissions Policy
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
}
```

### 5. Rate Limiting Implementation

**Problem**: No protection against abuse or brute force attacks.

**Solution**: Implement simple rate limiting.

```javascript
// utils/rateLimiter.js
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // Max requests per window

export function checkRateLimit(identifier, customLimit = MAX_REQUESTS) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;
    
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
```

### 6. Input Validation

**Problem**: Limited validation on user inputs.

**Solution**: Comprehensive input validation.

```javascript
// utils/validation.js
export class InputValidator {
    static email(email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }
    
    static phone(phone) {
        // Basic international phone validation
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return phone === '' || phoneRegex.test(phone);
    }
    
    static name(name) {
        // Allow letters, spaces, hyphens, apostrophes
        const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
        return name === '' || (nameRegex.test(name) && name.length <= 50);
    }
    
    static sanitizeString(str) {
        if (typeof str !== 'string') return '';
        
        // Remove potential script tags and normalize
        return str
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/[<>]/g, '')
            .trim()
            .substring(0, 255); // Limit length
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
```

## Environment Configuration

Add these environment variables to Netlify:

```env
# Security Configuration
NODE_ENV=production
ALLOWED_ORIGINS=https://your-domain.com,https://your-dev-domain.com
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MINUTES=15
```

## Testing Security Improvements

```bash
# Test CORS headers
curl -H "Origin: https://malicious-site.com" https://your-site.netlify.app/.netlify/functions/auth

# Test rate limiting
for i in {1..101}; do curl https://your-site.netlify.app/.netlify/functions/contact; done

# Test input validation
curl -X POST https://your-site.netlify.app/.netlify/functions/contact \
  -H "Content-Type: application/json" \
  -d '{"emailaddress1":"<script>alert(1)</script>","firstname":"test"}'
```

## Monitoring & Alerts

Consider implementing:

1. **Log Monitoring**: Track error patterns and potential attacks
2. **Rate Limit Alerts**: Notify when rate limits are hit frequently  
3. **Security Headers Monitoring**: Verify headers are properly set
4. **Failed Auth Monitoring**: Track failed authentication attempts

## Conclusion

These implementations provide a solid security foundation while maintaining functionality. Remember to:

- Test all changes in development first
- Monitor logs after deployment
- Regularly review and update security measures
- Keep dependencies updated
- Consider professional security audits for production systems