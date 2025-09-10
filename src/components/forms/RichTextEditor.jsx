import { useState, useEffect } from 'react'

// Dynamic import to avoid SSR issues
const ReactQuillWrapper = ({ value, onChange, disabled, placeholder }) => {
    const [ReactQuill, setReactQuill] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Dynamically import ReactQuill to avoid SSR issues
        Promise.all([
            import('react-quill'),
            import('react-quill/dist/quill.snow.css')
        ]).then(([quillModule]) => {
            // Handle both default and named exports
            const QuillComponent = quillModule.default || quillModule
            setReactQuill(() => QuillComponent)
            setIsLoading(false)
        }).catch((error) => {
            console.warn('Failed to load ReactQuill:', error)
            setIsLoading(false)
        })
    }, [])

    if (isLoading) {
        return (
            <div className="min-h-[200px] border border-gray-300 rounded-md p-3 bg-gray-50">
                <div className="flex items-center justify-center h-32">
                    <div className="text-gray-500">Loading rich text editor...</div>
                </div>
            </div>
        )
    }

    if (!ReactQuill) {
        // Fallback to textarea if ReactQuill failed to load
        return (
            <textarea
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                className="min-h-[200px] w-full border border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500"
                rows={8}
            />
        )
    }

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['link'],
            ['clean']
        ],
    }

    const formats = [
        'header',
        'bold', 'italic', 'underline', 'strike',
        'list', 'bullet',
        'align',
        'link'
    ]

    return (
        <ReactQuill
            theme="snow"
            value={value || ''}
            onChange={onChange}
            readOnly={disabled}
            placeholder={placeholder}
            modules={modules}
            formats={formats}
            style={{
                backgroundColor: disabled ? '#f9fafb' : 'white',
                minHeight: '200px'
            }}
        />
    )
}

function RichTextEditor({ 
    value, 
    onChange, 
    disabled = false, 
    placeholder = "Enter rich text content...",
    label,
    required = false,
    error 
}) {
    const [hasError, setHasError] = useState(false)

    const handleChange = (content) => {
        try {
            // ReactQuill returns HTML content
            onChange(content)
        } catch (err) {
            console.error('Error in rich text editor:', err)
            setHasError(true)
        }
    }

    // Fallback to textarea if there's an error
    if (hasError) {
        return (
            <div className="space-y-2">
                {label && (
                    <label className="block text-sm font-medium text-gray-700">
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                <textarea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    placeholder={placeholder}
                    className="min-h-[200px] w-full border border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500"
                    rows={8}
                />
                <p className="text-sm text-yellow-600">
                    Rich text editor failed to load. Using fallback text area.
                </p>
                {error && (
                    <p className="text-sm text-red-600">{error}</p>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            
            <div className={`rich-text-editor ${disabled ? 'opacity-60' : ''}`}>
                <ReactQuillWrapper
                    value={value}
                    onChange={handleChange}
                    disabled={disabled}
                    placeholder={placeholder}
                />
            </div>
            
            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}
            
            {/* Character count for non-disabled mode */}
            {!disabled && value && (
                <div className="text-xs text-gray-500 text-right">
                    Content length: {value.length} characters
                </div>
            )}
        </div>
    )
}

export default RichTextEditor
