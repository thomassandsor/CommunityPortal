#!/usr/bin/env node

/**
 * Security Testing Script for Community Portal
 * Tests the security improvements implemented in the Netlify Functions
 */

import fs from 'fs';
import path from 'path';

console.log('🔒 Community Portal Security Testing');
console.log('=====================================\n');

// Test 1: Check for exposed secrets in build output
function testBuildSecrets() {
    console.log('1. Testing build output for exposed secrets...');
    
    const distDir = './dist';
    if (!fs.existsSync(distDir)) {
        console.log('   ❌ Build directory not found. Run npm run build first.');
        return false;
    }
    
    const sensitivePatterns = [
        /CLIENT_SECRET/gi,
        /TENANT_ID/gi,
        /CLERK_SECRET_KEY/gi,
        /DATAVERSE_URL/gi,
        /sk_[a-zA-Z0-9]+/g // Clerk secret key pattern
    ];
    
    let hasSecrets = false;
    
    function checkFile(filePath) {
        if (path.extname(filePath) === '.js') {
            const content = fs.readFileSync(filePath, 'utf8');
            for (const pattern of sensitivePatterns) {
                if (pattern.test(content)) {
                    console.log(`   ❌ Found potential secret in ${filePath}: ${pattern}`);
                    hasSecrets = true;
                }
            }
        }
    }
    
    function walkDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                walkDir(filePath);
            } else {
                checkFile(filePath);
            }
        }
    }
    
    walkDir(distDir);
    
    if (!hasSecrets) {
        console.log('   ✅ No sensitive secrets found in build output');
    }
    
    // Check for VITE_CLERK_PUBLISHABLE_KEY (this should be present)
    const jsFiles = fs.readdirSync(path.join(distDir, 'assets')).filter(f => f.endsWith('.js'));
    let hasPublishableKey = false;
    
    for (const file of jsFiles) {
        const content = fs.readFileSync(path.join(distDir, 'assets', file), 'utf8');
        if (content.includes('VITE_CLERK') || content.includes('pk_')) {
            hasPublishableKey = true;
            break;
        }
    }
    
    if (hasPublishableKey) {
        console.log('   ✅ Clerk publishable key correctly included in frontend');
    } else {
        console.log('   ⚠️  Clerk publishable key not found in frontend build');
    }
    
    return !hasSecrets;
}

// Test 2: Check function security implementations
function testFunctionSecurity() {
    console.log('\n2. Testing function security implementations...');
    
    const authFile = './functions/auth.js';
    const contactFile = './functions/contact.js';
    const securityUtilsFile = './functions/security-utils.js';
    
    let score = 0;
    let total = 0;
    
    // Check if security utils exist
    total++;
    if (fs.existsSync(securityUtilsFile)) {
        console.log('   ✅ Security utilities implemented');
        score++;
    } else {
        console.log('   ❌ Security utilities missing');
    }
    
    // Check auth.js improvements
    if (fs.existsSync(authFile)) {
        const authContent = fs.readFileSync(authFile, 'utf8');
        
        total++;
        if (authContent.includes('sanitizeError')) {
            console.log('   ✅ Auth function uses error sanitization');
            score++;
        } else {
            console.log('   ❌ Auth function missing error sanitization');
        }
        
        total++;
        if (authContent.includes('SecureLogger')) {
            console.log('   ✅ Auth function uses secure logging');
            score++;
        } else {
            console.log('   ❌ Auth function missing secure logging');
        }
        
        total++;
        if (authContent.includes('checkRateLimit')) {
            console.log('   ✅ Auth function implements rate limiting');
            score++;
        } else {
            console.log('   ❌ Auth function missing rate limiting');
        }
        
        total++;
        if (authContent.includes('buildResponse')) {
            console.log('   ✅ Auth function uses security headers');
            score++;
        } else {
            console.log('   ❌ Auth function missing security headers');
        }
    }
    
    // Check contact.js improvements
    if (fs.existsSync(contactFile)) {
        const contactContent = fs.readFileSync(contactFile, 'utf8');
        
        total++;
        if (contactContent.includes('InputValidator')) {
            console.log('   ✅ Contact function uses input validation');
            score++;
        } else {
            console.log('   ❌ Contact function missing input validation');
        }
        
        total++;
        if (contactContent.includes('sanitizeError')) {
            console.log('   ✅ Contact function uses error sanitization');
            score++;
        } else {
            console.log('   ❌ Contact function missing error sanitization');
        }
    }
    
    console.log(`\n   Security Implementation Score: ${score}/${total} (${Math.round(score/total*100)}%)`);
    return score / total;
}

