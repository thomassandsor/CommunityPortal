function SimpleRichTextViewer({ 
    content, 
    className = '',
    label,
    emptyMessage = 'No content provided'
}) {
    // Simple HTML sanitization and list styling enhancement
    const sanitizeAndEnhanceHtml = (html) => {
        if (!html) return ''
        
        // Create a temporary element to parse HTML
        const temp = document.createElement('div')
        temp.innerHTML = html
        
        // Remove script tags and event handlers
        const scripts = temp.querySelectorAll('script')
        scripts.forEach(script => script.remove())
        
        // Remove dangerous attributes
        const allElements = temp.querySelectorAll('*')
        allElements.forEach(element => {
            // Keep only safe attributes
            const safeAttributes = ['class', 'style', 'href', 'src', 'alt', 'title']
            const attributes = [...element.attributes]
            attributes.forEach(attr => {
                if (!safeAttributes.includes(attr.name.toLowerCase()) && 
                    !attr.name.startsWith('data-')) {
                    element.removeAttribute(attr.name)
                }
            })
            
            // Remove javascript: links
            if (element.href && element.href.startsWith('javascript:')) {
                element.removeAttribute(attr.name)
            }
        })
        
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
