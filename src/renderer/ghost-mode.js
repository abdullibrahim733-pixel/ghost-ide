// Ghost Language Mode for CodeMirror
// ====================================

CodeMirror.defineSimpleMode('ghost', {
    start: [
        // Comments
        { regex: /#.*$/, token: 'comment' },
        
        // Keywords
        { regex: /\b(let|changeable|async|task|loop|wait|if|elif|else|break|continue|return|pull|structure|static|true|false|null|inside|reward|punish|mutate_lifecycle|run)\b/, token: 'keyword' },
        
        // Plasticity keywords (special highlight)
        { regex: /\b(reward|punish|mutate_lifecycle)\b/, token: 'plasticity' },
        
        // Built-in functions
        { regex: /\b(print|println|read_line|random|random_int|tensor|millis)\b/, token: 'builtin' },
        
        // Types
        { regex: /\b(u8|u16|u32|u64|i8|i16|i32|i64|f32|f64|bool|unit|tensor|Pin|Model|ADC|I2C|SPI|UART|GPIO)\b/, token: 'type' },
        
        // Tensor type with shape
        { regex: /tensor\s*<\s*[a-zA-Z_][a-zA-Z0-9_]*\s*,\s*\[[^\]]*\]\s*>/, token: 'tensor' },
        
        // Pin type
        { regex: /Pin\s*<\s*[A-Z]+[0-9]+,\s*(Output|Input|AltFunc|Analog)(\s*,\s*[A-Z]+)*\s*>/, token: 'pin' },
        
        // Attributes
        { regex: /#\[[^\]]*\]/, token: 'attribute' },
        
        // Numbers
        { regex: /\b\d+_\d+(\.\d+)?\b/, token: 'number' }, // with underscores
        { regex: /\b0x[0-9a-fA-F]+\b/, token: 'number hex' },
        { regex: /\b0b[01]+\b/, token: 'number binary' },
        { regex: /\b\d+(\.\d+)?([eE][+-]?\d+)?\b/, token: 'number' },
        
        // Strings
        { regex: /"/, token: 'string', next: 'string_double' },
        { regex: /'/, token: 'string', next: 'string_single' },
        
        // Identifiers and variables
        { regex: /[a-zA-Z_][a-zA-Z0-9_]*/, token: 'variable' },
        
        // Operators
        { regex: /(\+\+|--|\+=|-=|\*=|\/=|%=|==|!=|<=|>=|&&|\|\||<<|>>|[+\-*/%<>=!&|^~])/, token: 'operator' },
        
        // Punctuation
        { regex: /[{}[\](),;:.]/, token: 'punctuation' },
        
        // Arrow and fat arrow
        { regex: /->|=>/, token: 'operator' },
        
        // Colon-colon for module paths
        { regex: /::/, token: 'punctuation' }
    ],
    
    string_double: [
        { regex: /\\./, token: 'string-2' },
        { regex: /[^"\\]+/, token: 'string' },
        { regex: /"/, token: 'string', next: 'start' }
    ],
    
    string_single: [
        { regex: /\\./, token: 'string-2' },
        { regex: /[^'\\]+/, token: 'string' },
        { regex: /'/, token: 'string', next: 'start' }
    ],
    
    meta: {
        dontIndentStates: ['comment'],
        lineComment: '#',
        fold: 'indent'
    }
});

// Ghost Language Hinting (for autocomplete)
CodeMirror.registerHelper('hint', 'ghost', (editor, options) => {
    const keywords = [
        'let', 'changeable', 'async', 'task', 'loop', 'wait', 'if', 'elif', 'else',
        'break', 'continue', 'return', 'pull', 'structure', 'static', 'true', 'false',
        'null', 'inside', 'reward', 'punish', 'mutate_lifecycle', 'run'
    ];
    
    const builtins = [
        'print', 'println', 'read_line', 'random', 'random_int', 'tensor', 'millis',
        'gpio_mode', 'gpio_write', 'gpio_read', 'i2c_init', 'i2c_write', 'i2c_read',
        'spi_init', 'spi_transfer', 'uart_init', 'uart_write', 'uart_read'
    ];
    
    const types = [
        'u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64', 'f32', 'f64', 'bool', 'unit',
        'tensor', 'Pin', 'Model', 'ADC', 'I2C', 'SPI', 'UART', 'GPIO'
    ];
    
    const plasticity = [
        'reward', 'punish', 'mutate_lifecycle'
    ];
    
    const all = [...keywords, ...builtins, ...types, ...plasticity];
    
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const start = Math.max(0, cursor.ch - 20);
    const end = cursor.ch;
    const token = line.slice(start, end);
    const match = token.match(/[a-zA-Z_][a-zA-Z0-9_]*$/);
    
    if (!match) return null;
    
    const prefix = match[0];
    const suggestions = all
        .filter(k => k.startsWith(prefix))
        .map(k => ({
            text: k,
            displayText: k,
            className: keywords.includes(k) ? 'cm-hint-keyword' : 
                       builtins.includes(k) ? 'cm-hint-builtin' :
                       types.includes(k) ? 'cm-hint-type' : 'cm-hint-plasticity'
        }));
    
    return {
        list: suggestions,
        from: CodeMirror.Pos(cursor.line, cursor.ch - prefix.length),
        to: cursor
    };
});

// Ghost Language Linting
CodeMirror.registerHelper('lint', 'ghost', (text, options) => {
    const errors = [];
    const lines = text.split('\n');
    
    lines.forEach((line, lineNum) => {
        // Check for common errors
        if (/\b(reward|punish|mutate_lifecycle)\b/.test(line) && !/by\s+\d+(\.\d+)?/.test(line)) {
            errors.push({
                from: CodeMirror.Pos(lineNum, 0),
                to: CodeMirror.Pos(lineNum, line.length),
                message: 'Plasticity operations require "by <amount>"',
                severity: 'warning'
            });
        }
        
        // Check for tensor type without shape
        if (/tensor\s*<[^>]*>$/.test(line) && !/tensor\s*<[^>]*\s*,\s*\[[^\]]*\]/.test(line)) {
            errors.push({
                from: CodeMirror.Pos(lineNum, 0),
                to: CodeMirror.Pos(lineNum, line.length),
                message: 'Tensor type should include shape: tensor<T, [dims...]>',
                severity: 'warning'
            });
        }
        
        // Check for missing pull statements
        if (/^\s*(Pin|ADC|I2C|SPI|UART|GPIO|Model)/.test(line) && 
            !lines.slice(0, lineNum).some(l => l.includes('pull hardware.'))) {
            errors.push({
                from: CodeMirror.Pos(lineNum, 0),
                to: CodeMirror.Pos(lineNum, line.length),
                message: 'Missing pull statement for hardware module',
                severity: 'info'
            });
        }
    });
    
    return errors;
});

// Register Ghost file extension
CodeMirror.modeExtensions['ghost'] = {
    fileExtensions: ['ghost', 'gh'],
    mimeType: 'text/x-ghost'
};

console.log('Ghost language mode loaded');