// Test 3: Check for security documentation
function testSecurityDocumentation() {
    console.log('\n3. Testing security documentation...');
    
    let score = 0;
    let total = 0;
    
    total++;
    if (fs.existsSync('./SECURITY_ASSESSMENT.md')) {
        console.log('   ✅ Security assessment document exists');
        score++;
    } else {
        console.log('   ❌ Security assessment document missing');
    }
    
    total++;
    if (fs.existsSync('./SECURITY_IMPLEMENTATION.md')) {
        console.log('   ✅ Security implementation guide exists');
        score++;
    } else {
        console.log('   ❌ Security implementation guide missing');
    }
    
    // Check README for security mentions
    total++;
    if (fs.existsSync('./README.md')) {
        const readmeContent = fs.readFileSync('./README.md', 'utf8');
        if (readmeContent.includes('Security') || readmeContent.includes('security')) {
            console.log('   ✅ README includes security information');
            score++;
        } else {
            console.log('   ❌ README missing security information');
        }
    }
    
    console.log(`\n   Documentation Score: ${score}/${total} (${Math.round(score/total*100)}%)`);
    return score / total;
}

// Test 4: Environment variable usage check
function testEnvironmentVariables() {
    console.log('\n4. Testing environment variable usage...');
    
    const frontendFiles = ['./src/main.jsx', './src/App.jsx'];
    const backendFiles = ['./functions/auth.js', './functions/contact.js'];
    
    let frontendSecure = true;
    let backendSecure = true;
    
    // Check frontend files
    console.log('   Checking frontend environment variable usage...');
    for (const file of frontendFiles) {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            
            // Should only use VITE_ prefixed variables
            const envMatches = content.match(/import\.meta\.env\.([A-Z_]+)/g);
            if (envMatches) {
                for (const match of envMatches) {
                    const varName = match.replace('import.meta.env.', '');
                    if (!varName.startsWith('VITE_')) {
                        console.log(`   ❌ Frontend uses non-VITE environment variable: ${varName}`);
                        frontendSecure = false;
                    }
                }
            }
        }
    }
    
    if (frontendSecure) {
        console.log('   ✅ Frontend only uses VITE_ prefixed environment variables');
    }
    
    // Check backend files
    console.log('   Checking backend environment variable usage...');
    for (const file of backendFiles) {
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            
            // Should not expose secrets in error messages
            if (content.includes('process.env') && content.includes('console.log')) {
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes('console.log') && lines[i].includes('process.env')) {
                        console.log(`   ⚠️  Potential secret logging in ${file}:${i+1}`);
                        backendSecure = false;
                    }
                }
            }
        }
    }
    
    if (backendSecure) {
        console.log('   ✅ Backend does not expose secrets in logs');
    }
    
    return frontendSecure && backendSecure;
}

// Run all tests
async function runAllTests() {
    const results = [];
    
    results.push(testBuildSecrets());
    results.push(testFunctionSecurity());
    results.push(testSecurityDocumentation());
    results.push(testEnvironmentVariables());
    
    console.log('\n📊 Overall Security Assessment');
    console.log('===============================');
    
    const passed = results.filter(r => r === true || r > 0.7).length;
    const total = results.length;
    const score = Math.round(passed / total * 100);
    
    console.log(`Tests Passed: ${passed}/${total}`);
    console.log(`Security Score: ${score}%`);
    
    if (score >= 80) {
        console.log('🟢 GOOD: Security implementation meets recommended standards');
    } else if (score >= 60) {
        console.log('🟡 FAIR: Security implementation needs some improvements');
    } else {
        console.log('🔴 POOR: Security implementation requires significant improvements');
    }
    
    console.log('\nFor detailed security recommendations, see SECURITY_ASSESSMENT.md');
    console.log('For implementation guidance, see SECURITY_IMPLEMENTATION.md');
    
    process.exit(score >= 60 ? 0 : 1);
}

runAllTests().catch(console.error);