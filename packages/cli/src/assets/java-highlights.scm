; Java highlights for the bundled Tree-sitter grammar.

(identifier) @variable

(method_declaration
  name: (identifier) @function.method)

(method_invocation
  name: (identifier) @function.method)

(type_identifier) @type

(constructor_declaration
  name: (identifier) @type)

[
  (boolean_type)
  (integral_type)
  (floating_point_type)
  (void_type)
] @type.builtin

((identifier) @constant
  (#match? @constant "^_*[A-Z][A-Z\\d_]+$"))

[
  (hex_integer_literal)
  (decimal_integer_literal)
  (octal_integer_literal)
  (decimal_floating_point_literal)
  (hex_floating_point_literal)
] @number

[
  (character_literal)
  (string_literal)
] @string

(escape_sequence) @string.escape

[
  (true)
  (false)
  (null_literal)
] @constant

[
  (line_comment)
  (block_comment)
] @comment

(annotation
  name: (identifier) @attribute)

(marker_annotation
  name: (identifier) @attribute)

[
  "abstract"
  "assert"
  "break"
  "case"
  "catch"
  "class"
  "continue"
  "default"
  "do"
  "else"
  "enum"
  "extends"
  "final"
  "finally"
  "for"
  "if"
  "implements"
  "import"
  "instanceof"
  "interface"
  "native"
  "new"
  "package"
  "private"
  "protected"
  "public"
  "record"
  "return"
  "static"
  "strictfp"
  "switch"
  "synchronized"
  "throw"
  "throws"
  "transient"
  "try"
  "volatile"
  "while"
  "yield"
] @keyword

[
  "="
  "+"
  "-"
  "*"
  "/"
  "%"
  "=="
  "!="
  "<"
  ">"
  "<="
  ">="
  "&&"
  "||"
  "!"
  "++"
  "--"
] @operator
