import DOMPurify from 'dompurify'

// 🔒 SECURITY: Configure DOMPurify with strict allowlist (same as editor)
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3']
const ALLOWED_ATTR = ['style'] // Only allow style attribute for formatting

const sanitizeConfig = {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
}

function SimpleRichTextViewer({ 
    content, 
    className = '',
    label,
    emptyMessage = 'No content provided'
}) {
    // 🔒 SECURITY: Enhanced HTML sanitization using DOMPurify with list styling enhancement
    const sanitizeAndEnhanceHtml = (html) => {
        if (!html) return ''
        
        // 🔒 SECURITY: First sanitize with DOMPurify to remove dangerous content
        const sanitized = DOMPurify.sanitize(html, sanitizeConfig)
        
        // Create a temporary element to enhance list styling
        const temp = document.createElement('div')
        temp.innerHTML = sanitized
        
        // Enhance list styling - force proper list appearance
        const ulElements = temp.querySelectorAll('ul')
        ulElements.forEach(ul => {
            ul.style.listStyleType = 'disc'
            ul.style.listStylePosition = 'outside'
            ul.style.marginLeft = '2rem'
            ul.style.paddingLeft = '0'
            ul.style.marginTop = '0.5rem'
            ul.style.marginBottom = '0.5rem'
        })
        
        const olElements = temp.querySelectorAll('ol')
        olElements.forEach(ol => {
            ol.style.listStyleType = 'decimal'
            ol.style.listStylePosition = 'outside'
            ol.style.marginLeft = '2rem'
            ol.style.paddingLeft = '0'
            ol.style.marginTop = '0.5rem'
            ol.style.marginBottom = '0.5rem'
        })
        
        const liElements = temp.querySelectorAll('li')
        liElements.forEach(li => {
            li.style.display = 'list-item'
            li.style.marginBottom = '0.25rem'
            li.style.paddingLeft = '0.5rem'
        })
        
        return temp.innerHTML
    }

    const sanitizedContent = sanitizeAndEnhanceHtml(content)

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            
            <div className="bg-gray-50 border border-gray-300 rounded-md p-3 min-h-[100px]">
                {sanitizedContent ? (
                    <div 
                        className="rich-text-display"
                        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                        style={{
                            // Enhanced styling for rich text content
                            lineHeight: '1.6',
                            color: '#374151',
                            fontFamily: 'inherit'
                        }}
                    />
                ) : (
                    <div className="text-gray-500 italic">
                        {emptyMessage}
                    </div>
                )}
            </div>
        </div>
    )
}

export default SimpleRichTextViewer
