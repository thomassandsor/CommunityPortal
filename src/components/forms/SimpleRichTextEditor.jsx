import { useState, useRef, useEffect } from 'react'
import DOMPurify from 'dompurify'

// 🔒 SECURITY: Configure DOMPurify with strict allowlist
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3']
const ALLOWED_ATTR = ['style'] // Only allow style attribute for formatting

// Configure DOMPurify once
const sanitizeConfig = {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false, // Block data-* attributes
    KEEP_CONTENT: true, // Keep text content even if tags are removed
}

/**
 * 🔒 SECURITY: Sanitize HTML content using DOMPurify
 * Removes all potentially dangerous tags and attributes while preserving safe formatting
 */
const sanitizeHTML = (html) => {
    if (!html) return ''
    return DOMPurify.sanitize(html, sanitizeConfig)
}

function SimpleRichTextEditor({ 
    value, 
    onChange, 
    disabled = false, 
    placeholder = "Enter rich text content...",
    label,
    required = false,
    error 
}) {
    const [isEditing, setIsEditing] = useState(false)
    const editorRef = useRef(null)
    const [localContent, setLocalContent] = useState(value || '')

    // Sync external value changes
    useEffect(() => {
        if (value !== localContent && !isEditing) {
            // 🔒 SECURITY: Sanitize incoming value from Dataverse
            const sanitized = sanitizeHTML(value || '')
            setLocalContent(sanitized)
            if (editorRef.current) {
                editorRef.current.innerHTML = sanitized
            }
        }
    }, [value, isEditing]) // Removed localContent from dependency array

    // Set initial content when component mounts
    useEffect(() => {
        if (editorRef.current && value) {
            console.log('🔍 Initial Dataverse HTML structure:', value)
            // 🔒 SECURITY: Sanitize initial value
            const sanitized = sanitizeHTML(value)
            editorRef.current.innerHTML = sanitized
            setLocalContent(sanitized)
        }
    }, []) // Run only once on mount

    const handleToolbarAction = (command, value = null) => {
        // Special handling for list commands to create Dataverse-compatible structure
        if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
            // Focus the editor first
            editorRef.current.focus()
            
            // Execute the command
            document.execCommand(command, false, value)
            
            // Convert to Dataverse format after a short delay
            setTimeout(() => {
                const lists = editorRef.current.querySelectorAll('ul, ol')
                lists.forEach(list => {
                    // Add Dataverse list styling
                    list.style.listStylePosition = 'inside'
                    
                    // Handle list items
                    const items = list.querySelectorAll('li')
                    items.forEach(item => {
                        // Clean up any malformed structures
                        if (item.innerHTML.includes('<div>') || item.innerHTML.includes('<br>')) {
                            const text = item.textContent.trim()
                            if (text) {
                                if (list.tagName.toLowerCase() === 'ul') {
                                    // For bullet lists, wrap in <p> with margin: 0
                                    item.innerHTML = `<p style="margin: 0;">${text}</p>`
                                } else {
                                    // For numbered lists, also use <p> wrapper (same as bullets)
                                    item.innerHTML = `<p style="margin: 0;">${text}</p>`
                                }
                            }
                        } else {
                            // Handle existing content based on list type
                            const text = item.textContent.trim()
                            if (text) {
                                if (list.tagName.toLowerCase() === 'ul') {
                                    // For bullet lists, ensure <p> wrapper exists
                                    if (!item.innerHTML.includes('<p')) {
                                        item.innerHTML = `<p style="margin: 0;">${text}</p>`
                                    }
                                } else {
                                    // For numbered lists, also use <p> wrapper (same as bullets)
                                    if (!item.innerHTML.includes('<p')) {
                                        item.innerHTML = `<p style="margin: 0;">${text}</p>`
                                    }
                                }
                            }
                        }
                        
                        // Remove unnecessary styling
                        item.removeAttribute('style')
                    })
                })
                handleContentChange()
            }, 100)
        } else {
            document.execCommand(command, false, value)
            editorRef.current.focus()
            handleContentChange()
        }
    }

    const handleContentChange = () => {
        if (editorRef.current) {
            let content = editorRef.current.innerHTML
            
            // Convert standard browser list format to Dataverse format
            content = convertToDataverseListFormat(content)
            
            // 🔒 SECURITY: Sanitize content before saving
            content = sanitizeHTML(content)
            
            // Debug list structures
            const lists = editorRef.current.querySelectorAll('ul, ol')
            if (lists.length > 0) {
                console.log('📝 List structures found:', lists.length)
                lists.forEach((list, index) => {
                    console.log(`List ${index}:`, list.outerHTML)
                })
                console.log('🚀 Content being saved to Dataverse:', content)
            }
            
            setLocalContent(content)
            onChange(content)
        }
    }

    // Convert standard HTML lists to Dataverse format
    const convertToDataverseListFormat = (html) => {
        console.log('🔄 Converting HTML to Dataverse format. Input:', html)
        
        // Convert unordered lists to Dataverse format
        html = html.replace(/<ul([^>]*)>/gi, '<ul style="list-style-position: inside;">');
        
        // Convert ordered lists to Dataverse format  
        html = html.replace(/<ol([^>]*)>/gi, '<ol style="list-style-position: inside;">');
        
        // Handle unordered list items (bullet points) - wrap in <p> with margin: 0
        html = html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (ulMatch, innerContent) => {
            console.log('📍 Processing UL:', ulMatch)
            const processedInner = innerContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (liMatch, content) => {
                const trimmedContent = content.trim();
                console.log('🔸 UL item content:', trimmedContent)
                
                // If content doesn't already have <p> wrapper, add it
                if (trimmedContent && !trimmedContent.match(/<p[^>]*style="margin:\s*0;"[^>]*>/i)) {
                    // Remove any existing <p> tags first, then add the correct one
                    const cleanContent = trimmedContent.replace(/<\/?p[^>]*>/gi, '');
                    const result = `<li><p style="margin: 0;">${cleanContent}</p></li>`;
                    console.log('🔸 UL item converted to:', result)
                    return result;
                }
                return liMatch;
            });
            return `<ul style="list-style-position: inside;">${processedInner}</ul>`;
        });
        
        // Handle ordered list items (numbers) - also use <p> wrapper like bullet points
        html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (olMatch, innerContent) => {
            console.log('🔢 Processing OL:', olMatch)
            const processedInner = innerContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (liMatch, content) => {
                const trimmedContent = content.trim();
                console.log('🔹 OL item content:', trimmedContent)
                
                // For numbered lists, also wrap in <p> with margin: 0 (same as bullet lists)
                if (trimmedContent && !trimmedContent.match(/<p[^>]*style="margin:\s*0;"[^>]*>/i)) {
                    // Remove any existing <p> tags first, then add the correct one
                    const cleanContent = trimmedContent.replace(/<\/?p[^>]*>/gi, '');
                    const result = `<li><p style="margin: 0;">${cleanContent}</p></li>`;
                    console.log('🔹 OL item converted to:', result)
                    return result;
                }
                return liMatch;
            });
            return `<ol style="list-style-position: inside;">${processedInner}</ol>`;
        });
        
        console.log('✅ Final converted HTML:', html)
        return html;
    }

    const handleFocus = () => {
        setIsEditing(true)
    }

    const handleBlur = () => {
        setIsEditing(false)
        // Ensure final content is properly formatted for Dataverse
        if (editorRef.current) {
            let finalContent = editorRef.current.innerHTML
            finalContent = convertToDataverseListFormat(finalContent)
            
            // 🔒 SECURITY: Final sanitization before saving to Dataverse
            finalContent = sanitizeHTML(finalContent)
            
            console.log('🎯 Final content on blur (saving to Dataverse):', finalContent)
            console.log('🎯 First 200 characters:', finalContent.substring(0, 200))
            console.log('🎯 Content starts with <p tag?', finalContent.startsWith('<p'))
            setLocalContent(finalContent)
            onChange(finalContent)
        }
    }

    const handleKeyDown = (e) => {
        // Handle common keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'b':
                    e.preventDefault()
                    handleToolbarAction('bold')
                    break
                case 'i':
                    e.preventDefault()
                    handleToolbarAction('italic')
                    break
                case 'u':
                    e.preventDefault()
                    handleToolbarAction('underline')
                    break
            }
        }
    }

    const toolbar = [
        { command: 'bold', icon: 'B', title: 'Bold (Ctrl+B)', className: 'font-bold' },
        { command: 'italic', icon: 'I', title: 'Italic (Ctrl+I)', className: 'italic' },
        { command: 'underline', icon: 'U', title: 'Underline (Ctrl+U)', className: 'underline' },
        { separator: true },
        { command: 'insertUnorderedList', icon: '•', title: 'Bullet List' },
        { command: 'insertOrderedList', icon: '1.', title: 'Numbered List' },
        { separator: true },
        { command: 'justifyLeft', icon: '⌐', title: 'Align Left' },
        { command: 'justifyCenter', icon: '≡', title: 'Align Center' },
        { command: 'justifyRight', icon: '¬', title: 'Align Right' },
        { separator: true },
        { command: 'removeFormat', icon: '✗', title: 'Clear Formatting' }
    ]

    return (
        <div className="space-y-2">
            {/* CSS for proper list display matching Dataverse format */}
            <style>{`
                .rich-text-editor-content ul {
                    list-style-type: disc !important;
                    list-style-position: inside !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.5rem !important;
                    padding-left: 0 !important;
                }
                
                .rich-text-editor-content ol {
                    list-style-type: decimal !important;
                    list-style-position: inside !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.5rem !important;
                    padding-left: 0 !important;
                }
                
                .rich-text-editor-content li {
                    display: list-item !important;
                    margin-bottom: 0.25rem !important;
                }
                
                .rich-text-editor-content li p {
                    margin: 0 !important;
                    display: inline !important;
                }
                
                .rich-text-editor-content p {
                    margin-bottom: 0.5rem !important;
                }
                
                .rich-text-editor-content h1,
                .rich-text-editor-content h2,
                .rich-text-editor-content h3 {
                    font-weight: bold !important;
                    margin-top: 1rem !important;
                    margin-bottom: 0.5rem !important;
                }
                
                .rich-text-editor-content h1 { font-size: 1.5rem !important; }
                .rich-text-editor-content h2 { font-size: 1.25rem !important; }
                .rich-text-editor-content h3 { font-size: 1.125rem !important; }
                
                .rich-text-editor-content strong { font-weight: bold !important; }
                .rich-text-editor-content em { font-style: italic !important; }
                .rich-text-editor-content u { text-decoration: underline !important; }
                .rich-text-editor-content s { text-decoration: line-through !important; }
            `}</style>
            
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            
            <div className={`border border-gray-300 rounded-md relative ${disabled ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
                {/* Toolbar */}
                {!disabled && (
                    <div className="border-b border-gray-200 px-3 py-2 flex items-center space-x-1 bg-gray-50">
                        {toolbar.map((tool, index) => (
                            tool.separator ? (
                                <div key={index} className="w-px h-6 bg-gray-300 mx-2" />
                            ) : (
                                <button
                                    key={tool.command}
                                    type="button"
                                    onClick={() => handleToolbarAction(tool.command)}
                                    className={`px-2 py-1 text-sm border border-transparent rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${tool.className || ''}`}
                                    title={tool.title}
                                >
                                    {tool.icon}
                                </button>
                            )
                        ))}
                    </div>
                )}

                {/* Editor */}
                <div
                    ref={editorRef}
                    contentEditable={!disabled}
                    onInput={handleContentChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className={`rich-text-editor-content min-h-[200px] p-3 focus:outline-none ${disabled ? 'cursor-not-allowed' : 'cursor-text'}`}
                    style={{
                        minHeight: '200px',
                        maxHeight: '400px',
                        overflowY: 'auto'
                    }}
                    suppressContentEditableWarning={true}
                />

                {/* Placeholder */}
                {!localContent && !disabled && (
                    <div 
                        className="absolute text-gray-400 pointer-events-none"
                        style={{ 
                            top: disabled ? '12px' : '56px',
                            left: '12px'
                        }}
                    >
                        {placeholder}
                    </div>
                )}
            </div>

            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}
            
            {/* Character count for non-disabled mode */}
            {!disabled && localContent && (
                <div className="text-xs text-gray-500 text-right">
                    Content length: {localContent.length} characters
                </div>
            )}
        </div>
    )
}

export default SimpleRichTextEditor
