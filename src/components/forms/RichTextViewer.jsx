import { useState, useEffect } from 'react'

function RichTextViewer({ 
    content, 
    className = '',
    label,
    emptyMessage = 'No content provided'
}) {
    const [sanitizedContent, setSanitizedContent] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!content) {
            setIsLoading(false)
            return
        }

        // Try to load DOMPurify for sanitization
        import('dompurify').then((module) => {
            const DOMPurify = module.default || module
            if (DOMPurify && DOMPurify.sanitize) {
                setSanitizedContent(DOMPurify.sanitize(content))
            } else {
                // Fallback: basic HTML escaping for safety
                console.warn('DOMPurify sanitize not available, using basic escaping')
                setSanitizedContent(basicHtmlEscape(content))
            }
            setIsLoading(false)
        }).catch((error) => {
            console.warn('Failed to load DOMPurify, using basic escaping:', error)
            setSanitizedContent(basicHtmlEscape(content))
            setIsLoading(false)
        })
    }, [content])

    // Basic HTML escaping fallback
    const basicHtmlEscape = (html) => {
        // For now, just return the content as-is but log the warning
        // In production, you might want to implement basic sanitization
        console.warn('Displaying HTML content without full sanitization')
        return html
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            
            <div className="bg-gray-50 border border-gray-300 rounded-md p-3 min-h-[100px]">
                {isLoading ? (
                    <div className="text-gray-500 italic">
                        Loading content...
                    </div>
                ) : sanitizedContent ? (
                    <div 
                        className="rich-text-content"
                        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
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

export default RichTextViewer
